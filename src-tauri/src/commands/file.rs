use std::{
    fs,
    io::Write,
    net::IpAddr,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use futures_util::StreamExt;
use reqwest::{
    header::{CONTENT_LENGTH, CONTENT_TYPE, LOCATION},
    redirect::Policy,
    Client, Url,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;

use crate::{
    app_state::AppState,
    core::text_file::{is_known_text_document_path, read_text_file, TEXT_DIALOG_EXTENSIONS},
    is_supported_document_path, queue_open_files,
};

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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDownloadProgressPayload {
    id: String,
    status: String,
    progress: Option<u8>,
    message: Option<String>,
}

const IMAGE_DOWNLOAD_PROGRESS_EVENT: &str = "image-download-progress";
const MAX_REMOTE_IMAGE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;

#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> CommandResult<bool> {
    let app_handle = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file().blocking_pick_file();

        let Some(path) = selected else {
            return Ok(None);
        };

        let path = path.into_path().unwrap_or_default();
        if !is_supported_document_path(&path) {
            return Err("unsupported document type".to_string());
        }

        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await;

    match selected {
        Ok(Ok(Some(path))) => {
            queue_open_files(&app_handle, vec![path]);
            ok(true)
        }
        Ok(Ok(None)) => ok(false),
        Ok(Err(error)) => fail(error),
        Err(error) => fail(format!("failed to open file dialog: {error}")),
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
pub async fn pick_image_path(app: AppHandle) -> CommandResult<Option<String>> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter(
                "Images",
                &[
                    "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif",
                ],
            )
            .blocking_pick_file()
    })
    .await;

    match selected {
        Ok(Some(path)) => ok(Some(
            path.into_path()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
        )),
        Ok(None) => ok(None),
        Err(error) => fail(format!("failed to pick image path: {error}")),
    }
}

#[tauri::command]
pub fn copy_image_to_assets(
    source_path: String,
    current_file_path: String,
) -> CommandResult<String> {
    match copy_image_to_assets_impl(PathBuf::from(source_path), PathBuf::from(current_file_path)) {
        Ok(path) => ok(path),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub fn import_image_bytes_to_assets(
    bytes: Vec<u8>,
    file_name: Option<String>,
    mime_type: Option<String>,
    current_file_path: String,
) -> CommandResult<String> {
    match import_image_bytes_to_assets_impl(
        bytes,
        file_name,
        mime_type,
        PathBuf::from(current_file_path),
    ) {
        Ok(path) => ok(path),
        Err(error) => fail(error),
    }
}

#[tauri::command]
pub async fn download_image_to_assets(
    app: AppHandle,
    id: String,
    image_url: String,
    current_file_path: String,
) -> CommandResult<String> {
    emit_image_progress(&app, &id, "started", Some(0), None);
    match download_image_to_assets_impl(&app, &id, &image_url, PathBuf::from(current_file_path))
        .await
    {
        Ok(path) => {
            emit_image_progress(&app, &id, "completed", Some(100), None);
            ok(path)
        }
        Err(error) => {
            emit_image_progress(&app, &id, "failed", None, Some(error.clone()));
            fail(error)
        }
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
pub fn take_pending_open_files(state: tauri::State<AppState>) -> CommandResult<Vec<String>> {
    match state.pending_open_files.lock() {
        Ok(mut pending) => ok(pending.drain(..).collect()),
        Err(error) => fail(format!("failed to read pending open files: {error}")),
    }
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
                .add_filter("Text Documents", TEXT_DIALOG_EXTENSIONS)
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
            .add_filter("Text Documents", TEXT_DIALOG_EXTENSIONS)
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

#[tauri::command]
pub async fn pick_pdf_export_path(
    app: AppHandle,
    suggested_name: String,
) -> CommandResult<Option<String>> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .add_filter("PDF", &["pdf"])
            .set_file_name(&suggested_name)
            .blocking_save_file();

        let Some(path) = selected else {
            return Ok(None);
        };

        let mut path = path.into_path().unwrap_or_default();
        let is_pdf = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|extension| extension.eq_ignore_ascii_case("pdf"))
            .unwrap_or(false);
        if !is_pdf {
            path.set_extension("pdf");
        }

        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await;

    match selected {
        Ok(Ok(Some(path))) => ok(Some(path)),
        Ok(Ok(None)) => ok(None),
        Ok(Err(error)) => fail(error),
        Err(error) => fail(format!("failed to run PDF save dialog: {error}")),
    }
}

#[tauri::command]
pub fn write_pdf_export(path: String, bytes: Vec<u8>) -> CommandResult<String> {
    match fs::write(&path, bytes) {
        Ok(()) => ok(path),
        Err(error) => fail(format!("failed to save PDF: {error}")),
    }
}

fn read_file_payload(path: PathBuf) -> Result<OpenFilePayload, String> {
    let content = read_text_file(&path)?;
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

fn copy_image_to_assets_impl(
    source_path: PathBuf,
    current_file_path: PathBuf,
) -> Result<String, String> {
    if !source_path.is_file() {
        return Err("selected image is not a file".to_string());
    }

    let extension = local_image_extension(&source_path)?;
    let assets_dir = ensure_assets_dir(&current_file_path)?;
    if let Some(existing_path) = find_existing_asset_with_same_content(&assets_dir, &source_path)? {
        return relative_asset_path(&existing_path, &current_file_path);
    }

    let base_name = image_base_name_from_path(&source_path);
    let target_path =
        unique_asset_path_for_content(&assets_dir, &base_name, &extension, &source_path)?;
    fs::copy(&source_path, &target_path)
        .map_err(|error| format!("failed to copy image: {error}"))?;
    relative_asset_path(&target_path, &current_file_path)
}

fn import_image_bytes_to_assets_impl(
    bytes: Vec<u8>,
    file_name: Option<String>,
    mime_type: Option<String>,
    current_file_path: PathBuf,
) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("dropped image is empty".to_string());
    }
    if bytes.len() as u64 > MAX_REMOTE_IMAGE_BYTES {
        return Err("image is larger than the 20 MB limit".to_string());
    }

    let extension = dropped_image_extension(file_name.as_deref(), mime_type.as_deref())?;
    let assets_dir = ensure_assets_dir(&current_file_path)?;
    let temp_path = unique_temp_image_path(&assets_dir, &extension);
    fs::write(&temp_path, bytes).map_err(|error| format!("failed to write image file: {error}"))?;

    if let Some(existing_path) = find_existing_asset_with_same_content(&assets_dir, &temp_path)? {
        let _ = fs::remove_file(&temp_path);
        return relative_asset_path(&existing_path, &current_file_path);
    }

    let base_name = file_name
        .as_deref()
        .map(|name| image_base_name_from_path(Path::new(name)))
        .unwrap_or_else(|| "image".to_string());
    let target_path =
        unique_asset_path_for_content(&assets_dir, &base_name, &extension, &temp_path)?;
    fs::rename(&temp_path, &target_path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        format!("failed to finalize image file: {error}")
    })?;
    relative_asset_path(&target_path, &current_file_path)
}

async fn download_image_to_assets_impl(
    app: &AppHandle,
    id: &str,
    image_url: &str,
    current_file_path: PathBuf,
) -> Result<String, String> {
    let assets_dir = ensure_assets_dir(&current_file_path)?;
    let client = Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("failed to create downloader: {error}"))?;
    let mut url = parse_safe_http_url(image_url)?;
    let mut response = None;

    for _ in 0..=MAX_REDIRECTS {
        let next_response = client
            .get(url.clone())
            .send()
            .await
            .map_err(|error| format!("failed to download image: {error}"))?;

        if next_response.status().is_redirection() {
            let location = next_response
                .headers()
                .get(LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| "redirect response did not include a location".to_string())?;
            url = url
                .join(location)
                .map_err(|error| format!("invalid redirect location: {error}"))?;
            validate_http_url(&url)?;
            continue;
        }

        response = Some(next_response);
        break;
    }

    let response =
        response.ok_or_else(|| "too many redirects while downloading image".to_string())?;
    if !response.status().is_success() {
        return Err(format!("image server returned {}", response.status()));
    }

    validate_http_url(response.url())?;
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let extension = remote_image_extension(&content_type)?;

    if let Some(content_length) = response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
    {
        if content_length > MAX_REMOTE_IMAGE_BYTES {
            return Err("image is larger than the 20 MB limit".to_string());
        }
    }

    let base_name = image_base_name_from_url(response.url());
    let temp_path = unique_temp_image_path(&assets_dir, &extension);
    let mut file = fs::File::create(&temp_path)
        .map_err(|error| format!("failed to create image file: {error}"))?;
    let total_size = response.content_length();
    let mut downloaded = 0_u64;
    let mut last_progress = 0_u8;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("failed to read image data: {error}"))?;
        downloaded += chunk.len() as u64;
        if downloaded > MAX_REMOTE_IMAGE_BYTES {
            let _ = fs::remove_file(&temp_path);
            return Err("image is larger than the 20 MB limit".to_string());
        }

        file.write_all(&chunk)
            .map_err(|error| format!("failed to write image file: {error}"))?;

        if let Some(total_size) = total_size {
            if total_size > 0 {
                let progress = ((downloaded as f64 / total_size as f64) * 100.0).floor() as u8;
                let progress = progress.min(99);
                if progress >= last_progress.saturating_add(5) {
                    last_progress = progress;
                    emit_image_progress(app, id, "progress", Some(progress), None);
                }
            }
        } else if downloaded > 0 && last_progress == 0 {
            last_progress = 1;
            emit_image_progress(app, id, "progress", None, None);
        }
    }

    drop(file);
    if let Some(existing_path) = find_existing_asset_with_same_content(&assets_dir, &temp_path)? {
        let _ = fs::remove_file(&temp_path);
        return relative_asset_path(&existing_path, &current_file_path);
    }

    let target_path =
        unique_asset_path_for_content(&assets_dir, &base_name, &extension, &temp_path)?;
    fs::rename(&temp_path, &target_path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        format!("failed to finalize image file: {error}")
    })?;
    relative_asset_path(&target_path, &current_file_path)
}

fn ensure_assets_dir(current_file_path: &Path) -> Result<PathBuf, String> {
    if current_file_path.to_string_lossy().starts_with('~') {
        return Err("save the current document before importing image assets".to_string());
    }

    let parent = current_file_path
        .parent()
        .ok_or_else(|| "current document does not have a parent folder".to_string())?;
    let assets_dir = parent.join(".assets");
    fs::create_dir_all(&assets_dir)
        .map_err(|error| format!("failed to create .assets folder: {error}"))?;
    Ok(assets_dir)
}

fn local_image_extension(path: &Path) -> Result<String, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif"
    ) {
        return Ok(if extension == "jpeg" {
            "jpg".to_string()
        } else {
            extension
        });
    }

    Err("selected file is not a supported image".to_string())
}

fn remote_image_extension(content_type: &str) -> Result<String, String> {
    match content_type {
        "image/png" => Ok("png".to_string()),
        "image/jpeg" => Ok("jpg".to_string()),
        "image/webp" => Ok("webp".to_string()),
        "image/gif" => Ok("gif".to_string()),
        "image/avif" => Ok("avif".to_string()),
        "image/svg+xml" => Err("remote SVG images are blocked by default".to_string()),
        _ => Err(format!("unsupported remote image type: {content_type}")),
    }
}

fn dropped_image_extension(
    file_name: Option<&str>,
    mime_type: Option<&str>,
) -> Result<String, String> {
    let mime_type = mime_type
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if !mime_type.is_empty() {
        return remote_image_extension(&mime_type);
    }

    file_name
        .map(Path::new)
        .map(local_image_extension)
        .transpose()?
        .ok_or_else(|| "dropped image does not include a supported type".to_string())
}

fn unique_temp_image_path(assets_dir: &Path, extension: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

    for index in 0..1000 {
        let candidate = if index == 0 {
            format!(".image_import_{millis}.{extension}.download")
        } else {
            format!(".image_import_{millis}_{index}.{extension}.download")
        };
        let path = assets_dir.join(candidate);
        if !path.exists() {
            return path;
        }
    }

    assets_dir.join(format!(
        ".image_import_{millis}_fallback.{extension}.download"
    ))
}

fn unique_asset_path_for_content(
    assets_dir: &Path,
    base_name: &str,
    extension: &str,
    content_path: &Path,
) -> Result<PathBuf, String> {
    let base_name = sanitize_asset_stem(base_name);
    let primary = assets_dir.join(format!("{base_name}.{extension}"));
    if !primary.exists() {
        return Ok(primary);
    }

    if files_have_same_content(&primary, content_path)? {
        return Ok(primary);
    }

    let fingerprint = short_file_fingerprint(content_path)?;
    for index in 0..1000 {
        let candidate = if index == 0 {
            assets_dir.join(format!("{base_name}-{fingerprint}.{extension}"))
        } else {
            assets_dir.join(format!("{base_name}-{fingerprint}-{index}.{extension}"))
        };

        if !candidate.exists() || files_have_same_content(&candidate, content_path)? {
            return Ok(candidate);
        }
    }

    Err("failed to create a unique image asset name".to_string())
}

fn find_existing_asset_with_same_content(
    assets_dir: &Path,
    content_path: &Path,
) -> Result<Option<PathBuf>, String> {
    let entries = fs::read_dir(assets_dir)
        .map_err(|error| format!("failed to scan .assets folder: {error}"))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("failed to read .assets entry: {error}"))?;
        let path = entry.path();
        if !path.is_file() || is_temp_download_path(&path) || !is_supported_image_asset_path(&path)
        {
            continue;
        }

        if files_have_same_content(&path, content_path)? {
            return Ok(Some(path));
        }
    }

    Ok(None)
}

fn files_have_same_content(left: &Path, right: &Path) -> Result<bool, String> {
    let left_metadata =
        fs::metadata(left).map_err(|error| format!("failed to read image metadata: {error}"))?;
    let right_metadata =
        fs::metadata(right).map_err(|error| format!("failed to read image metadata: {error}"))?;
    if left_metadata.len() != right_metadata.len() {
        return Ok(false);
    }

    let left_bytes = fs::read(left).map_err(|error| format!("failed to read image: {error}"))?;
    let right_bytes = fs::read(right).map_err(|error| format!("failed to read image: {error}"))?;
    Ok(left_bytes == right_bytes)
}

fn short_file_fingerprint(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("failed to fingerprint image: {error}"))?;
    let hash = bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        hash.wrapping_mul(0x100000001b3) ^ u64::from(*byte)
    });
    Ok(format!("{hash:016x}")[..8].to_string())
}

fn image_base_name_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image")
        .to_string()
}

fn image_base_name_from_url(url: &Url) -> String {
    url.path_segments()
        .and_then(|mut segments| segments.next_back())
        .and_then(|segment| {
            let decoded = percent_decode(segment);
            Path::new(&decoded)
                .file_stem()
                .and_then(|value| value.to_str())
                .map(|value| value.to_string())
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "image".to_string())
}

fn sanitize_asset_stem(value: &str) -> String {
    let sanitized: String = value
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else if ch.is_whitespace() {
                '-'
            } else {
                '_'
            }
        })
        .collect();

    let sanitized = sanitized
        .trim_matches(|ch| matches!(ch, '-' | '_' | '.'))
        .to_string();
    if sanitized.is_empty() {
        "image".to_string()
    } else {
        sanitized
    }
}

fn is_temp_download_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|name| name.starts_with(".image_import_") && name.ends_with(".download"))
}

fn is_supported_image_asset_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif"
            )
        })
        .unwrap_or(false)
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
            {
                output.push((high << 4) | low);
                index += 3;
                continue;
            }
        }

        output.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&output).to_string()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn relative_asset_path(target_path: &Path, current_file_path: &Path) -> Result<String, String> {
    let parent = current_file_path
        .parent()
        .ok_or_else(|| "current document does not have a parent folder".to_string())?;
    let relative = target_path
        .strip_prefix(parent)
        .map_err(|error| format!("failed to create relative image path: {error}"))?;
    Ok(format!(
        "./{}",
        relative.to_string_lossy().replace('\\', "/")
    ))
}

fn parse_safe_http_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value.trim()).map_err(|error| format!("invalid image URL: {error}"))?;
    validate_http_url(&url)?;
    Ok(url)
}

fn validate_http_url(url: &Url) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("only http and https image URLs are allowed".to_string());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "image URL does not include a host".to_string())?
        .to_ascii_lowercase();
    if host == "localhost" || host.ends_with(".localhost") {
        return Err("local image URLs are not allowed".to_string());
    }

    if let Ok(address) = host.parse::<IpAddr>() {
        if is_blocked_ip(address) {
            return Err("private or local network image URLs are not allowed".to_string());
        }
    }

    Ok(())
}

fn is_blocked_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => {
            address.is_loopback()
                || address.is_private()
                || address.is_link_local()
                || address.is_broadcast()
                || address.is_unspecified()
        }
        IpAddr::V6(address) => {
            address.is_loopback()
                || address.is_unspecified()
                || address.segments()[0] & 0xfe00 == 0xfc00
                || address.segments()[0] & 0xffc0 == 0xfe80
        }
    }
}

fn emit_image_progress(
    app: &AppHandle,
    id: &str,
    status: &str,
    progress: Option<u8>,
    message: Option<String>,
) {
    let _ = app.emit(
        IMAGE_DOWNLOAD_PROGRESS_EVENT,
        ImageDownloadProgressPayload {
            id: id.to_string(),
            status: status.to_string(),
            progress,
            message,
        },
    );
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

    let is_assets_dir = is_dir && name == ".assets";
    let is_image_asset = is_file
        && is_inside_assets_dir(path)
        && is_supported_image_asset_path(path)
        && !is_temp_download_path(path);

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
    ) || (name.starts_with('.') && !is_known_text_document_path(path) && !is_assets_dir)
    {
        return false;
    }

    is_dir || (is_file && (is_known_text_document_path(path) || is_image_asset))
}

fn is_inside_assets_dir(path: &Path) -> bool {
    path.components()
        .any(|component| component.as_os_str().to_str() == Some(".assets"))
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
