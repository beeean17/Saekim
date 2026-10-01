use std::sync::atomic::Ordering;

use tauri::Manager;
use tauri_plugin_dialog::{
    DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult,
};

use crate::app_state::AppState;

#[cfg(target_os = "macos")]
use objc2::{
    msg_send,
    runtime::{AnyClass, AnyObject},
};
#[cfg(target_os = "macos")]
use std::ffi::CString;

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
pub fn set_window_document_state(
    window: tauri::WebviewWindow,
    title: String,
    edited: bool,
    document_path: Option<String>,
) -> Result<(), String> {
    window
        .set_title(&title)
        .map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    {
        let represented_path = document_path.and_then(|path| CString::new(path).ok());
        window
            .with_webview(move |webview| unsafe {
                let ns_window = webview.ns_window().cast::<AnyObject>();
                let _: () = msg_send![ns_window, setDocumentEdited: edited];

                let represented_url: *mut AnyObject = represented_path
                    .as_ref()
                    .and_then(|path| {
                        let string_class = AnyClass::get(c"NSString")?;
                        let url_class = AnyClass::get(c"NSURL")?;
                        let ns_path: *mut AnyObject =
                            msg_send![string_class, stringWithUTF8String: path.as_ptr()];
                        if ns_path.is_null() {
                            return None;
                        }
                        Some(msg_send![url_class, fileURLWithPath: ns_path])
                    })
                    .unwrap_or(std::ptr::null_mut());
                let _: () = msg_send![ns_window, setRepresentedURL: represented_url];
            })
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    let _ = (edited, document_path);

    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
pub fn set_window_document_state(
    _window: tauri::WebviewWindow,
    _title: String,
    _edited: bool,
    _document_path: Option<String>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn confirm_unsaved_changes(
    app: tauri::AppHandle,
    window: tauri::Window,
    file_names: Vec<String>,
) -> Result<String, String> {
    let file_list = file_names
        .iter()
        .map(|name| format!("• {name}"))
        .collect::<Vec<_>>()
        .join("\n");
    let message =
        format!("저장되지 않은 변경사항이 있습니다:\n\n{file_list}\n\n닫기 전에 저장할까요?");
    let dialog = app
        .dialog()
        .message(message)
        .title("저장되지 않은 변경사항")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::YesNoCancelCustom(
            "저장".to_string(),
            "저장 안 함".to_string(),
            "취소".to_string(),
        ));
    #[cfg(desktop)]
    let dialog = dialog.parent(&window);

    let result = tauri::async_runtime::spawn_blocking(move || dialog.blocking_show_with_result())
        .await
        .map_err(|error| error.to_string())?;

    Ok(match result {
        MessageDialogResult::Yes | MessageDialogResult::Ok => "save",
        MessageDialogResult::No => "discard",
        MessageDialogResult::Custom(label) if label == "저장" => "save",
        MessageDialogResult::Custom(label) if label == "저장 안 함" => "discard",
        _ => "cancel",
    }
    .to_string())
}

#[tauri::command]
pub fn respond_to_close_request(
    app: tauri::AppHandle,
    window: tauri::Window,
    reason: String,
    approved: bool,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    match reason.as_str() {
        "window" => {
            if approved {
                state
                    .approved_close_windows
                    .lock()
                    .map_err(|_| "close approval state is unavailable".to_string())?
                    .insert(window.label().to_string());
                window.close().map_err(|error| error.to_string())?;
            }
        }
        "app" => {
            let should_exit = {
                let mut pending = state
                    .pending_exit_windows
                    .lock()
                    .map_err(|_| "exit approval state is unavailable".to_string())?;
                let Some(window_labels) = pending.as_mut() else {
                    return Ok(());
                };

                if !approved {
                    *pending = None;
                    false
                } else {
                    window_labels.remove(window.label());
                    let all_approved = window_labels.is_empty();
                    if all_approved {
                        *pending = None;
                    }
                    all_approved
                }
            };

            if should_exit {
                state.app_exit_approved.store(true, Ordering::SeqCst);
                app.exit(0);
            }
        }
        _ => return Err(format!("unsupported close request reason: {reason}")),
    }

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
    let label = next_window_label(&app);
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

#[cfg(desktop)]
fn next_window_label(app: &tauri::AppHandle) -> String {
    let windows = app.webview_windows();
    let mut index = 1;

    loop {
        let label = format!("window{index}");
        if !windows.contains_key(&label) {
            return label;
        }
        index += 1;
    }
}
