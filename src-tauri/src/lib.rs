mod app_state;
mod commands;

use app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::file::open_file_dialog,
            commands::file::open_folder_dialog,
            commands::file::read_file,
            commands::file::read_folder,
            commands::file::read_folder_children,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::session::load_session,
            commands::session::save_session,
            commands::theme::get_theme,
            commands::theme::set_theme
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Saekim");
}
