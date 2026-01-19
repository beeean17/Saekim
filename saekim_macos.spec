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
    target_arch='universal2',  # Support Intel and Apple Silicon
    codesign_identity=None,  # Set to your Developer ID for signing
    entitlements_file='entitlements.plist',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name='Saekim',
)

app = BUNDLE(
    coll,
    name='Saekim.app',
    icon='src/resources/icons/app_icon.icns',
    bundle_identifier='com.beeean17.saekim',
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
