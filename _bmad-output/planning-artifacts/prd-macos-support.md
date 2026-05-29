# Product Requirements Document: macOS Support

> **Version**: 1.3.0  
> **Date**: 2026-01-17  
> **Status**: Draft  
> **Product Brief**: [product-brief-macos-support.md](./product-brief-macos-support.md)

---

## 1. Overview

### 1.1 Purpose
This PRD defines the requirements for adding native macOS support to Saekim (새김), the local-first Markdown editor. The goal is to deliver a fully functional macOS application bundle (.app) with feature parity to the Windows version.

### 1.2 Background
Saekim v1.2.0 is currently Windows-only due to platform-specific code using Windows APIs (`ctypes.windll`). This limits adoption among developers and students using macOS, despite the underlying technology stack (PyQt6, Playwright) being cross-platform compatible.

### 1.3 Scope
- **In Scope**: macOS .app bundle, window management, keyboard shortcuts, PDF conversion, code signing, distribution
- **Out of Scope**: Mac App Store, Touch Bar, Handoff, iCloud integration

---

## 2. Goals and Success Metrics

### 2.1 Goals

| Goal | Description |
|------|-------------|
| **G1** | Users can install and run Saekim on macOS without Python knowledge |
| **G2** | All core editing features work identically to Windows version |
| **G3** | Window behavior feels native to macOS users |
| **G4** | App passes Gatekeeper without security warnings |

### 2.2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Installation success rate | 100% | QA testing on macOS 10.14-14.x |
| Feature parity | 100% | Feature comparison checklist |
| Gatekeeper compliance | Pass | Notarization verification |
| Download count (first month) | 50+ | GitHub Release analytics |

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Application Lifecycle

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1.1 | App launches from Finder/Dock | P0 | Double-click .app launches successfully |
| FR-1.2 | App appears in Dock with icon | P0 | Correct icon displayed |
| FR-1.3 | App quits cleanly | P0 | All processes terminate, no orphans |
| FR-1.4 | App reopens last session | P0 | Session restore works on restart |

#### FR-2: Window Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-2.1 | Window resize from edges | P0 | All 8 resize handles work |
| FR-2.2 | Window drag from title bar | P0 | Custom title bar allows dragging |
| FR-2.3 | Minimize to Dock | P0 | Window minimizes with animation |
| FR-2.4 | Maximize (green button) | P0 | Full screen or zoom works |
| FR-2.5 | Close (red button) | P0 | Prompts to save unsaved changes |

#### FR-3: Keyboard Shortcuts

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-3.1 | Cmd+N creates new file | P0 | New tab opens with empty content |
| FR-3.2 | Cmd+O opens file dialog | P0 | System file picker appears |
| FR-3.3 | Cmd+S saves current file | P0 | File saves to disk |
| FR-3.4 | Cmd+Shift+S for Save As | P0 | Save dialog opens |
| FR-3.5 | Cmd+W closes tab | P0 | Tab closes, prompts if unsaved |
| FR-3.6 | Cmd+Q quits app | P0 | App closes gracefully |
| FR-3.7 | Cmd+F opens find | P0 | Find dialog opens |
| FR-3.8 | Cmd+Tab switches apps | P0 | Standard macOS behavior |

#### FR-4: Core Features

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-4.1 | Markdown editing | P0 | Text editing works with syntax highlighting |
| FR-4.2 | Live preview | P0 | Preview updates on edit |
| FR-4.3 | Split view | P0 | Editor and preview side by side |
| FR-4.4 | Code highlighting | P0 | All 9 languages render correctly |
| FR-4.5 | Mermaid diagrams | P0 | All diagram types render |
| FR-4.6 | KaTeX equations | P0 | Math equations render |
| FR-4.7 | PDF export | P0 | Playwright generates PDF |
| FR-4.8 | PDF import | P0 | PyMuPDF extracts text |
| FR-4.9 | File explorer | P0 | Folder tree navigates filesystem |
| FR-4.10 | Theme switching | P0 | All 5 themes apply correctly |

#### FR-5: Distribution

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-5.1 | Code signing | P1 | Signed with Developer ID |
| FR-5.2 | Notarization | P1 | Apple notarized |
| FR-5.3 | DMG installer | P2 | Professional installation experience |
| FR-5.4 | GitHub Release | P0 | Download available alongside Windows |

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | App launch time | < 3 seconds (cold start) |
| NFR-1.2 | File open time | < 500ms for 100KB file |
| NFR-1.3 | Preview render time | < 200ms for typical document |
| NFR-1.4 | Memory usage | < 500MB base |

#### NFR-2: Compatibility

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-2.1 | macOS versions | 10.14 (Mojave) through 14.x (Sonoma) |
| NFR-2.2 | Architecture | Intel (x86_64) and Apple Silicon (arm64) |
| NFR-2.3 | Display | Standard and Retina displays |

#### NFR-3: Security

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-3.1 | Hardened Runtime | Enabled with required entitlements |
| NFR-3.2 | Sandbox | Not required (local-first app) |
| NFR-3.3 | Data storage | Local only (~/.saekim/) |

---

## 4. Technical Specifications

### 4.1 Architecture Changes

#### 4.1.1 Window System

**Current (Windows-only)**:
```python
# main_window.py - Uses ctypes.windll for window management
ctypes.windll.user32.GetWindowLongW(hwnd, GWL_STYLE)
ctypes.windll.user32.SetWindowLongW(hwnd, GWL_STYLE, style)
```

**New (Cross-platform)**:
```python
# Option A: PyQt6-Frameless-Window (Recommended)
from qframelesswindow import FramelessMainWindow

class MainWindow(FramelessMainWindow):
    def __init__(self):
        super().__init__()
        # Library handles platform-specific window behavior
```

#### 4.1.2 Platform Detection

```python
# main.py
import sys

if sys.platform == 'darwin':
    # macOS-specific initialization
    pass
elif sys.platform == 'win32':
    # Windows-specific initialization (existing code)
    from ctypes import windll
    windll.shcore.SetProcessDpiAwareness(2)
```

#### 4.1.3 Keyboard Shortcuts

```python
# Use Qt StandardKey for automatic Cmd/Ctrl mapping
from PyQt6.QtGui import QKeySequence

shortcut_new = QShortcut(QKeySequence.StandardKey.New, self)
shortcut_open = QShortcut(QKeySequence.StandardKey.Open, self)
shortcut_save = QShortcut(QKeySequence.StandardKey.Save, self)
```

### 4.2 New Files Required

| File | Purpose |
|------|---------|
| `saekim_macos.spec` | PyInstaller spec for macOS |
| `entitlements.plist` | macOS Hardened Runtime entitlements |
| `build_installer_macos.sh` | Build and sign script |
| `src/resources/icons/app_icon.icns` | macOS icon format |

### 4.3 Dependencies

#### New Dependencies
```txt
PyQt6-Frameless-Window>=0.3.0  # Cross-platform frameless window
# Note: pyobjc-framework-Cocoa is installed automatically on macOS
```

#### Existing Dependencies (macOS Compatible)
- PyQt6 >= 6.6.0 ✅
- PyQt6-WebEngine >= 6.6.0 ✅
- Playwright >= 1.40.0 ✅
- PyMuPDF >= 1.24.0 ✅
- pdfplumber >= 0.11.0 ✅

### 4.4 Build Configuration

#### PyInstaller Spec (saekim_macos.spec)
```python
app = BUNDLE(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='Saekim.app',
    icon='src/resources/icons/app_icon.icns',
    bundle_identifier='com.beeean17.saekim',
    info_plist={
        'CFBundleShortVersionString': '1.3.0',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '10.14.0',
    },
)
```

#### Entitlements (entitlements.plist)
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

---

## 5. User Stories

### Epic: macOS Platform Support

#### Story 1: Launch Application
**As a** macOS user  
**I want to** double-click the Saekim app  
**So that** I can start editing Markdown files

**Acceptance Criteria**:
- [ ] App icon visible in Finder
- [ ] Double-click launches app within 3 seconds
- [ ] Main window appears with welcome screen
- [ ] App appears in Dock with correct icon

#### Story 2: Window Management
**As a** macOS user  
**I want to** resize and move the window  
**So that** I can organize my workspace

**Acceptance Criteria**:
- [ ] Drag title bar to move window
- [ ] Resize from all edges and corners
- [ ] Minimize button works
- [ ] Maximize/full-screen button works
- [ ] Close button works (with save prompt)

#### Story 3: Keyboard Shortcuts
**As a** macOS user  
**I want to** use Cmd-based shortcuts  
**So that** the app feels native

**Acceptance Criteria**:
- [ ] Cmd+N creates new file
- [ ] Cmd+O opens file
- [ ] Cmd+S saves file
- [ ] Cmd+W closes tab
- [ ] Cmd+Q quits app
- [ ] Cmd+F opens find

#### Story 4: PDF Export
**As a** macOS user  
**I want to** export my Markdown as PDF  
**So that** I can share formatted documents

**Acceptance Criteria**:
- [ ] Export to PDF menu option works
- [ ] Playwright browser downloads automatically
- [ ] PDF contains all content (text, code, diagrams, equations)
- [ ] PDF quality matches Windows version

#### Story 5: Install Without Issues
**As a** macOS user  
**I want to** install Saekim without security warnings  
**So that** I trust the application

**Acceptance Criteria**:
- [ ] No "unidentified developer" warning
- [ ] Gatekeeper allows execution
- [ ] App runs after first launch

---

## 6. Implementation Plan

### Phase 1: Basic macOS Support (1-2 days)

| Task | Priority | Effort |
|------|----------|--------|
| Add PyQt6-Frameless-Window dependency | P0 | 0.5h |
| Update main.py with platform guards | P0 | 1h |
| Refactor main_window.py to use FramelessMainWindow | P0 | 4h |
| Create saekim_macos.spec | P0 | 2h |
| Build and test on macOS | P0 | 2h |

### Phase 2: Native Experience (2-3 days)

| Task | Priority | Effort |
|------|----------|--------|
| Convert keyboard shortcuts to QKeySequence.StandardKey | P0 | 2h |
| Create app_icon.icns | P0 | 1h |
| Test all core features | P0 | 4h |
| Fix any platform-specific bugs | P0 | 4h |
| Test on Intel and Apple Silicon | P0 | 2h |

### Phase 3: Distribution (1-2 days)

| Task | Priority | Effort |
|------|----------|--------|
| Set up Apple Developer account | P1 | 1h |
| Create Developer ID certificate | P1 | 1h |
| Create entitlements.plist | P1 | 1h |
| Create build_installer_macos.sh | P1 | 2h |
| Code sign the app | P1 | 1h |
| Notarize with notarytool | P1 | 2h |
| Create DMG installer (optional) | P2 | 2h |
| Update README and CHANGELOG | P0 | 1h |
| Create GitHub Release | P0 | 0.5h |

---

## 7. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PyInstaller produces broken .app | Medium | High | Test early; fallback to py2app |
| PyQt6-WebEngine issues on macOS | Low | High | Test thoroughly; collect crash reports |
| Code signing complexity | Medium | Medium | Follow Apple docs; use automation |
| Playwright browser path issues | Low | Medium | Test auto-download; document manual install |
| Performance differences | Low | Low | Profile and optimize if needed |

---

## 8. Testing Strategy

### 8.1 Test Matrix

| Feature | macOS 10.14 | macOS 12 | macOS 14 | Intel | Apple Silicon |
|---------|-------------|----------|----------|-------|---------------|
| App launch | ✓ | ✓ | ✓ | ✓ | ✓ |
| Window ops | ✓ | ✓ | ✓ | ✓ | ✓ |
| File I/O | ✓ | ✓ | ✓ | ✓ | ✓ |
| PDF export | ✓ | ✓ | ✓ | ✓ | ✓ |
| Themes | ✓ | ✓ | ✓ | ✓ | ✓ |

### 8.2 Smoke Test Checklist

- [ ] Install app by dragging to Applications
- [ ] Launch app
- [ ] Create new file
- [ ] Type Markdown content
- [ ] Verify preview updates
- [ ] Save file
- [ ] Open existing file
- [ ] Switch themes
- [ ] Export to PDF
- [ ] Resize window
- [ ] Minimize and restore
- [ ] Close app

---

## 9. Release Plan

### Version: 1.3.0

**Release Notes**:
- 🍎 **NEW**: Native macOS support (.app bundle)
- ✨ Full feature parity with Windows version
- ⌨️ macOS keyboard shortcuts (Cmd-based)
- 🔒 Signed and notarized for Gatekeeper

**Distribution**:
- GitHub Releases: `Saekim-v1.3.0-macos.dmg` or `.app.zip`
- Windows installer remains unchanged

**Documentation Updates**:
- README.md: Update platform badges, installation instructions
- CHANGELOG.md: Document macOS support
- USAGE.md: Add macOS-specific notes

---

## 10. Appendix

### A. Reference Documents

- [Project Documentation](../docs/project-documentation.md)
- [macOS Support Research](../docs/macos-support-research.md)
- [Product Brief](./product-brief-macos-support.md)

### B. External Resources

- [PyQt6-Frameless-Window](https://pypi.org/project/PyQt6-Frameless-Window/)
- [PyInstaller macOS Docs](https://pyinstaller.org/en/stable/usage.html#macos)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
