# Epics and Stories: macOS Support

> **Version**: 1.0  
> **Date**: 2026-01-17  
> **Status**: Ready for Development  
> **PRD**: [prd-macos-support.md](./prd-macos-support.md)

---

## Epic 1: macOS Application Core
**Description**: Refactor the main application entry point and window management to support macOS native behavior while maintaining Windows compatibility.

### Story 1.1: Platform-Specific Entry Point
**As a** Developer  
**I want** `main.py` to detect the OS and initialize appropriate settings  
**So that** the application runs correctly on both macOS and Windows without crashing  

**Acceptance Criteria**:
- `sys.platform == 'darwin'` branch added to `main.py`
- Windows-specific imports (`ctypes`) guarded behind `win32` check
- Application launches on macOS without errors
- Windows version still builds and runs correctly
- **Dev Note**: Verify high-DPI settings on macOS (handled by PyQt6 by default?)

### Story 1.2: Cross-Platform Window Management
**As a** User  
**I want** a modern, frameless window that works on my OS  
**So that** I have a consistent experience with native window controls  

**Acceptance Criteria**:
- `PyQt6-Frameless-Window` library integrated
- `MainWindow` inherits from `FramelessMainWindow`
- Native window controls (stoplights) work on macOS
- Aero Snap and resizing work on Windows
- Custom title bar allows dragging on both platforms
- **Requirement**: Remove all `nativeEvent` filtering code from `main_window.py`

### Story 1.3: macOS Keyboard Shortcuts
**As a** Mac User  
**I want** to use Command (Cmd) key instead of Control (Ctrl)  
**So that** the app behaves like a standard Mac application  

**Acceptance Criteria**:
- `QKeySequence.StandardKey` used for New, Open, Save, Close, Quit, Find
- Shortcuts map to Cmd on macOS and Ctrl on Windows automatically
- Verify text editing shortcuts (Cmd+C, Cmd+V, Cmd+Z) work in WebView

---

## Epic 2: macOS Packaging & Distribution
**Description**: Set up the build pipeline to create a signed, notarized macOS application bundle.

### Story 2.1: PyInstaller macOS Configuration
**As a** Release Engineer  
**I want** a `saekim_macos.spec` file  
**So that** I can build a standalone `.app` bundle  

**Acceptance Criteria**:
- `saekim_macos.spec` created targeting `Saekim.app`
- App icon (`.icns`) included in bundle resources
- `Info.plist` includes version and HighDPI keys
- Build artifact runs on clean macOS environment (no Python installed)

### Story 2.2: Hardened Runtime & Code Signing
**As a** Developer  
**I want** to sign the application with a Developer ID  
**So that** it can run on other users' Macs  

**Acceptance Criteria**:
- `entitlements.plist` created with JIT and unsigned-memory allowances
- Build script signs the `.app` bundle using `codesign`
- Verification command shows valid signature and entitlements

### Story 2.3: Apple Notarization
**As a** User  
**I want** to open the app without security warnings  
**So that** I trust the software  

**Acceptance Criteria**:
- Build script submits ZIP to Apple Notary Service via `notarytool`
- Stapler attaches ticket to `.app`
- App passes Gatekeeper check on a different Mac

---

## Epic 3: Feature Verification & Polish
**Description**: Ensure all features work on macOS and polish the experience.

### Story 3.1: Playwright Browser Integration
**As a** User  
**I want** to export PDFs  
**So that** I can share my documents  

**Acceptance Criteria**:
- Playwright downloads macOS Chromium binary on first run
- PDF export works successfully
- No path issues with finding the browser binary

### Story 3.2: macOS Styling Polish
**As a** User  
**I want** the UI to look good on Retina displays  
**So that** usage is comfortable  

**Acceptance Criteria**:
- Fonts render sharply (Pretendard font loaded)
- Icons are not pixelated
- Window shadows and corners look native
- Dark mode follows system setting (if supported by theme manager)
