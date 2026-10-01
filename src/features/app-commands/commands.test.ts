import { describe, expect, it, vi } from 'vitest';
import type { CommandRuntimeContext } from '../../app/feature';
import { appCommands } from './commands';

describe('application file commands', () => {
  it('places New Folder immediately after New File and follows workspace availability', () => {
    let canCreateFolder = false;
    const context = commandContext(() => canCreateFolder);
    const commands = appCommands(context);
    const fileCommands = commands
      .filter((command) => command.menu?.section === 'file')
      .sort((left, right) => (left.menu?.order ?? 0) - (right.menu?.order ?? 0));

    expect(fileCommands.slice(0, 2).map((command) => command.id)).toEqual(['file.new', 'folder.new']);

    const newFolder = commands.find((command) => command.id === 'folder.new');
    expect(newFolder?.isEnabled?.()).toBe(false);
    canCreateFolder = true;
    expect(newFolder?.isEnabled?.()).toBe(true);

    newFolder?.run();
    expect(context.file.newFolder).toHaveBeenCalledOnce();
  });

  it('registers workspace refresh on the platform modifier and R', () => {
    const context = commandContext(() => true);
    const refresh = appCommands(context).find((command) => command.id === 'workspace.refresh');

    expect(refresh?.defaultShortcut).toBe('mod+r');
    refresh?.run();
    expect(context.file.refreshWorkspace).toHaveBeenCalledOnce();
  });
});

function commandContext(canCreateFolder: () => boolean): CommandRuntimeContext {
  return {
    file: {
      newFile: vi.fn(),
      newFolder: vi.fn(),
      canCreateFolder,
      canUndoFileCreation: () => false,
      undoFileCreation: vi.fn(),
      openFile: vi.fn(),
      openFolder: vi.fn(),
      refreshWorkspace: vi.fn(),
      save: vi.fn(),
      saveAs: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      hasDocument: () => true,
    },
    window: { newWindow: vi.fn(), close: vi.fn() },
    editor: {
      hasTarget: () => true,
      toggleBold: vi.fn(),
      toggleItalic: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: () => true,
      canRedo: () => true,
    },
    view: {
      openSettings: vi.fn(),
      setMode: vi.fn(),
      canSetMode: () => true,
      toggleSidebar: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      toggleFullscreen: vi.fn(),
      canToggleFullscreen: () => true,
    },
    search: { openFind: vi.fn(), openReplace: vi.fn() },
    palette: { open: vi.fn() },
    history: { hasDocument: () => true, open: vi.fn() },
  };
}
