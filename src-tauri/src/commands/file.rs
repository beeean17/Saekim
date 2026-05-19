use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPayload {
    root_path: String,
    tree: Vec<FileTreeNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    id: String,
    name: String,
    #[serde(rename = "type")]
    node_type: String,
    path: String,
    modified_at: Option<u64>,
    children: Option<Vec<FileTreeNode>>,
    is_open: Option<bool>,
    is_loaded: Option<bool>,
}

#[tauri::command]
pub fn open_file_dialog(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> CommandResult<Option<OpenFilePayload>> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    let Some(path) = selected else {
        return ok(None);
    };

    match read_file_payload(path.into_path().unwrap_or_default()) {
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
pub async fn open_folder_dialog(app: AppHandle) -> CommandResult<Option<String>> {
    let selected =
        tauri::async_runtime::spawn_blocking(move || app.dialog().file().blocking_pick_folder())
            .await;

    match selected {
        Ok(Some(path)) => ok(Some(
            path.into_path()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        )),
        Ok(None) => ok(None),
        Err(error) => fail(format!("failed to open folder dialog: {error}")),
    }
}

#[tauri::command]
pub fn import_pdf(path: String) -> CommandResult<OpenFilePayload> {
    let file_name = Path::new(&path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("selected PDF");

    fail(format!(
        "PDF import is deferred in Saekim 3.0.0 ({file_name}). Use Saekim 2.x for PDF-to-Markdown conversion until the import pipeline is reintroduced."
    ))
}

#[tauri::command]
pub fn read_folder(path: String) -> CommandResult<FolderPayload> {
    match read_folder_payload(PathBuf::from(path)) {
        Ok(payload) => ok(payload),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn read_folder_children(path: String) -> CommandResult<Vec<FileTreeNode>> {
    match read_folder_children_payload(PathBuf::from(path)) {
        Ok(payload) => ok(payload),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn read_file(path: String, state: tauri::State<AppState>) -> CommandResult<OpenFilePayload> {
    match read_file_payload(PathBuf::from(path)) {
        Ok(payload) => {
            if let Ok(mut active_file) = state.active_file.lock() {
                *active_file = Some(payload.path.clone());
            }
            ok(payload)
        }
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub async fn save_file(
    app: AppHandle,
    path: Option<String>,
    content: String,
) -> CommandResult<Option<String>> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
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
            return Ok(None);
        };

        fs::write(&target_path, content)
            .map_err(|error| format!("failed to save file: {error}"))?;
        Ok(Some(target_path.to_string_lossy().to_string()))
    })
    .await;

    match selected {
        Ok(Ok(Some(path))) => ok(Some(path)),
        Ok(Ok(None)) => ok(None),
        Ok(Err(error)) => fail(error),
        Err(error) => fail(format!("failed to run save dialog: {error}")),
    }
}

#[tauri::command]
pub async fn save_file_as(
    app: AppHandle,
    content: String,
    suggested_name: String,
) -> CommandResult<Option<String>> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .add_filter("Markdown", &["md", "markdown", "txt"])
            .set_file_name(&suggested_name)
            .blocking_save_file();

        let Some(path) = selected else {
            return Ok(None);
        };

        let path = path.into_path().unwrap_or_default();
        fs::write(&path, content).map_err(|error| format!("failed to save file: {error}"))?;
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await;

    match selected {
        Ok(Ok(Some(path))) => ok(Some(path)),
        Ok(Ok(None)) => ok(None),
        Ok(Err(error)) => fail(error),
        Err(error) => fail(format!("failed to run save dialog: {error}")),
    }
}

fn read_file_payload(path: PathBuf) -> Result<OpenFilePayload, String> {
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

fn read_folder_payload(path: PathBuf) -> Result<FolderPayload, String> {
    if !path.is_dir() {
        return Err("selected path is not a folder".to_string());
    }

    Ok(FolderPayload {
        root_path: path.to_string_lossy().to_string(),
        tree: read_tree_children(&path, 0, 2, true)?,
    })
}

fn read_folder_children_payload(path: PathBuf) -> Result<Vec<FileTreeNode>, String> {
    if !path.is_dir() {
        return Err("selected path is not a folder".to_string());
    }

    read_tree_children(&path, 0, 0, false)
}

fn read_tree_children(
    path: &Path,
    depth: usize,
    max_depth: usize,
    open_root_folders: bool,
) -> Result<Vec<FileTreeNode>, String> {
    const MAX_ENTRIES_PER_FOLDER: usize = 80;

    let mut entries = fs::read_dir(path)
        .map_err(|error| format!("failed to read folder: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if file_type.is_symlink() {
                return None;
            }

            let path = entry.path();
            let is_dir = file_type.is_dir();
            let is_file = file_type.is_file();
            if should_include_path(&path, is_dir, is_file) {
                Some((entry, is_dir))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| entry_name_lower(&a.0).cmp(&entry_name_lower(&b.0)))
    });

    entries.truncate(MAX_ENTRIES_PER_FOLDER);

    entries
        .into_iter()
        .map(|(entry, _)| build_tree_node(entry.path(), depth, max_depth, open_root_folders))
        .collect()
}

fn build_tree_node(
    path: PathBuf,
    depth: usize,
    max_depth: usize,
    open_root_folders: bool,
) -> Result<FileTreeNode, String> {
    let metadata =
        fs::metadata(&path).map_err(|error| format!("failed to read metadata: {error}"))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64);

    if metadata.is_dir() {
        let is_open = open_root_folders && depth == 0;
        let is_loaded = depth < max_depth;
        let children = if is_loaded {
            Some(read_tree_children(
                &path,
                depth + 1,
                max_depth,
                open_root_folders,
            )?)
        } else {
            Some(Vec::new())
        };

        return Ok(FileTreeNode {
            id: path.to_string_lossy().to_string(),
            name,
            node_type: "folder".to_string(),
            path: path.to_string_lossy().to_string(),
            modified_at,
            children,
            is_open: Some(is_open),
            is_loaded: Some(is_loaded),
        });
    }

    Ok(FileTreeNode {
        id: path.to_string_lossy().to_string(),
        name,
        node_type: "file".to_string(),
        path: path.to_string_lossy().to_string(),
        modified_at,
        children: None,
        is_open: None,
        is_loaded: None,
    })
}

fn should_include_path(path: &Path, is_dir: bool, is_file: bool) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    if matches!(
        name,
        ".git"
            | "node_modules"
            | "dist"
            | "build"
            | "target"
            | "src-tauri"
            | "Library"
            | "Applications"
            | "Movies"
            | "Music"
            | "Pictures"
    ) || name.starts_with('.')
    {
        return false;
    }

    is_dir || (is_file && is_supported_document(path))
}

fn is_supported_document(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_lowercase)
            .as_deref(),
        Some("md" | "markdown" | "txt")
    )
}

fn entry_name_lower(entry: &fs::DirEntry) -> String {
    entry.file_name().to_str().unwrap_or("").to_lowercase()
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
