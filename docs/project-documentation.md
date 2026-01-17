# Saekim Project Documentation

> **Documentation generated for macOS support analysis**  
> **Date**: 2026-01-17

---

## Executive Summary

**Saekim** (새김) is a **local-first Markdown editor** built with Python and PyQt6, targeting developers and students who need a privacy-focused, offline-capable document editing environment.

| Attribute | Value |
|-----------|-------|
| **Language** | Python 3.10+ |
| **GUI Framework** | PyQt6 6.6.0+ with PyQt6-WebEngine |
| **Primary Platform** | Windows (exclusive platform code) |
| **Target Platforms** | Windows, macOS, Linux |
| **Packaging** | PyInstaller (Windows .exe only) |
| **License** | AGPL-3.0 |

---

## Technology Stack

### Core Dependencies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **GUI** | PyQt6 | ≥6.6.0 | Desktop application framework |
| **WebView** | PyQt6-WebEngine | ≥6.6.0 | Embedded Chromium for preview |
| **PDF Conversion** | Playwright | ≥1.40.0 | Markdown → PDF (via Chromium) |
| **PDF Processing** | PyMuPDF | ≥1.24.0 | PDF → Markdown extraction |
| **PDF Text** | pdfplumber | ≥0.11.0 | PDF text extraction |
| **Markdown** | Markdown | ≥3.5.0 | Python markdown processing |

### Frontend Libraries (WebView)

| Library | Version | Purpose |
|---------|---------|---------|
| Highlight.js | 11.9.0 | Code syntax highlighting (9 languages) |
| Mermaid.js | 10.6.1 | Diagram rendering (9 diagram types) |
| KaTeX | 0.16.9 | LaTeX math equation rendering |
| Marked.js | - | Markdown parsing |

---

## Architecture Overview

```
Saekim/
├── src/
│   ├── main.py                 # Application entry point ⚠️ Windows-specific
│   ├── backend/
│   │   ├── api.py              # BackendAPI (QWebChannel bridge)
│   │   ├── converter.py        # PDF ↔ Markdown converter
│   │   ├── file_manager.py     # File I/O operations
│   │   ├── session_manager.py  # Session persistence
│   │   └── tab_manager.py      # Multi-tab state management
│   ├── windows/
│   │   ├── main_window.py      # Main window ⚠️ Heavy Windows-specific
│   │   ├── title_bar.py        # Custom title bar (cross-platform PyQt6)
│   │   ├── menu_bar.py         # Menu bar
│   │   ├── file_explorer.py    # File tree sidebar
│   │   └── dialogs/            # Settings, License, Update dialogs
│   ├── ui/                     # HTML/CSS/JS for WebView
│   │   ├── index.html          # Main editor HTML
│   │   ├── welcome.html        # Welcome screen
│   │   ├── js/                 # JavaScript modules
│   │   └── css/                # Theme CSS files
│   ├── utils/
│   │   ├── theme_manager.py    # Theme management
│   │   ├── design_manager.py   # Icons and design assets
│   │   ├── logger.py           # Logging utilities
│   │   └── update_manager.py   # Update checking
│   └── resources/
│       ├── themes/             # QSS theme files
│       ├── fonts/              # Pretendard font bundle
│       ├── icons/              # SVG icons
│       └── html/               # HTML templates
├── requirements.txt
├── saekim.spec                 # PyInstaller spec ⚠️ Windows paths
├── build_installer.bat         # Windows batch script
└── installer.iss               # Inno Setup script (Windows)
```

---

## Platform-Specific Code Analysis

### ⚠️ Windows-Only Code (Requires macOS Adaptation)

#### 1. `src/main.py` - Application Entry Point

```python
# Lines 15-17: GTK warning suppression (Windows-only)
if sys.platform == 'win32':
    os.environ['G_MESSAGES_DEBUG'] = ''

# Lines 32-38: DPI awareness (Windows ctypes.windll)
if sys.platform == 'win32':
    from ctypes import windll
    windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE

# Lines 48-54: AppUserModelID for taskbar grouping
if sys.platform == 'win32':
    from ctypes import windll
    windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
```

#### 2. `src/windows/main_window.py` - Critical Windows Integration

| Function | Lines | Windows API | Purpose |
|----------|-------|-------------|---------|
| `_apply_native_window_styles()` | 204-235 | `ctypes.windll.user32.GetWindowLongW/SetWindowLongW/SetWindowPos` | Enable Aero Snap while keeping frameless look |
| `nativeEvent()` | 237-360 | `WM_NCCALCSIZE`, `WM_NCHITTEST` | Custom hit-testing for resizing, window chrome |
| Monitor handling | 264-276 | `MonitorFromWindow`, `GetMonitorInfoW` | Multi-monitor DPI awareness |

**Key Issue**: The `nativeEvent()` method is ~120 lines of Windows-specific code handling:
- Border hit testing (HTLEFT, HTRIGHT, HTTOP, HTBOTTOM, etc.)
- Title bar dragging (HTCAPTION)
- Maximize behavior
- Multi-monitor coordination

#### 3. `saekim.spec` - PyInstaller Configuration

```python
# Line 12: Windows-specific Playwright path
datas=[
    ('C:/Users/yoons/AppData/Local/ms-playwright/chromium-1200', 'ms-playwright/chromium-1200'),
]
```

---

## macOS Adaptation Requirements

### High Priority

| Area | Current State | macOS Requirement |
|------|---------------|-------------------|
| **Window Frame** | Custom Windows Aero Snap via ctypes | Use native macOS window or implement NSWindow integration |
| **DPI Handling** | `windll.shcore.SetProcessDpiAwareness` | PyQt6 handles Retina automatically; may need `QHighDpiScaling` |
| **Taskbar/Dock** | `SetCurrentProcessExplicitAppUserModelID` | macOS Dock integration via PyQt6 or PyObjC |
| **Packaging** | PyInstaller `.exe` with Inno Setup | PyInstaller `.app` bundle or py2app |

### Medium Priority

| Area | Current State | macOS Requirement |
|------|---------------|-------------------|
| **Playwright Path** | Windows-specific in .spec | macOS Chromium path resolution |
| **Font Path** | Works cross-platform | Verify Pretendard loads on macOS |
| **File Paths** | Uses `Path` (cross-platform) | Already compatible |
| **Menu Bar** | Disabled (custom title bar) | Consider native macOS menu bar |

### Low Priority / Already Compatible

| Area | Notes |
|------|-------|
| **Backend Logic** | `api.py`, `converter.py`, `file_manager.py` - Platform agnostic |
| **Session Management** | Uses `~/.saekim/` which works on macOS |
| **WebView Content** | HTML/CSS/JS is fully cross-platform |
| **Theme System** | QSS-based, cross-platform |

---

## Key Files for macOS Support Implementation

1. **`src/main.py`** - Add `sys.platform == 'darwin'` branches
2. **`src/windows/main_window.py`** - Major refactoring needed for `nativeEvent()`
3. **`saekim.spec`** - Create macOS-specific spec or add conditionals
4. **New file needed**: `build_installer_macos.sh` or use py2app
5. **New file needed**: macOS-specific native event handling (optional, can use standard window chrome)

---

## Dependencies Compatibility Status

| Package | Windows | macOS | Notes |
|---------|---------|-------|-------|
| PyQt6 | ✅ | ✅ | Fully supported |
| PyQt6-WebEngine | ✅ | ✅ | Requires macOS 10.14+ |
| Playwright | ✅ | ✅ | Auto-downloads Chromium per platform |
| PyMuPDF | ✅ | ✅ | Fully supported |
| pdfplumber | ✅ | ✅ | Pure Python |
| Markdown | ✅ | ✅ | Pure Python |

---

## Recommended Implementation Strategy

### Phase 1: Basic macOS Support
1. Add `sys.platform == 'darwin'` guards in `main.py`
2. Use standard window frame (remove frameless requirement) or implement macOS-native title bar
3. Create macOS PyInstaller spec file
4. Test Playwright browser installation on macOS

### Phase 2: Native macOS Experience
1. Implement native macOS window chrome using PyObjC (optional)
2. Add macOS menu bar integration
3. Support macOS keyboard shortcuts (Cmd instead of Ctrl)
4. Dock icon and badging

### Phase 3: Polish
1. Code signing for Gatekeeper
2. DMG installer creation
3. Notarization for macOS 10.15+
