use base64::Engine as _;
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime, Wry,
};

use crate::commands::file::{FileTreeNode, FolderPayload};

const PLUGIN_IDENTIFIER: &str = "com.beeean17.saekim";

pub struct AndroidDocumentMetadata<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("saekim-android-document-metadata")
        .setup(|app, api| {
            let handle =
                api.register_android_plugin(PLUGIN_IDENTIFIER, "AndroidDocumentMetadataPlugin")?;
            app.manage(AndroidDocumentMetadata(handle));
            Ok(())
        })
        .build()
}

pub fn display_name(app: &AppHandle, uri: &str) -> Option<String> {
    app.try_state::<AndroidDocumentMetadata<Wry>>()
        .and_then(|metadata| metadata.display_name(uri))
}

pub async fn open_folder_dialog(app: &AppHandle) -> Result<Option<String>, String> {
    let metadata = app
        .try_state::<AndroidDocumentMetadata<Wry>>()
        .ok_or_else(|| "Android document metadata plugin is not available".to_string())?;
    metadata.open_folder_dialog().await
}

pub fn read_folder(app: &AppHandle, uri: &str) -> Result<FolderPayload, String> {
    let metadata = app
        .try_state::<AndroidDocumentMetadata<Wry>>()
        .ok_or_else(|| "Android document metadata plugin is not available".to_string())?;
    metadata.read_folder(uri)
}

pub fn read_folder_children(app: &AppHandle, uri: &str) -> Result<Vec<FileTreeNode>, String> {
    let metadata = app
        .try_state::<AndroidDocumentMetadata<Wry>>()
        .ok_or_else(|| "Android document metadata plugin is not available".to_string())?;
    metadata.read_folder_children(uri)
}

pub fn copy_image_to_assets(
    app: &AppHandle,
    source_uri: &str,
    current_file_uri: &str,
) -> Result<String, String> {
    let metadata = app
        .try_state::<AndroidDocumentMetadata<Wry>>()
        .ok_or_else(|| "Android document metadata plugin is not available".to_string())?;
    metadata.copy_image_to_assets(source_uri, current_file_uri)
}

pub fn import_image_bytes_to_assets(
    app: &AppHandle,
    bytes: Vec<u8>,
    file_name: Option<String>,
    mime_type: Option<String>,
    current_file_uri: &str,
) -> Result<String, String> {
    let metadata = app
        .try_state::<AndroidDocumentMetadata<Wry>>()
        .ok_or_else(|| "Android document metadata plugin is not available".to_string())?;
    metadata.import_image_bytes_to_assets(bytes, file_name, mime_type, current_file_uri)
}

impl<R: Runtime> AndroidDocumentMetadata<R> {
    fn display_name(&self, uri: &str) -> Option<String> {
        self.0
            .run_mobile_plugin::<DisplayNameResponse>(
                "getDisplayName",
                DisplayNamePayload {
                    uri: uri.to_string(),
                },
            )
            .ok()
            .and_then(|response| response.display_name)
            .map(|name| name.trim().to_string())
            .filter(|name| !name.is_empty())
    }

    async fn open_folder_dialog(&self) -> Result<Option<String>, String> {
        self.0
            .run_mobile_plugin_async::<OpenFolderResponse>("openFolder", ())
            .await
            .map(|response| response.uri)
            .map_err(|error| error.to_string())
    }

    fn read_folder(&self, uri: &str) -> Result<FolderPayload, String> {
        self.0
            .run_mobile_plugin::<FolderPayload>(
                "readFolder",
                FolderListPayload {
                    uri: uri.to_string(),
                    depth: 2,
                },
            )
            .map_err(|error| error.to_string())
    }

    fn read_folder_children(&self, uri: &str) -> Result<Vec<FileTreeNode>, String> {
        self.0
            .run_mobile_plugin::<FolderChildrenResponse>(
                "readFolderChildren",
                FolderListPayload {
                    uri: uri.to_string(),
                    depth: 0,
                },
            )
            .map(|response| response.tree)
            .map_err(|error| error.to_string())
    }

    fn copy_image_to_assets(
        &self,
        source_uri: &str,
        current_file_uri: &str,
    ) -> Result<String, String> {
        self.0
            .run_mobile_plugin::<ImageAssetResponse>(
                "copyImageToAssets",
                CopyImageToAssetsPayload {
                    source_uri: source_uri.to_string(),
                    current_file_uri: current_file_uri.to_string(),
                },
            )
            .map(|response| response.path)
            .map_err(|error| error.to_string())
    }

    fn import_image_bytes_to_assets(
        &self,
        bytes: Vec<u8>,
        file_name: Option<String>,
        mime_type: Option<String>,
        current_file_uri: &str,
    ) -> Result<String, String> {
        self.0
            .run_mobile_plugin::<ImageAssetResponse>(
                "importImageBytesToAssets",
                ImportImageBytesToAssetsPayload {
                    data: base64::engine::general_purpose::STANDARD.encode(bytes),
                    file_name,
                    mime_type,
                    current_file_uri: current_file_uri.to_string(),
                },
            )
            .map(|response| response.path)
            .map_err(|error| error.to_string())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DisplayNamePayload {
    uri: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DisplayNameResponse {
    display_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenFolderResponse {
    uri: Option<String>,
    #[allow(dead_code)]
    display_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderListPayload {
    uri: String,
    depth: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FolderChildrenResponse {
    tree: Vec<FileTreeNode>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CopyImageToAssetsPayload {
    source_uri: String,
    current_file_uri: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportImageBytesToAssetsPayload {
    data: String,
    file_name: Option<String>,
    mime_type: Option<String>,
    current_file_uri: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImageAssetResponse {
    path: String,
}
