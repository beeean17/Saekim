use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativePdfExportPayload {
    status: &'static str,
    path: Option<String>,
}

impl NativePdfExportPayload {
    fn saved(path: String) -> Self {
        Self {
            status: "saved",
            path: Some(path),
        }
    }

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
    window: tauri::WebviewWindow,
    path: String,
    content_width: f64,
    content_height: f64,
) -> Result<NativePdfExportPayload, String> {
    use block2::RcBlock;
    use objc2::{msg_send, sel, MainThreadMarker};
    use objc2_foundation::{NSData, NSError, NSPoint, NSRect, NSSize};
    use objc2_web_kit::{WKPDFConfiguration, WKWebView};
    use std::{ptr::NonNull, sync::mpsc, time::Duration};

    let (sender, receiver) = mpsc::channel::<Result<Option<Vec<u8>>, String>>();
    window
        .with_webview(move |platform_webview| unsafe {
            let webview = &*(platform_webview.inner().cast::<WKWebView>());
            let supported: bool = msg_send![
                webview,
                respondsToSelector: sel!(createPDFWithConfiguration:completionHandler:)
            ];

            if !supported {
                let _ = sender.send(Ok(None));
                return;
            }

            let configuration = WKPDFConfiguration::new(MainThreadMarker::new_unchecked());
            configuration.setRect(NSRect::new(
                NSPoint::ZERO,
                NSSize::new(content_width.max(1.0), content_height.max(1.0)),
            ));

            let completion = RcBlock::new(move |data: *mut NSData, error: *mut NSError| {
                let result = if !data.is_null() {
                    let data = &*data;
                    let length = data.length();
                    let mut bytes = vec![0_u8; length];
                    if let Some(buffer) = NonNull::new(bytes.as_mut_ptr().cast()) {
                        data.getBytes_length(buffer, length);
                    }
                    Ok(Some(bytes))
                } else if !error.is_null() {
                    Err((&*error).localizedDescription().to_string())
                } else {
                    Err("WKWebView returned neither PDF data nor an error".to_string())
                };
                let _ = sender.send(result);
            });

            webview.createPDFWithConfiguration_completionHandler(Some(&configuration), &completion);
        })
        .map_err(|error| error.to_string())?;

    let native_pdf = tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(30))
            .map_err(|error| format!("timed out waiting for WKWebView PDF: {error}"))?
    })
    .await
    .map_err(|error| error.to_string())??;

    let Some(pdf_bytes) = native_pdf else {
        return Ok(NativePdfExportPayload::unsupported());
    };

    std::fs::write(&path, pdf_bytes).map_err(|error| error.to_string())?;
    Ok(NativePdfExportPayload::saved(path))
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
