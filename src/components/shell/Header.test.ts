import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandRegistry } from '../../app/commands';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { Header } from './Header';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
  useSettingsStore.setState({ language: 'ko' });
  useUIStore.setState({ compactSidebarOpen: false, settingsOpen: false });
});

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('compact header navigation', () => {
  it('opens the sidebar drawer from the header on phones', () => {
    const container = renderHeader(true);
    const trigger = container.querySelector<HTMLButtonElement>('.compact-sidebar-trigger');

    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger?.click());

    expect(useUIStore.getState().compactSidebarOpen).toBe(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not add the drawer trigger to tablet and desktop headers', () => {
    const container = renderHeader(false);
    expect(container.querySelector('.compact-sidebar-trigger')).toBeNull();
  });

  it('moves the document title out of the Android header and keeps view controls there', () => {
    const container = renderHeader(true, true);

    expect(container.querySelector('.titlebar-path')).toBeNull();
    expect(container.querySelectorAll('.header-view-toggle button')).toHaveLength(2);
  });
});

function renderHeader(compact: boolean, android = false): HTMLDivElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  const commandRegistry: CommandRegistry = new Map();
  act(() => {
    root.render(createElement(Header, {
      android,
      commandRegistry,
      compact,
      effectiveViewMode: 'edit',
      availableViewModes: ['edit', 'preview'],
    }));
  });
  return container;
}
