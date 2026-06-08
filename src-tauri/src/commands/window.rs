#[tauri::command]
pub fn set_window_min_size(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_min_size(Some(tauri::LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())
}

#[cfg(desktop)]
#[tauri::command]
pub fn start_window_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn start_window_drag(_window: tauri::Window) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    if !is_external_url(&url) {
        return Err("unsupported external URL scheme".to_string());
    }

    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| error.to_string())
}

fn is_external_url(url: &str) -> bool {
    matches!(
        url.split_once(':').map(|(scheme, _)| scheme.to_ascii_lowercase()),
        Some(scheme) if matches!(scheme.as_str(), "http" | "https" | "mailto" | "tel" | "file")
    )
}
