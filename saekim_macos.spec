# -*- mode: python ; coding: utf-8 -*-
# macOS-specific PyInstaller configuration for Saekim
# Build with: pyinstaller saekim_macos.spec

import sys
from pathlib import Path

block_cipher = None

# Playwright browser path (auto-downloaded on first run, not bundled)
# Users will need to run the app once with internet to download Chromium

a = Analysis(
    ['src/main.py'],
    pathex=['src'],
    binaries=[],
    datas=[
        ('src/ui', 'ui'),
        ('src/resources', 'resources'),
        ('vendor/ms-playwright', 'ms-playwright'),  # bundle Chromium cache
    ],
    hiddenimports=[
        'PyQt6.QtWebEngine', 
        'PyQt6.QtWebEngineCore', 
        'PyQt6.QtWebEngineWidgets',
        'qframelesswindow',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['runtime_hook.py'],
    excludes=[
        'torch', 'torchvision', 'torchaudio', 'nvidia', 
        'numpy', 'pandas', 'matplotlib', 'scipy'
    ],
    noarchive=False,
    cipher=block_cipher,
)

# Drop Playwright Chromium binaries from the binaries list to avoid macOS codesign on them.
# We still copy the browser cache via datas above.
a.binaries = [b for b in a.binaries if 'ms-playwright' not in str(b[0]) and 'chrome-mac' not in str(b[0])]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Saekim',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX can cause issues on macOS
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='arm64',  # Match current Python env; switch back to universal2 only if all deps are fat binaries
    codesign_identity=False,  # Force-disable signing to avoid Chromium bundle errors
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name='Saekim',
    codesign_identity=False,
    entitlements_file=None,
)

app = BUNDLE(
    coll,
    name='Saekim.app',
    icon='src/resources/icons/app_icon.icns',
    bundle_identifier='com.beeean17.saekim',
    codesign_identity=False,
    entitlements_file=None,
    info_plist={
        'CFBundleDisplayName': 'Saekim',
        'CFBundleName': 'Saekim',
        'CFBundleShortVersionString': '1.3.0',
        'CFBundleVersion': '1.3.0',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '10.14.0',
        'NSRequiresAquaSystemAppearance': False,  # Support dark mode
    },
)
