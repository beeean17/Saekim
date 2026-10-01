import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandRegistry } from '../../app/commands';
import { SidebarMenu } from '../sidebar/SidebarMenu';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { SettingsPanel } from './SettingsPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<ReturnType<typeof createRoot>> = [];

beforeEach(() => {
  useSettingsStore.setState({ language: 'ko' });
  useUIStore.setState({
    settingsOpen: true,
    sidebarMode: 'expanded',
    compactSidebarOpen: false,
  });
});

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
});

describe('settings navigation controls', () => {
  it('moves the unique sidebar visibility control into settings', () => {
    const container = renderSettings(false);
    const labels = Array.from(container.querySelectorAll('label'));
    const sidebarLabels = labels.filter((label) => label.textContent?.trim() === '사이드바 표시');

    expect(sidebarLabels).toHaveLength(1);
    const checkbox = sidebarLabels[0].querySelector('input');
    expect(checkbox?.checked).toBe(true);

    act(() => checkbox?.click());

    expect(useUIStore.getState().sidebarMode).toBe('collapsed');
    expect(checkbox?.checked).toBe(false);
  });

  it('controls the sidebar drawer from settings on compact screens', () => {
    const container = renderSettings(true);
    const checkbox = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.trim() === '사이드바 표시')
      ?.querySelector('input');

    expect(checkbox?.checked).toBe(false);
    act(() => checkbox?.click());

    expect(useUIStore.getState().compactSidebarOpen).toBe(true);
    expect(checkbox?.checked).toBe(true);
  });

  it('removes the View eye menu from the sidebar', () => {
    const commandRegistry: CommandRegistry = new Map();
    const container = render(
      createElement(SidebarMenu, {
        textareaRef: createRef<HTMLTextAreaElement>(),
        commandRegistry,
        effectiveViewMode: 'split',
      }),
    );
    const menuTitles = Array.from(container.querySelectorAll('.sidebar-menu-button')).map(
      (button) => button.getAttribute('title'),
    );

    expect(menuTitles).toEqual(['파일', '편집']);
    expect(container.querySelector('[title="보기"]')).toBeNull();
  });
});

function renderSettings(compact: boolean): HTMLDivElement {
  return render(
    createElement(SettingsPanel, {
      compact,
      effectiveViewMode: 'split',
      availableViewModes: ['edit', 'split', 'preview'],
    }),
  );
}

function render(node: ReturnType<typeof createElement>): HTMLDivElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);
  act(() => root.render(node));
  return container;
}
