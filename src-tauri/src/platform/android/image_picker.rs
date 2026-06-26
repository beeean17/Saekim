use serde::Deserialize;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    AppHandle, Manager, Runtime, Wry,
};

use crate::commands::file::ImagePickPayload;

const PLUGIN_IDENTIFIER: &str = "com.beeean17.saekim";

pub struct AndroidImagePicker<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("saekim-android-image-picker")
        .setup(|app, api| {
            let handle =
                api.register_android_plugin(PLUGIN_IDENTIFIER, "AndroidImagePickerPlugin")?;
            app.manage(AndroidImagePicker(handle));
            Ok(())
        })
        .build()
}

pub async fn pick_image_path(app: &AppHandle) -> Result<Option<ImagePickPayload>, String> {
    let picker = app
        .try_state::<AndroidImagePicker<Wry>>()
        .ok_or_else(|| "Android image picker plugin is not available".to_string())?;
    picker.pick_image_path().await
}

impl<R: Runtime> AndroidImagePicker<R> {
    async fn pick_image_path(&self) -> Result<Option<ImagePickPayload>, String> {
        self.0
            .run_mobile_plugin_async::<AndroidImagePickResponse>("pickImage", ())
            .await
            .map(AndroidImagePickResponse::into_payload)
            .map_err(|error| error.to_string())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidImagePickResponse {
    path: Option<String>,
    name: Option<String>,
    display_path: Option<String>,
}

impl AndroidImagePickResponse {
    fn into_payload(self) -> Option<ImagePickPayload> {
        let path = self.path?;
        let name = self.name?;
        Some(ImagePickPayload {
            path,
            name,
            display_path: self.display_path,
        })
    }
}
