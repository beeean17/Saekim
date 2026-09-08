use std::{fs, io::Read, path::Path};

use serde::{Deserialize, Serialize};

pub(crate) const MAX_TEXT_FILE_BYTES: u64 = 20 * 1024 * 1024;
const SNIFF_BYTES: usize = 8192;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum TextEncoding {
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-8-bom")]
    Utf8Bom,
    #[serde(rename = "utf-16le")]
    Utf16Le,
    #[serde(rename = "utf-16be")]
    Utf16Be,
}

#[derive(Debug)]
pub(crate) struct DecodedText {
    pub(crate) content: String,
    pub(crate) encoding: TextEncoding,
}

pub(crate) const TEXT_DIALOG_EXTENSIONS: &[&str] = &[
    "md", "markdown", "mdown", "mkd", "txt", "log", "html", "htm", "json", "yml", "yaml", "toml",
    "env", "css", "js", "jsx", "ts", "tsx", "xml", "csv", "tsv", "ini", "conf", "config", "sql",
    "sh", "bash", "zsh", "fish", "py", "rs", "go", "java", "c", "h", "cpp", "hpp", "cs", "rb",
    "php", "swift", "kt", "kts",
];

const TEXT_FILE_NAMES: &[&str] = &[
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".gitignore",
    ".gitattributes",
    ".npmrc",
    ".nvmrc",
    "dockerfile",
    "makefile",
    "readme",
    "license",
    "changelog",
];

const BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "icns", "avif", "heic", "heif", "tif",
    "tiff", "mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "flac", "aac", "ogg", "zip", "gz",
    "tar", "tgz", "bz2", "xz", "7z", "rar", "dmg", "pkg", "app", "exe", "dll", "dylib", "so",
    "bin", "pdf", "woff", "woff2", "ttf", "otf", "eot", "wasm", "class", "jar", "sqlite",
    "sqlite3", "db",
];

pub(crate) fn is_supported_document_path(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };

    if !metadata.is_file() || metadata.len() > MAX_TEXT_FILE_BYTES || is_known_binary_path(path) {
        return false;
    }

    is_known_text_document_path(path) || is_probably_text_file(path).unwrap_or(false)
}

pub(crate) fn is_known_text_document_path(path: &Path) -> bool {
    if let Some(name) = path.file_name().and_then(|value| value.to_str()) {
        let normalized = name.to_ascii_lowercase();
        if TEXT_FILE_NAMES.contains(&normalized.as_str()) {
            return true;
        }
    }

    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            let normalized = extension.to_ascii_lowercase();
            TEXT_DIALOG_EXTENSIONS.contains(&normalized.as_str())
        })
        .unwrap_or(false)
}

#[cfg_attr(target_os = "android", allow(dead_code))]
pub(crate) fn read_text_file(path: &Path) -> Result<DecodedText, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("failed to read metadata: {error}"))?;
    if !metadata.is_file() {
        return Err("selected path is not a file".to_string());
    }

    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err(format!(
            "file is too large to open as text (limit: {} MB)",
            MAX_TEXT_FILE_BYTES / 1024 / 1024
        ));
    }

    if is_known_binary_path(path) {
        return Err("binary file type is not supported".to_string());
    }

    let bytes = fs::read(path).map_err(|error| format!("failed to read file: {error}"))?;
    decode_text_bytes(bytes)
}

fn is_probably_text_file(path: &Path) -> Result<bool, String> {
    let mut file = fs::File::open(path).map_err(|error| format!("failed to open file: {error}"))?;
    let mut buffer = vec![0; SNIFF_BYTES];
    let read = file
        .read(&mut buffer)
        .map_err(|error| format!("failed to inspect file: {error}"))?;
    buffer.truncate(read);

    if buffer.is_empty() {
        return Ok(true);
    }

    Ok(!is_binary_like(&buffer) && decode_text_bytes(buffer).is_ok())
}

fn is_known_binary_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            let normalized = extension.to_ascii_lowercase();
            BINARY_EXTENSIONS.contains(&normalized.as_str())
        })
        .unwrap_or(false)
}

pub(crate) fn decode_text_bytes(bytes: Vec<u8>) -> Result<DecodedText, String> {
    if bytes.is_empty() {
        return Ok(DecodedText {
            content: String::new(),
            encoding: TextEncoding::Utf8,
        });
    }

    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let content = String::from_utf8(bytes[3..].to_vec())
            .map_err(|error| format!("file is not valid UTF-8 text: {error}"))?;
        return Ok(DecodedText {
            content,
            encoding: TextEncoding::Utf8Bom,
        });
    }

    if bytes.starts_with(&[0xFF, 0xFE]) {
        return decode_utf16(&bytes[2..], true).map(|content| DecodedText {
            content,
            encoding: TextEncoding::Utf16Le,
        });
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return decode_utf16(&bytes[2..], false).map(|content| DecodedText {
            content,
            encoding: TextEncoding::Utf16Be,
        });
    }

    if is_binary_like(&bytes) {
        return Err("file appears to be binary".to_string());
    }

    let content = String::from_utf8(bytes)
        .map_err(|error| format!("file is not valid UTF-8 text: {error}"))?;
    Ok(DecodedText {
        content,
        encoding: TextEncoding::Utf8,
    })
}

pub(crate) fn encode_text_content(content: &str, encoding: TextEncoding) -> Vec<u8> {
    match encoding {
        TextEncoding::Utf8 => content.as_bytes().to_vec(),
        TextEncoding::Utf8Bom => {
            let mut bytes = Vec::with_capacity(content.len() + 3);
            bytes.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            bytes.extend_from_slice(content.as_bytes());
            bytes
        }
        TextEncoding::Utf16Le | TextEncoding::Utf16Be => {
            let mut bytes = Vec::with_capacity(content.len() * 2 + 2);
            bytes.extend_from_slice(if encoding == TextEncoding::Utf16Le {
                &[0xFF, 0xFE]
            } else {
                &[0xFE, 0xFF]
            });
            for unit in content.encode_utf16() {
                let encoded = if encoding == TextEncoding::Utf16Le {
                    unit.to_le_bytes()
                } else {
                    unit.to_be_bytes()
                };
                bytes.extend_from_slice(&encoded);
            }
            bytes
        }
    }
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> Result<String, String> {
    if bytes.len() % 2 != 0 {
        return Err("UTF-16 text has an incomplete trailing byte".to_string());
    }

    let units = bytes
        .chunks_exact(2)
        .map(|chunk| {
            if little_endian {
                u16::from_le_bytes([chunk[0], chunk[1]])
            } else {
                u16::from_be_bytes([chunk[0], chunk[1]])
            }
        })
        .collect::<Vec<_>>();

    String::from_utf16(&units).map_err(|error| format!("file is not valid UTF-16 text: {error}"))
}

fn is_binary_like(bytes: &[u8]) -> bool {
    if bytes.contains(&0) {
        return true;
    }

    let control_count = bytes
        .iter()
        .filter(|byte| matches!(**byte, 0x01..=0x08 | 0x0B | 0x0E..=0x1F | 0x7F))
        .count();

    control_count * 100 > bytes.len() * 30
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn recognizes_known_text_extensions_and_names() {
        assert!(is_known_text_document_path(Path::new("index.html")));
        assert!(is_known_text_document_path(Path::new("config.toml")));
        assert!(is_known_text_document_path(Path::new(".env")));
        assert!(is_known_text_document_path(Path::new("Dockerfile")));
    }

    #[test]
    fn decodes_utf8_bom() {
        let decoded = decode_text_bytes(vec![0xEF, 0xBB, 0xBF, b'h', b'i']).unwrap();
        assert_eq!(decoded.content, "hi");
        assert_eq!(decoded.encoding, TextEncoding::Utf8Bom);
    }

    #[test]
    fn round_trips_supported_text_encodings() {
        let content = "hello 한글 👋";
        for encoding in [
            TextEncoding::Utf8,
            TextEncoding::Utf8Bom,
            TextEncoding::Utf16Le,
            TextEncoding::Utf16Be,
        ] {
            let decoded = decode_text_bytes(encode_text_content(content, encoding)).unwrap();
            assert_eq!(decoded.content, content);
            assert_eq!(decoded.encoding, encoding);
        }
    }

    #[test]
    fn rejects_binary_like_bytes() {
        let error = decode_text_bytes(vec![0, 1, 2, 3]).unwrap_err();
        assert!(error.contains("binary"));
    }

    #[test]
    fn accepts_unknown_extension_when_content_is_text() {
        let path = temp_path("custom.saekimtest");
        fs::write(&path, "custom text").unwrap();

        assert!(is_supported_document_path(&path));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_known_binary_extensions() {
        let path = temp_path("image.png");
        fs::write(&path, "plain text but image extension").unwrap();

        assert!(!is_supported_document_path(&path));

        let _ = fs::remove_file(path);
    }

    fn temp_path(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        env::temp_dir().join(format!("saekim-{timestamp}-{name}"))
    }
}
