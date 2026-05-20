#[tauri::command]
pub fn set_window_min_size(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_min_size(Some(tauri::LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn print_current_webview(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|error| error.to_string())
}
