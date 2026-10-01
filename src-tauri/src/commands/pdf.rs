use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativePdfExportPayload {
    status: &'static str,
    path: Option<String>,
}

impl NativePdfExportPayload {
    #[cfg(target_os = "windows")]
    fn saved(path: String) -> Self {
        Self {
            status: "saved",
            path: Some(path),
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn unsupported() -> Self {
        Self {
            status: "unsupported",
            path: None,
        }
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn print_webview_pdf(
    _window: tauri::WebviewWindow,
    _path: String,
    _content_width: f64,
    _content_height: f64,
) -> Result<NativePdfExportPayload, String> {
    // WKWebView createPDF only captures a rectangle inside the live view bounds. The prepared
    // A4 export surface is taller than the app viewport, so treating that API as a full-document
    // printer creates a formally valid but blank PDF. Let the frontend use its paginated fallback
    // until macOS has a dedicated off-screen print webview.
    Ok(NativePdfExportPayload::unsupported())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn print_webview_pdf(
    window: tauri::WebviewWindow,
    path: String,
    _content_width: f64,
    _content_height: f64,
) -> Result<NativePdfExportPayload, String> {
    use std::{os::windows::ffi::OsStrExt, sync::mpsc, time::Duration};
    use webview2_com::{
        Microsoft::Web::WebView2::Win32::{ICoreWebView2PrintSettings, ICoreWebView2_7},
        PrintToPdfCompletedHandler,
    };
    use windows::core::{Interface, PCWSTR};

    let output_path = path.clone();
    let (sender, receiver) = mpsc::channel::<Result<bool, String>>();
    window
        .with_webview(move |platform_webview| unsafe {
            let completion_sender = sender.clone();
            let result = (|| -> windows::core::Result<()> {
                let core_webview = platform_webview.controller().CoreWebView2()?;
                let printable: ICoreWebView2_7 = core_webview.cast()?;
                let wide_path = std::ffi::OsStr::new(&output_path)
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect::<Vec<_>>();
                let completed = PrintToPdfCompletedHandler::create(Box::new(
                    move |operation_result, success| {
                        let result = operation_result
                            .map(|()| success)
                            .map_err(|error| error.to_string());
                        let _ = completion_sender.send(result);
                        Ok(())
                    },
                ));

                printable.PrintToPdf(
                    PCWSTR(wide_path.as_ptr()),
                    None::<&ICoreWebView2PrintSettings>,
                    &completed,
                )
            })();

            if let Err(error) = result {
                let _ = sender.send(Err(error.to_string()));
            }
        })
        .map_err(|error| error.to_string())?;

    let saved = tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(30))
            .map_err(|error| format!("timed out waiting for WebView2 PDF: {error}"))?
    })
    .await
    .map_err(|error| error.to_string())??;

    if !saved {
        return Err("WebView2 did not create the PDF file".to_string());
    }

    Ok(NativePdfExportPayload::saved(path))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
#[tauri::command]
pub async fn print_webview_pdf(
    _window: tauri::WebviewWindow,
    _path: String,
    _content_width: f64,
    _content_height: f64,
) -> Result<NativePdfExportPayload, String> {
    Ok(NativePdfExportPayload::unsupported())
}
