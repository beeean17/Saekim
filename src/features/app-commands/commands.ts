import type { CommandContributionFactory } from '../../app/feature';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';

export const appCommands: CommandContributionFactory = (ctx) => {
  const commands = [
    {
      id: 'file.new',
      label: 'New File',
      defaultShortcut: 'mod+n',
      menu: { section: 'file', group: 'new', order: 10 },
      keywords: ['document', 'create'],
      run: ctx.file.newFile,
    },
    ...(currentPlatformCapabilities().has('window.chrome')
      ? [
          {
            id: 'window.new',
            label: 'New Window',
            defaultShortcut: 'mod+shift+n',
            menu: { section: 'file', group: 'new', order: 20 },
            run: ctx.window.newWindow,
          },
        ]
      : []),
    {
      id: 'file.open',
      label: 'Open File…',
      defaultShortcut: 'mod+o',
      menu: { section: 'file', group: 'open', order: 30 },
      run: ctx.file.openFile,
    },
    {
      id: 'folder.open',
      label: 'Open Folder…',
      defaultShortcut: 'mod+shift+o',
      menu: { section: 'file', group: 'open', order: 40 },
      run: ctx.file.openFolder,
    },
    {
      id: 'file.save',
      label: 'Save',
      defaultShortcut: 'mod+s',
      menu: { section: 'file', group: 'save', order: 50 },
      run: ctx.file.save,
    },
    {
      id: 'file.saveAs',
      label: 'Save As…',
      defaultShortcut: 'mod+shift+s',
      menu: { section: 'file', group: 'save', order: 60 },
      run: ctx.file.saveAs,
    },
    {
      id: 'file.print',
      label: 'Print…',
      defaultShortcut: 'mod+p',
      menu: { section: 'file', group: 'output', order: 70 },
      run: ctx.file.print,
    },
    {
      id: 'file.close',
      label: 'Close File',
      defaultShortcut: 'mod+w',
      menu: { section: 'file', group: 'close', order: 90 },
      run: ctx.file.close,
    },
    ...(currentPlatformCapabilities().has('window.chrome')
      ? [
          {
            id: 'window.close',
            label: 'Close Window',
            defaultShortcut: 'mod+shift+w',
            menu: { section: 'window', group: 'window', order: 30 },
            run: ctx.window.close,
          },
        ]
      : []),
    {
      id: 'settings.open',
      label: 'Open Settings',
      defaultShortcut: 'mod+,',
      menu: { section: 'view', group: 'settings', order: 90 },
      keywords: ['preferences'],
      run: ctx.view.openSettings,
    },
    {
      id: 'editor.bold',
      label: 'Toggle Bold',
      defaultShortcut: 'mod+b',
      menu: { section: 'edit', group: 'format', order: 30 },
      isEnabled: ctx.editor.hasTarget,
      run: ctx.editor.toggleBold,
    },
    {
      id: 'editor.italic',
      label: 'Toggle Italic',
      defaultShortcut: 'mod+i',
      menu: { section: 'edit', group: 'format', order: 40 },
      isEnabled: ctx.editor.hasTarget,
      run: ctx.editor.toggleItalic,
    },
    ...viewCommands(ctx),
    {
      id: 'view.toggleSidebar',
      label: 'Toggle Sidebar',
      defaultShortcut: 'mod+backslash',
      menu: { section: 'view', group: 'sidebar', order: 40 },
      run: ctx.view.toggleSidebar,
    },
  ];

  return commands;
};

function viewCommands(ctx: Parameters<CommandContributionFactory>[0]) {
  return [
    { mode: 'edit' as const, label: 'Editor Only', shortcut: 'mod+shift+1', order: 10 },
    { mode: 'split' as const, label: 'Split View', shortcut: 'mod+shift+2', order: 20 },
    { mode: 'preview' as const, label: 'Preview Only', shortcut: 'mod+shift+3', order: 30 },
  ].map(({ mode, label, shortcut, order }) => ({
    id: `view.${mode}`,
    label,
    defaultShortcut: shortcut,
    menu: { section: 'view', group: 'mode', order },
    isEnabled: () => ctx.view.canSetMode(mode),
    run: () => ctx.view.setMode(mode),
  }));
}
