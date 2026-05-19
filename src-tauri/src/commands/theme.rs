use std::{fs, path::PathBuf};

use serde::Serialize;

use super::file::CommandResult;

#[tauri::command]
pub fn get_theme() -> CommandResult<Option<String>> {
    let path = theme_path();
    if !path.exists() {
        return ok(None);
    }

    match fs::read_to_string(&path) {
        Ok(theme) => ok(Some(theme.trim().to_string())),
        Err(error) => fail(format!("failed to read theme: {error}")),
    }
}

#[tauri::command]
pub fn set_theme(theme: String) -> CommandResult<Option<()>> {
    let path = theme_path();
    if let Some(parent) = path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return fail(format!("failed to create settings directory: {error}"));
        }
    }

    match fs::write(&path, theme) {
        Ok(()) => ok(Some(())),
        Err(error) => fail(format!("failed to write theme: {error}")),
    }
}

fn theme_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Saekim")
        .join("theme.txt")
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
