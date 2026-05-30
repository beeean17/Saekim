# Third-Party Licenses and Attributions

This document lists the primary open-source software used by Saekim and the
licenses that apply to those dependencies.

Dependency versions are based on the current lockfiles:

- JavaScript/TypeScript: `package.json`, `pnpm-lock.yaml`
- Rust/Tauri: `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`
- Legacy Python code archived in `private/legacy/pyqt-src/`: historical PyQt/PDF import modules

Transitive dependencies are resolved by the package managers and recorded in the
lockfiles. This document focuses on direct dependencies and bundled assets.

---

## Project License

**Saekim (새김) - Markdown Editor**

- **Project license**: GNU Affero General Public License v3.0 (AGPL-3.0)
- **Copyright**: © 2025-2026 Saekim Contributors
- **License file**: `Licenses/LICENSE`

The current 3.x desktop app is built with Tauri, React, TypeScript, and Rust.
Legacy Python/PyQt source files are archived in `private/legacy/pyqt-src/` and
include PDF import code that references PyMuPDF, which is AGPL-3.0 licensed.

---

## JavaScript / TypeScript Runtime Dependencies

| Package | Version | License | Usage |
| --- | ---: | --- | --- |
| `@fontsource/ibm-plex-sans-kr` | 5.2.8 | OFL-1.1 | IBM Plex Sans KR webfont package |
| `@tauri-apps/api` | 2.11.0 | Apache-2.0 OR MIT | Frontend API bridge for Tauri commands/events |
| `html2canvas` | 1.4.1 | MIT | Render preview DOM to canvas for PDF export |
| `jspdf` | 4.2.1 | MIT | Generate PDF output from rendered preview canvas |
| `katex` | 0.16.47 | MIT | Math rendering in editor helpers, preview, and export |
| `markdown-it` | 14.1.1 | MIT | Markdown parsing/rendering pipeline |
| `markdown-it-katex` | 2.0.3 | MIT | KaTeX syntax integration for Markdown parsing |
| `mermaid` | 11.15.0 | MIT | Mermaid diagram rendering |
| `papaparse` | 5.5.3 | MIT | CSV/TSV parsing for tabular previews |
| `react` | 18.3.1 | MIT | Frontend UI framework |
| `react-dom` | 18.3.1 | MIT | React DOM renderer |
| `shiki` | 3.23.0 | MIT | Code block syntax highlighting |
| `smol-toml` | 1.6.1 | BSD-3-Clause | TOML parsing for structured data previews |
| `yaml` | 2.9.0 | ISC | YAML parsing for structured data/OpenAPI previews |
| `zustand` | 5.0.13 | MIT | Frontend state management |

---

## JavaScript / TypeScript Development Dependencies

| Package | Version | License | Usage |
| --- | ---: | --- | --- |
| `@tauri-apps/cli` | 2.11.2 | Apache-2.0 OR MIT | Tauri development/build CLI |
| `@types/markdown-it` | 14.1.2 | MIT | TypeScript types |
| `@types/papaparse` | 5.5.2 | MIT | TypeScript types |
| `@types/react` | 18.3.28 | MIT | TypeScript types |
| `@types/react-dom` | 18.3.7 | MIT | TypeScript types |
| `@vitejs/plugin-react` | 4.7.0 | MIT | React plugin for Vite |
| `typescript` | 5.9.3 | Apache-2.0 | TypeScript compiler |
| `vite` | 6.4.2 | MIT | Frontend dev server and bundler |

---

## Rust / Tauri Dependencies

| Crate | Version | License | Usage |
| --- | ---: | --- | --- |
| `dirs` | 6.0.0 | MIT OR Apache-2.0 | OS-specific application support/config paths |
| `futures-util` | 0.3.32 | MIT OR Apache-2.0 | Async stream utilities |
| `objc2` | 0.6.4 | MIT | macOS Objective-C interop for document open events |
| `reqwest` | 0.13.3 | MIT OR Apache-2.0 | HTTP client for image download/import workflows |
| `rusqlite` | 0.32.1 | MIT | SQLite-backed metadata/session storage |
| `serde` | 1.0.228 | MIT OR Apache-2.0 | Serialization/deserialization |
| `serde_json` | 1.0.149 | MIT OR Apache-2.0 | JSON serialization/deserialization |
| `tauri` | 2.11.2 | Apache-2.0 OR MIT | Desktop app runtime |
| `tauri-build` | 2.6.2 | Apache-2.0 OR MIT | Tauri build integration |
| `tauri-plugin-dialog` | 2.7.1 | Apache-2.0 OR MIT | Native open/save dialogs |
| `tauri-plugin-opener` | 2.5.4 | Apache-2.0 OR MIT | Open files/URLs with system handlers |
| `tauri-plugin-single-instance` | 2.4.2 | Apache-2.0 OR MIT | Single-instance app behavior and file-open forwarding |
| `url` | 2.5.8 | MIT OR Apache-2.0 | URL parsing and validation |

### Bundled Native Components

| Component | Source | License | Usage |
| --- | --- | --- | --- |
| SQLite | via `rusqlite`/`libsqlite3-sys` bundled feature | Public Domain | Embedded metadata database |

---

## Fonts

| Font | Version / Source | License | Usage |
| --- | --- | --- | --- |
| Pretendard | 1.3.9, bundled in `public/fonts/Pretendard-1.3.9/` | SIL Open Font License 1.1 | Default UI/editor/preview font |
| IBM Plex Sans KR | via `@fontsource/ibm-plex-sans-kr` 5.2.8 | SIL Open Font License 1.1 | Optional Korean font family |

### Pretendard

- **Homepage**: https://cactus.tistory.com/306
- **Repository**: https://github.com/orioncactus/pretendard
- **Copyright**: © 2021 Kil Hyung-jin
- **Full license**: `public/fonts/Pretendard-1.3.9/LICENSE.txt`
- **Reserved Font Name**: Pretendard

### IBM Plex Sans KR

- **Homepage**: https://fontsource.org/fonts/ibm-plex-sans-kr
- **Repository**: https://github.com/IBM/plex
- **License**: SIL Open Font License 1.1

---

## Legacy Python Dependencies

The repository still contains archived legacy Python/PyQt modules under
`private/legacy/pyqt-src/`.
They are not the primary 3.x Tauri runtime, but their source references the
following open-source libraries.

| Package | Version / Requirement | License | Usage |
| --- | --- | --- | --- |
| PyQt6 | >= 6.6.0 | GPL-3.0 or commercial | Legacy desktop UI framework |
| PyQt6-WebEngine | >= 6.6.0 | GPL-3.0 or commercial | Legacy Chromium preview/export webview |
| PyQt6-Frameless-Window | >= 0.3.0 | MIT | Legacy frameless window behavior |
| PyMuPDF | >= 1.24.0 | AGPL-3.0 or commercial | Legacy PDF-to-Markdown import |
| pdfplumber | >= 0.11.0 | MIT | Legacy PDF table extraction fallback |
| Python-Markdown | >= 3.5.0 | BSD-3-Clause | Legacy Markdown-to-HTML conversion fallback |

Legacy source files are archived under `private/legacy/pyqt-src/`, and legacy
package files are archived under `private/legacy/root/pyqt_packaging/`.

---

## License Compatibility Summary

| License | Used by | Notes |
| --- | --- | --- |
| AGPL-3.0 | Saekim, legacy PyMuPDF reference | Strong copyleft; project license remains AGPL-3.0 |
| GPL-3.0 | Legacy PyQt6/PyQt6-WebEngine path | Relevant to legacy Python runtime |
| MIT | React, Mermaid, KaTeX, Shiki, rusqlite, many others | Compatible |
| Apache-2.0 | Tauri dual-license path, TypeScript | Compatible with AGPL-3.0 |
| BSD-3-Clause | `smol-toml`, Python-Markdown | Compatible |
| ISC | `yaml` | Compatible |
| OFL-1.1 | Pretendard, IBM Plex Sans KR | Font license; compatible for bundling |
| Public Domain | SQLite | Compatible |

---

## Full License Texts

- AGPL-3.0: https://www.gnu.org/licenses/agpl-3.0.html
- GPL-3.0: https://www.gnu.org/licenses/gpl-3.0.html
- MIT: https://opensource.org/license/mit/
- Apache-2.0: https://www.apache.org/licenses/LICENSE-2.0
- BSD-3-Clause: https://opensource.org/license/bsd-3-clause/
- ISC: https://opensource.org/license/isc-license-txt/
- SIL Open Font License 1.1: https://scripts.sil.org/OFL
- SQLite public domain notice: https://www.sqlite.org/copyright.html

---

## Contact

- Project Repository: https://github.com/beeean17/Saekim
- Issues: https://github.com/beeean17/Saekim/issues

---

**Last Updated**: May 30, 2026
