mod app_state;
mod commands;

use app_state::AppState;
use std::path::PathBuf;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

const MENU_SAVE: &str = "save";
const MENU_SAVE_AS: &str = "save-as";
const MENU_EXPORT_PDF: &str = "export-pdf";
const MENU_NEW_FILE: &str = "new-file";
const MENU_OPEN_FILE: &str = "open-file";
const MENU_OPEN_FOLDER: &str = "open-folder";
const EVENT_SAVE: &str = "saekim-menu-save";
const EVENT_SAVE_AS: &str = "saekim-menu-save-as";
const EVENT_EXPORT_PDF: &str = "saekim-menu-export-pdf";
const EVENT_NEW_FILE: &str = "saekim-menu-new-file";
const EVENT_OPEN_FILE: &str = "saekim-menu-open-file";
const EVENT_OPEN_FOLDER: &str = "saekim-menu-open-folder";
const EVENT_OPEN_EXTERNAL_FILES: &str = "saekim-open-external-files";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            queue_open_files(app.handle(), startup_document_args());
            Ok(())
        })
        .menu(build_menu)
        .on_menu_event(|app, event| {
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
        })
        .invoke_handler(tauri::generate_handler![
            commands::file::open_file_dialog,
            commands::file::open_folder_dialog,
            commands::file::pick_image_path,
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
            commands::session::save_session,
            commands::window::open_external_url,
            commands::window::set_window_min_size,
            commands::window::start_window_drag
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Saekim");

    app.run(|app, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .filter(|path| is_supported_document_path(path))
                .map(|path| path.to_string_lossy().to_string())
                .collect();

            queue_open_files(app, paths);
        }
    });
}

fn startup_document_args() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|path| is_supported_document_path(path))
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

fn is_supported_document_path(path: &PathBuf) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "mdown" | "mkd" | "txt"
            )
        })
        .unwrap_or(false)
}

fn queue_open_files(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    let state = app.state::<AppState>();
    if let Ok(mut pending) = state.pending_open_files.lock() {
        pending.extend(paths.iter().cloned());
    }

    let _ = app.emit(EVENT_OPEN_EXTERNAL_FILES, paths);
}

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
