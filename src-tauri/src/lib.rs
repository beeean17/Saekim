mod app_state;
mod commands;
mod core;
mod platform;

use app_state::AppState;
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::atomic::Ordering,
};
use tauri::{DragDropEvent, Emitter, Manager, WebviewEvent, WindowEvent};

const EVENT_OPEN_EXTERNAL_FILES: &str = "saekim-open-external-files";
const EVENT_CLOSE_REQUESTED: &str = "saekim-close-requested";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CloseRequestPayload {
    reason: &'static str,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(single_instance_plugin());

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(
                tauri_plugin_window_state::StateFlags::SIZE
                    | tauri_plugin_window_state::StateFlags::POSITION
                    | tauri_plugin_window_state::StateFlags::MAXIMIZED,
            )
            .build(),
    );

    let builder = builder.plugin(tauri_plugin_dialog::init());

    #[cfg(target_os = "android")]
    let builder = builder
        .plugin(platform::android::document_metadata::init())
        .plugin(platform::android::image_picker::init())
        .plugin(tauri_plugin_fs::init());

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            commands::session::initialize_metadata_connection(app.handle())
                .map_err(std::io::Error::other)?;
            remember_active_window(app.handle(), "main");
            #[cfg(target_os = "macos")]
            platform::macos::open_documents::install(app.handle());
            queue_open_files(app.handle(), startup_document_args());
            Ok(())
        });

    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(platform::macos::native_menu::build_menu)
        .on_menu_event(platform::macos::native_menu::handle_menu_event);

    let app = builder
        .invoke_handler(tauri::generate_handler![
            commands::file::open_file_dialog,
            commands::file::open_folder_dialog,
            commands::file::pick_image_path,
            commands::file::resolve_image_src,
            commands::file::copy_image_to_assets,
            commands::file::import_image_bytes_to_assets,
            commands::file::download_image_to_assets,
            commands::file::pick_pdf_export_path,
            commands::file::import_pdf,
            commands::file::read_file,
            commands::file::read_folder,
            commands::file::read_folder_children,
            commands::file::search_workspace,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::file::take_pending_open_files,
            commands::file::write_pdf_export,
            commands::session::load_session,
            commands::session::load_workspace_session,
            commands::session::delete_document_draft,
            commands::layout_metadata::load_block_layouts,
            commands::session::save_session,
            commands::layout_metadata::save_block_layout,
            commands::layout_metadata::save_block_layouts,
            commands::window::log_frontend_event,
            commands::window::open_external_url,
            commands::window::open_new_window,
            commands::window::set_window_min_size,
            commands::window::start_window_drag,
            commands::window::confirm_unsaved_changes,
            commands::window::respond_to_close_request
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Saekim");

    app.run(|app, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            let state = app.state::<AppState>();
            if state.app_exit_approved.swap(false, Ordering::SeqCst) {
                return;
            }

            api.prevent_exit();
            request_app_exit(app);
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            let state = app.state::<AppState>();
            let approved = state
                .approved_close_windows
                .lock()
                .map(|mut windows| windows.remove(&label))
                .unwrap_or(false);

            if !approved {
                api.prevent_close();
                if let Some(window) = app.get_webview_window(&label) {
                    let _ = window.emit(
                        EVENT_CLOSE_REQUESTED,
                        CloseRequestPayload { reason: "window" },
                    );
                }
            }
        }
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        tauri::RunEvent::Opened { urls } => {
            queue_open_files(app, document_paths_from_urls(urls));
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: WindowEvent::Focused(true),
            ..
        } => {
            remember_active_window(app, &label);
        }
        tauri::RunEvent::WindowEvent {
            event: WindowEvent::DragDrop(event),
            ..
        } => {
            queue_open_files(app, document_paths_from_drag_drop_event(event));
        }
        tauri::RunEvent::WebviewEvent {
            event: WebviewEvent::DragDrop(event),
            ..
        } => {
            queue_open_files(app, document_paths_from_drag_drop_event(event));
        }
        _ => {}
    });
}

pub(crate) fn request_app_exit(app: &tauri::AppHandle) {
    let windows = app.webview_windows();
    let state = app.state::<AppState>();

    if windows.is_empty() {
        state.app_exit_approved.store(true, Ordering::SeqCst);
        app.exit(0);
        return;
    }

    let should_emit = state
        .pending_exit_windows
        .lock()
        .map(|mut pending| {
            if pending.is_some() {
                false
            } else {
                *pending = Some(windows.keys().cloned().collect());
                true
            }
        })
        .unwrap_or(false);

    if should_emit {
        for window in windows.values() {
            let _ = window.emit(EVENT_CLOSE_REQUESTED, CloseRequestPayload { reason: "app" });
        }
    }
}

fn single_instance_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        return tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = document_args_from_strings(args, Some(&cwd));
            queue_open_files(app, paths);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        });
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        tauri::plugin::Builder::new("single-instance-placeholder").build()
    }
}

pub(crate) fn active_window_label(app: &tauri::AppHandle) -> Option<String> {
    let state = app.state::<AppState>();
    state
        .active_window_label
        .lock()
        .ok()
        .and_then(|label| label.clone())
}

fn remember_active_window(app: &tauri::AppHandle, label: &str) {
    let state = app.state::<AppState>();
    if let Ok(mut active_label) = state.active_window_label.lock() {
        *active_label = Some(label.to_string());
    };
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = hex_value(bytes[index + 1]);
            let low = hex_value(bytes[index + 2]);
            if let (Some(high), Some(low)) = (high, low) {
                decoded.push((high << 4) | low);
                index += 3;
                continue;
            }
        }

        decoded.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&decoded).into_owned()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn startup_document_args() -> Vec<String> {
    std::env::args_os()
        .filter_map(|arg| arg.into_string().ok())
        .filter_map(|arg| document_path_from_arg(&arg, None))
        .collect()
}

#[cfg(any(desktop, test))]
fn document_args_from_strings(args: Vec<String>, cwd: Option<&str>) -> Vec<String> {
    args.into_iter()
        .filter_map(|arg| document_path_from_arg(&arg, cwd))
        .collect()
}

fn document_path_from_arg(arg: &str, cwd: Option<&str>) -> Option<String> {
    let arg = arg.trim().trim_matches('"');

    if arg.is_empty() || arg.starts_with('-') {
        return None;
    }

    let plain_path = PathBuf::from(arg);
    let path = if plain_path.is_absolute() {
        plain_path
    } else if let Ok(url) = url::Url::parse(arg) {
        url.to_file_path().ok().or_else(|| {
            (url.scheme() == "file").then(|| PathBuf::from(percent_decode(url.path())))
        })?
    } else {
        cwd.map(|cwd| Path::new(cwd).join(plain_path))?
    };

    is_supported_document_path(&path).then(|| path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        env, fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn document_args_accepts_single_file_arg_without_program_name() {
        let path = temp_text_path("single-file.md");
        fs::write(&path, "# opened from association").unwrap();

        let paths = document_args_from_strings(vec![path.to_string_lossy().to_string()], None);

        assert_eq!(paths, vec![path.to_string_lossy().to_string()]);
        let _ = fs::remove_file(path);
    }

    #[test]
    fn document_args_ignores_program_path_but_keeps_file_arg() {
        let exe = temp_text_path("saekim.exe");
        let document = temp_text_path("with-program.txt");
        fs::write(&exe, "not really an exe").unwrap();
        fs::write(&document, "opened from default app").unwrap();

        let paths = document_args_from_strings(
            vec![
                exe.to_string_lossy().to_string(),
                document.to_string_lossy().to_string(),
            ],
            None,
        );

        assert_eq!(paths, vec![document.to_string_lossy().to_string()]);
        let _ = fs::remove_file(exe);
        let _ = fs::remove_file(document);
    }

    fn temp_text_path(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        env::temp_dir().join(format!("saekim-open-arg-{timestamp}-{name}"))
    }
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
fn document_paths_from_urls(urls: Vec<url::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| {
            url.to_file_path().ok().or_else(|| {
                (url.scheme() == "file").then(|| PathBuf::from(percent_decode(url.path())))
            })
        })
        .filter(|path| is_supported_document_path(path))
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

#[cfg(target_os = "android")]
fn document_paths_from_urls(urls: Vec<url::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| {
            if let Ok(path) = url.to_file_path() {
                return is_supported_document_path(&path)
                    .then(|| path.to_string_lossy().to_string());
            }

            if url.scheme() == "file" {
                let path = PathBuf::from(percent_decode(url.path()));
                return is_supported_document_path(&path)
                    .then(|| path.to_string_lossy().to_string());
            }

            if url.scheme() == "content" {
                return Some(url.to_string());
            }

            None
        })
        .collect()
}

fn document_paths_from_drag_drop_event(event: DragDropEvent) -> Vec<String> {
    match event {
        DragDropEvent::Drop { paths, .. } => document_paths_from_pathbufs(paths),
        _ => Vec::new(),
    }
}

fn document_paths_from_pathbufs(paths: Vec<PathBuf>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|path| is_supported_document_path(path))
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

pub(crate) fn is_supported_document_path(path: &Path) -> bool {
    core::text_file::is_supported_document_path(path)
}

pub(crate) fn queue_open_files(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    let state = app.state::<AppState>();
    if let Ok(mut pending) = state.pending_open_files.lock() {
        pending.extend(paths.iter().cloned());
    }

    let _ = app.emit(EVENT_OPEN_EXTERNAL_FILES, paths.clone());
    if let Some(window) = target_webview_window(app) {
        let _ = window.emit(EVENT_OPEN_EXTERNAL_FILES, paths);
        focus_opened_document_window(&window);
    }
}

fn target_webview_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    active_window_label(app)
        .and_then(|label| app.get_webview_window(&label))
        .or_else(|| app.get_webview_window("main"))
        .or_else(|| app.webview_windows().into_values().next())
}

#[cfg(desktop)]
fn focus_opened_document_window(window: &tauri::WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg(not(desktop))]
fn focus_opened_document_window(_window: &tauri::WebviewWindow) {}
