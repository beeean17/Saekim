use std::{fs, path::PathBuf};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::app_state::AppState;

#[derive(Serialize)]
pub struct CommandResult<T>
where
    T: Serialize,
{
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct OpenFilePayload {
    path: String,
    name: String,
    content: String,
}

#[tauri::command]
pub fn open_file_dialog(
    app: AppHandle,
    state: tauri::State<AppState>,
) -> CommandResult<Option<OpenFilePayload>> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    let Some(path) = selected else {
        return ok(None);
    };

    match read_file(path.into_path().unwrap_or_default()) {
        Ok(payload) => {
            if let Ok(mut active_file) = state.active_file.lock() {
                *active_file = Some(payload.path.clone());
            }
            ok(Some(payload))
        }
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn save_file(
    app: AppHandle,
    state: tauri::State<AppState>,
    path: Option<String>,
    content: String,
) -> CommandResult<Option<String>> {
    let target_path = match path {
        Some(path) if !path.is_empty() => Some(PathBuf::from(path)),
        _ => app
            .dialog()
            .file()
            .add_filter("Markdown", &["md", "markdown", "txt"])
            .set_file_name("untitled.md")
            .blocking_save_file()
            .map(|path| path.into_path().unwrap_or_default()),
    };

    let Some(target_path) = target_path else {
        return ok(None);
    };

    match fs::write(&target_path, content) {
        Ok(()) => {
            let path = target_path.to_string_lossy().to_string();
            if let Ok(mut active_file) = state.active_file.lock() {
                *active_file = Some(path.clone());
            }
            ok(Some(path))
        }
        Err(error) => fail(format!("failed to save file: {error}")),
    }
}

#[tauri::command]
pub fn save_file_as(
    app: AppHandle,
    content: String,
    suggested_name: String,
) -> CommandResult<Option<String>> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .set_file_name(&suggested_name)
        .blocking_save_file();

    let Some(path) = selected else {
        return ok(None);
    };

    let path = path.into_path().unwrap_or_default();
    match fs::write(&path, content) {
        Ok(()) => ok(Some(path.to_string_lossy().to_string())),
        Err(error) => fail(format!("failed to save file: {error}")),
    }
}

fn read_file(path: PathBuf) -> Result<OpenFilePayload, String> {
    let content =
        fs::read_to_string(&path).map_err(|error| format!("failed to read file: {error}"))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("untitled.md")
        .to_string();

    Ok(OpenFilePayload {
        path: path.to_string_lossy().to_string(),
        name,
        content,
    })
}

fn ok<T>(data: T) -> CommandResult<T>
where
    T: Serialize,
{
    CommandResult {
        success: true,
        data: Some(data),
        error: None,
    }
}

fn fail<T>(error: String) -> CommandResult<T>
where
    T: Serialize,
{
    CommandResult {
        success: false,
        data: None,
        error: Some(error),
    }
}
