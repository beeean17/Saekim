# Platform Architecture

Saekim keeps document behavior in shared code and routes shell behavior through platform profiles.

## Shared Core

Shared code owns the document model, render boxes, block layout metadata, preview policies, and backend contracts. It must not import OS APIs directly.

Shared entry points:

- `src/core/**` for document rendering and layout rules
- `src/platform/common/BackendAdapter.ts` for storage, files, export, and runtime commands
- `src/platform/common/platformProfile.ts` for the profile contract
- `src/platform/common/platform.ts` for the single runtime profile selection point

## Platform Profiles

Each runtime exports a profile that binds the shared contracts to an implementation:

- `src/platform/desktop/macos/macosPlatformProfile.ts`
- `src/platform/desktop/windows/windowsPlatformProfile.ts`
- `src/platform/desktop/linux/linuxPlatformProfile.ts`
- `src/platform/android/androidPlatformProfile.ts`
- `src/platform/browser/browserPlatformProfile.ts`

Desktop profiles inherit the shared Tauri desktop backend through `baseDesktopPlatformProfile.ts`. Android and browser profiles inherit the common base directly because their file access, preview budget, and shell behavior differ more.

## OS-Specific Boundaries

Keep these in platform folders:

- file and folder access behavior
- app data directory and metadata backend details
- native menu and titlebar policy
- window controls and drag behavior
- file association and open-with behavior
- Android content URI and permission behavior
- final platform build configuration

Keep these out of platform folders:

- block identity
- render object inheritance
- layout metadata schema
- markdown, table, image, KaTeX, and HTML preview semantics
- feature availability graph

## Build Targets

Tauri automatically merges platform config files named `tauri.<platform>.conf.json` with `tauri.conf.json`. The Windows-specific file association config already lives in `src-tauri/tauri.windows.conf.json`.

Build scripts:

- `corepack pnpm tauri:build:macos`
- `corepack pnpm tauri:build:windows`
- `corepack pnpm tauri:build:android`
