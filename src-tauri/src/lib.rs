mod app_state;
mod commands;
#[cfg(target_os = "macos")]
mod macos_open_documents;
mod text_file;

use app_state::AppState;
use std::path::{Path, PathBuf};
#[cfg(not(target_os = "windows"))]
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{DragDropEvent, Emitter, Manager, WebviewEvent, WindowEvent};

#[cfg(not(target_os = "windows"))]
const MENU_SAVE: &str = "save";
#[cfg(not(target_os = "windows"))]
const MENU_SAVE_AS: &str = "save-as";
#[cfg(not(target_os = "windows"))]
const MENU_EXPORT_PDF: &str = "export-pdf";
#[cfg(not(target_os = "windows"))]
const MENU_NEW_FILE: &str = "new-file";
#[cfg(not(target_os = "windows"))]
const MENU_OPEN_FILE: &str = "open-file";
#[cfg(not(target_os = "windows"))]
const MENU_OPEN_FOLDER: &str = "open-folder";
#[cfg(not(target_os = "windows"))]
const EVENT_SAVE: &str = "saekim-menu-save";
#[cfg(not(target_os = "windows"))]
const EVENT_SAVE_AS: &str = "saekim-menu-save-as";
#[cfg(not(target_os = "windows"))]
const EVENT_EXPORT_PDF: &str = "saekim-menu-export-pdf";
#[cfg(not(target_os = "windows"))]
const EVENT_NEW_FILE: &str = "saekim-menu-new-file";
#[cfg(not(target_os = "windows"))]
const EVENT_OPEN_FILE: &str = "saekim-menu-open-file";
#[cfg(not(target_os = "windows"))]
const EVENT_OPEN_FOLDER: &str = "saekim-menu-open-folder";
const EVENT_OPEN_EXTERNAL_FILES: &str = "saekim-open-external-files";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(single_instance_plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            macos_open_documents::install(app.handle());
            queue_open_files(app.handle(), startup_document_args());
            Ok(())
        });

    #[cfg(not(target_os = "windows"))]
    let builder = builder.menu(build_menu).on_menu_event(|app, event| {
        let event_name = match event.id().as_ref() {
            MENU_SAVE => Some(EVENT_SAVE),
            MENU_SAVE_AS => Some(EVENT_SAVE_AS),
            MENU_EXPORT_PDF => Some(EVENT_EXPORT_PDF),
            MENU_NEW_FILE => Some(EVENT_NEW_FILE),
            MENU_OPEN_FILE => Some(EVENT_OPEN_FILE),
            MENU_OPEN_FOLDER => Some(EVENT_OPEN_FOLDER),
            _ => None,
        };

        if let Some(event_name) = event_name {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit(event_name, ());
            }
        }
    });

    let app = builder
        .invoke_handler(tauri::generate_handler![
            commands::file::open_file_dialog,
            commands::file::open_folder_dialog,
            commands::file::pick_image_path,
            commands::file::copy_image_to_assets,
            commands::file::import_image_bytes_to_assets,
            commands::file::download_image_to_assets,
            commands::file::pick_pdf_export_path,
            commands::file::import_pdf,
            commands::file::read_file,
            commands::file::read_folder,
            commands::file::read_folder_children,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::file::take_pending_open_files,
            commands::file::write_pdf_export,
            commands::session::load_session,
            commands::session::load_block_layouts,
            commands::session::save_session,
            commands::session::save_block_layout,
            commands::window::open_external_url,
            commands::window::set_window_min_size,
            commands::window::start_window_drag
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Saekim");

    app.run(|app, event| match event {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        tauri::RunEvent::Opened { urls } => {
            queue_open_files(app, document_paths_from_urls(urls));
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
    use std::{env, fs, time::{SystemTime, UNIX_EPOCH}};

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
            vec![exe.to_string_lossy().to_string(), document.to_string_lossy().to_string()],
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

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
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
    text_file::is_supported_document_path(path)
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
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(EVENT_OPEN_EXTERNAL_FILES, paths);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(not(target_os = "windows"))]
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let package_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(package_info.name.clone()),
        version: Some(package_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };

    let save = MenuItem::with_id(app, MENU_SAVE, "Save", true, Some("CmdOrCtrl+S"))?;
    let new_file = MenuItem::with_id(app, MENU_NEW_FILE, "New File", true, Some("CmdOrCtrl+N"))?;
    let open_file = MenuItem::with_id(
        app,
        MENU_OPEN_FILE,
        "Open File...",
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let open_folder = MenuItem::with_id(
        app,
        MENU_OPEN_FOLDER,
        "Open Folder...",
        true,
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let save_as = MenuItem::with_id(
        app,
        MENU_SAVE_AS,
        "Save As...",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let export_pdf = MenuItem::with_id(
        app,
        MENU_EXPORT_PDF,
        "Export PDF",
        true,
        Some("CmdOrCtrl+P"),
    )?;

    let app_menu = Submenu::with_items(
        app,
        package_info.name.clone(),
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &new_file,
            &PredefinedMenuItem::separator(app)?,
            &open_file,
            &open_folder,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &PredefinedMenuItem::separator(app)?,
            &export_pdf,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app, None)?],
    )?;
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    let help_menu = Submenu::with_items(app, "Help", true, &[])?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}
