use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

use crate::app_state::AppState;

#[tauri::command]
pub fn log_frontend_event(scope: String, message: String, details: Option<String>) {
    match details {
        Some(details) if !details.is_empty() => {
            eprintln!("[saekim:{scope}] {message} {details}");
        }
        _ => {
            eprintln!("[saekim:{scope}] {message}");
        }
    }
}

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

#[cfg(desktop)]
#[tauri::command]
pub async fn open_new_window(app: tauri::AppHandle) -> Result<(), String> {
    let mut config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .ok_or_else(|| "missing base window config".to_string())?;
    let label = format!("window{}", current_timestamp_millis());
    config.label = label.clone();

    let window = tauri::WebviewWindowBuilder::from_config(&app, &config)
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())?;
    let state = app.state::<AppState>();
    if let Ok(mut active_label) = state.active_window_label.lock() {
        *active_label = Some(label);
    }
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
pub async fn open_new_window(_app: tauri::AppHandle) -> Result<(), String> {
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

fn current_timestamp_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}
