# macOS Support Technical Research

> **Research Date**: 2026-01-17  
> **Purpose**: Technical requirements and solutions for adding macOS support to Saekim

---

## 1. Frameless Window Support on macOS

### Current Problem
Saekim uses a custom frameless window with Windows-specific `ctypes.windll` APIs for:
- Aero Snap support (`WS_CAPTION`, `WS_THICKFRAME`)
- Border hit testing (`WM_NCHITTEST`)
- Window resizing and dragging

### Recommended Solution: `PyQt6-Frameless-Window`

**Library**: [PyQt6-Frameless-Window](https://pypi.org/project/PyQt6-Frameless-Window/)

| Feature | Support |
|---------|---------|
| Cross-platform | ✅ Windows, macOS, Linux |
| Window moving | ✅ |
| Window resizing | ✅ |
| Native shadows | ✅ |
| Aero Snap (Windows) | ✅ |
| macOS blur effects | ✅ |

**Installation**:
```bash
pip install PyQt6-Frameless-Window
# Automatically installs pyobjc as dependency on macOS
```

**Usage Example**:
```python
from qframelesswindow import FramelessMainWindow

class MainWindow(FramelessMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Saekim")
        # Custom title bar setup
        self.setTitleBar(CustomTitleBar(self))
```

### Alternative: Native Window with Custom Toolbar

If custom frameless window is not required, use Qt's built-in macOS support:

```python
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        # Enable unified title bar and toolbar
        self.setUnifiedTitleAndToolBarOnMac(True)
```

---

## 2. macOS Packaging with PyInstaller

### Requirements

| Requirement | Details |
|-------------|---------|
| **Xcode** | Install from Mac App Store |
| **Developer ID** | Apple Developer Program membership ($99/year) |
| **Certificates** | Developer ID Application + Developer ID Installer |

### PyInstaller macOS Spec File

```python
# saekim_macos.spec
import sys
from pathlib import Path

a = Analysis(
    ['src/main.py'],
    pathex=['src'],
    datas=[
        ('src/ui', 'ui'),
        ('src/resources', 'resources'),
    ],
    hiddenimports=[
        'PyQt6.QtWebEngine',
        'PyQt6.QtWebEngineCore', 
        'PyQt6.QtWebEngineWidgets'
    ],
    excludes=['torch', 'numpy', 'pandas'],
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    [],
    name='Saekim',
    debug=False,
    console=False,
    # macOS specific
    target_arch='universal2',  # Support Intel and Apple Silicon
)

# macOS App Bundle
app = BUNDLE(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='Saekim.app',
    icon='src/resources/icons/app_icon.icns',
    bundle_identifier='com.beeean17.saekim',
    info_plist={
        'CFBundleShortVersionString': '1.2.0',
        'CFBundleVersion': '1.2.0',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '10.14.0',
    },
)
```

### Code Signing

```bash
# Sign the app bundle
codesign --deep --force --verify --verbose \
    --sign "Developer ID Application: YOUR NAME (TEAM_ID)" \
    --options runtime \
    --entitlements entitlements.plist \
    dist/Saekim.app
```

**Required Entitlements** (`entitlements.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

### Notarization

```bash
# Create ZIP for notarization
ditto -c -k --keepParent dist/Saekim.app Saekim.zip

# Submit for notarization
xcrun notarytool submit Saekim.zip \
    --apple-id "your@email.com" \
    --password "app-specific-password" \
    --team-id "TEAM_ID" \
    --wait

# Staple the notarization ticket
xcrun stapler staple dist/Saekim.app
```

---

## 3. Platform-Specific Code Changes

### `src/main.py` - Entry Point

```python
import sys

# Platform-specific initialization
if sys.platform == 'darwin':
    # macOS: High DPI already handled by PyQt6
    pass
elif sys.platform == 'win32':
    # Windows: DPI awareness
    from ctypes import windll
    windll.shcore.SetProcessDpiAwareness(2)
    # AppUserModelID
    windll.shell32.SetCurrentProcessExplicitAppUserModelID('beeean17.saekim.editor.1.0')
```

### `src/windows/main_window.py` - Window Management

**Option A: Use PyQt6-Frameless-Window (Recommended)**
```python
from qframelesswindow import FramelessMainWindow

class MainWindow(FramelessMainWindow):
    def __init__(self):
        super().__init__()
        # Remove Windows-specific nativeEvent handling
        # Library handles cross-platform frameless behavior
```

**Option B: Platform-specific Window Classes**
```python
import sys

if sys.platform == 'darwin':
    class MainWindow(QMainWindow):
        # Use standard Qt window frame
        pass
elif sys.platform == 'win32':
    class MainWindow(QMainWindow):
        # Windows-specific frameless with nativeEvent
        pass
else:
    class MainWindow(QMainWindow):
        # Linux fallback
        pass
```

---

## 4. Keyboard Shortcuts

macOS uses `Cmd` instead of `Ctrl`. PyQt6 handles this with `QKeySequence.StandardKey`:

```python
from PyQt6.QtGui import QKeySequence, QShortcut

# Cross-platform shortcuts
self.shortcut_new = QShortcut(QKeySequence.StandardKey.New, self)
self.shortcut_open = QShortcut(QKeySequence.StandardKey.Open, self)
self.shortcut_save = QShortcut(QKeySequence.StandardKey.Save, self)
self.shortcut_close = QShortcut(QKeySequence.StandardKey.Close, self)
```

---

## 5. Playwright Browser Installation

Playwright automatically handles platform-specific browser paths:

```python
# Works cross-platform
from playwright.sync_api import sync_playwright

# Browser auto-installed to:
# - Windows: %LOCALAPPDATA%/ms-playwright/
# - macOS: ~/Library/Caches/ms-playwright/
# - Linux: ~/.cache/ms-playwright/
```

**Note**: Remove Windows-specific path from `saekim.spec`. Playwright will handle browser download.

---

## 6. Implementation Roadmap

### Phase 1: Basic macOS Support (1-2 days)
- [ ] Add `sys.platform == 'darwin'` guards in `main.py`
- [ ] Use standard Qt window frame (or PyQt6-Frameless-Window)
- [ ] Create macOS PyInstaller spec file
- [ ] Test on macOS without code signing

### Phase 2: Native Experience (2-3 days)
- [ ] Implement `setUnifiedTitleAndToolBarOnMac(True)` for native look
- [ ] Convert keyboard shortcuts to `QKeySequence.StandardKey`
- [ ] Test Playwright PDF conversion on macOS
- [ ] Handle macOS-specific file paths (~/Library/)

### Phase 3: Distribution (1-2 days)
- [ ] Create `.icns` icon file
- [ ] Set up code signing with Developer ID
- [ ] Perform notarization
- [ ] Create DMG installer
- [ ] Add to GitHub Releases

---

## 7. Dependencies to Add

```txt
# requirements-macos.txt (additional)
PyQt6-Frameless-Window>=0.3.0
pyobjc-framework-Cocoa>=9.0  # Implicit via PyQt6-Frameless-Window
```

---

## 8. Testing Checklist

- [ ] Window opening/closing
- [ ] Window resizing (corners and edges)
- [ ] Window dragging via title bar
- [ ] Window minimize/maximize/restore
- [ ] Full screen mode
- [ ] Retina display rendering
- [ ] Keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S, etc.)
- [ ] PDF export with Playwright
- [ ] PDF import with PyMuPDF
- [ ] Theme switching
- [ ] File explorer
- [ ] External file change detection
