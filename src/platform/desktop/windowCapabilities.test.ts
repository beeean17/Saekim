import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Tauri v2 denies every plugin command that a capability file does not grant,
 * and a denied command fails only at runtime - nothing in the type checker, the
 * linter or the Rust build notices. That is how double-clicking the title bar
 * came to do nothing at all: `data-tauri-drag-region` invokes
 * `internal_toggle_maximize`, which was never permitted.
 *
 * These are the window commands the desktop build actually calls, either
 * through @tauri-apps/api or through Tauri's own drag-region script.
 */
const requiredWindowPermissions = [
  // Tauri's data-tauri-drag-region script: drag, and double-click to maximise.
  'core:window:allow-start-dragging',
  'core:window:allow-internal-toggle-maximize',
  // runWindowAction()
  'core:window:allow-toggle-maximize',
  'core:window:allow-minimize',
  'core:window:allow-close',
  // The full-screen command.
  'core:window:allow-set-fullscreen',
  'core:window:allow-is-fullscreen',
  // Keeping the native title bar in step with the theme.
  'core:window:allow-set-background-color',
];

function grantedPermissions(): Set<string> {
  const directory = join(process.cwd(), 'src-tauri', 'capabilities');
  const granted = new Set<string>();

  for (const entry of readdirSync(directory)) {
    if (!entry.endsWith('.json')) continue;
    const capability = JSON.parse(readFileSync(join(directory, entry), 'utf8')) as {
      permissions?: Array<string | { identifier?: string }>;
    };
    for (const permission of capability.permissions ?? []) {
      const identifier = typeof permission === 'string' ? permission : permission.identifier;
      if (identifier) granted.add(identifier);
    }
  }

  return granted;
}

describe('desktop window capabilities', () => {
  const granted = grantedPermissions();

  it.each(requiredWindowPermissions)('grants %s', (permission) => {
    expect(granted.has(permission)).toBe(true);
  });
});
