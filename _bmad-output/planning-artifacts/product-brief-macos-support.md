# Product Brief: macOS Support for Saekim

> **Version**: 1.0  
> **Date**: 2026-01-17  
> **Author**: Mary (Business Analyst)  
> **Status**: Draft - Ready for Review

---

## Executive Summary

Add native macOS support to Saekim (새김), the local-first Markdown editor. Currently Windows-only, expanding to macOS will address the needs of developers and students in the Apple ecosystem who require a privacy-focused, offline-capable document editing solution.

---

## Problem Statement

### Current Situation
- Saekim v1.2.0 is **Windows-only** with hardcoded Windows API calls
- macOS/Linux users must run from source code (no pre-built app)
- README claims cross-platform support but only Windows installer exists
- Growing demand from macOS users (especially developers)

### User Pain Points
1. **macOS developers** cannot use Saekim without Python setup
2. **Privacy-conscious Apple users** lack offline Markdown editor options
3. **Students with MacBooks** need local-first documentation tools

---

## Proposed Solution

### Goal
Create a native macOS application bundle (.app) that provides the same functionality as the Windows version, with platform-appropriate UI patterns.

### Key Features (MVP)

| Feature | Priority | Description |
|---------|----------|-------------|
| **macOS .app bundle** | P0 | Standalone application, no Python required |
| **Native window behavior** | P0 | Proper resizing, minimize, maximize, close |
| **Cmd keyboard shortcuts** | P0 | Cmd+N, Cmd+O, Cmd+S instead of Ctrl |
| **Retina display support** | P0 | High-DPI rendering via PyQt6 |
| **PDF conversion** | P0 | Playwright on macOS for MD→PDF |
| **Code signing** | P1 | Developer ID signing for Gatekeeper |
| **Notarization** | P1 | Apple notarization for trusted install |
| **DMG installer** | P2 | Professional distribution format |

### Out of Scope (v1.3.0)
- Mac App Store distribution
- Native macOS menu bar integration (use existing custom titlebar)
- Touch Bar support
- Handoff/Continuity features
- iCloud integration

---

## Technical Approach

### Architecture Decision: PyQt6-Frameless-Window

**Choice**: Use `PyQt6-Frameless-Window` library instead of custom Windows ctypes code

**Rationale**:
- Cross-platform support (Windows, macOS, Linux)
- Handles platform-specific window chrome automatically
- Uses PyObjC on macOS for native behavior
- Maintains existing custom titlebar design

### Packaging Strategy

| Platform | Tool | Output |
|----------|------|--------|
| Windows | PyInstaller + Inno Setup | `.exe` installer |
| macOS | PyInstaller | `.app` bundle (+ .dmg) |

### Code Changes Required

1. **`main.py`**: Add `sys.platform == 'darwin'` guards
2. **`main_window.py`**: Replace Windows ctypes with cross-platform library
3. **New file**: `saekim_macos.spec` for PyInstaller
4. **New file**: `entitlements.plist` for macOS security
5. **New file**: `build_installer_macos.sh` for distribution

---

## Success Metrics

| Metric | Target |
|--------|--------|
| macOS app launches successfully | 100% |
| All core features work (edit, preview, save, PDF) | 100% |
| Window resize/move/close works | 100% |
| Gatekeeper accepts signed app | Pass |
| Download count (first month) | 50+ |

---

## Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Basic Support | 1-2 days | macOS app runs with standard window |
| Phase 2: Native Experience | 2-3 days | Full feature parity, keyboard shortcuts |
| Phase 3: Distribution | 1-2 days | Signed, notarized, DMG installer |
| **Total** | **4-7 days** | Release-ready macOS version |

---

## Dependencies & Requirements

### Development
- macOS 10.14+ for development and testing
- Xcode Command Line Tools
- Apple Developer Program membership (for signing)

### New Python Packages
```
PyQt6-Frameless-Window>=0.3.0
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PyInstaller macOS issues | High | Test early, use cx_Freeze as backup |
| Code signing complexity | Medium | Follow Apple documentation, use notarytool |
| PyQt6-WebEngine macOS quirks | Medium | Test thoroughly, fallback to standard window |
| Playwright browser install | Low | Auto-downloads, document manual install |

---

## Next Steps

1. ✅ Document current architecture (completed)
2. ✅ Research macOS support requirements (completed)
3. ✅ Create Product Brief (this document)
4. ⏳ **Create PRD** with detailed technical specifications
5. ⏳ **Implement Phase 1** (basic macOS support)
6. ⏳ **Test and iterate**
7. ⏳ **Release v1.3.0** with macOS support

---

## Approval

- [ ] Technical feasibility validated
- [ ] Resource availability confirmed
- [ ] Timeline accepted
- [ ] Proceed to PRD creation
