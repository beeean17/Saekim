import type { CommandContributionFactory } from '../../app/feature';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
import { Platform } from '../../platform/common/platform';
import { translate } from '../../i18n/messages';
import { useSettingsStore } from '../../store/settings';

export const appCommands: CommandContributionFactory = (ctx) => {
  const language = useSettingsStore.getState().language;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const commands = [
    {
      id: 'file.new',
      label: t('command.newFile'),
      defaultShortcut: 'mod+n',
      menu: { section: 'file', group: 'new', order: 10 },
      keywords: ['document', 'create'],
      run: ctx.file.newFile,
    },
    {
      /* No shortcut of its own: undo is one user-facing action, dispatched by
         `edit.undo` below, which decides whether the last thing worth undoing
         was a text edit or the creation of an untouched file. */
      id: 'file.undoCreate',
      label: t('command.undoFileCreation'),
      keywords: ['undo', 'create', 'file'],
      isEnabled: ctx.file.canUndoFileCreation,
      run: ctx.file.undoFileCreation,
    },
    {
      id: 'edit.undo',
      label: t('menu.undo'),
      defaultShortcut: 'mod+z',
      yieldsToTextFields: true,
      menu: { section: 'edit', group: 'undo', order: 1 },
      keywords: ['undo', 'revert'],
      isEnabled: () => ctx.editor.canUndo() || ctx.file.canUndoFileCreation(),
      run: ctx.editor.undo,
    },
    {
      id: 'edit.redo',
      label: t('menu.redo'),
      /* Shift-Cmd-Z on macOS, Ctrl+Shift+Z on Windows and Linux. */
      defaultShortcut: 'mod+shift+z',
      yieldsToTextFields: true,
      menu: { section: 'edit', group: 'undo', order: 2 },
      keywords: ['redo'],
      isEnabled: ctx.editor.canRedo,
      run: ctx.editor.redo,
    },
    {
      id: 'folder.new',
      label: t('command.newFolder'),
      menu: { section: 'file', group: 'new', order: 15 },
      keywords: ['folder', 'directory', 'create'],
      isEnabled: ctx.file.canCreateFolder,
      run: ctx.file.newFolder,
    },
    ...(currentPlatformCapabilities().has('window.chrome')
      ? [
          {
            id: 'window.new',
            label: t('command.newWindow'),
            defaultShortcut: 'mod+shift+n',
            menu: { section: 'file', group: 'new', order: 20 },
            run: ctx.window.newWindow,
          },
        ]
      : []),
    {
      id: 'file.open',
      label: t('command.openFile'),
      defaultShortcut: 'mod+o',
      menu: { section: 'file', group: 'open', order: 30 },
      run: ctx.file.openFile,
    },
    {
      id: 'folder.open',
      label: t('command.openFolder'),
      defaultShortcut: 'mod+shift+o',
      menu: { section: 'file', group: 'open', order: 40 },
      run: ctx.file.openFolder,
    },
    {
      id: 'workspace.refresh',
      label: t('sidebar.refresh'),
      defaultShortcut: 'mod+r',
      keywords: ['reload', 'workspace', 'explorer'],
      run: ctx.file.refreshWorkspace,
    },
    {
      id: 'file.save',
      label: t('command.save'),
      defaultShortcut: 'mod+s',
      menu: { section: 'file', group: 'save', order: 50 },
      isEnabled: ctx.file.hasDocument,
      run: ctx.file.save,
    },
    {
      id: 'file.saveAs',
      label: t('command.saveAs'),
      defaultShortcut: 'mod+shift+s',
      menu: { section: 'file', group: 'save', order: 60 },
      isEnabled: ctx.file.hasDocument,
      run: ctx.file.saveAs,
    },
    {
      id: 'file.print',
      label: t('command.print'),
      defaultShortcut: 'mod+p',
      menu: { section: 'file', group: 'output', order: 70 },
      isEnabled: ctx.file.hasDocument,
      run: ctx.file.print,
    },
    {
      id: 'file.close',
      label: t('command.closeFile'),
      defaultShortcut: 'mod+w',
      menu: { section: 'file', group: 'close', order: 90 },
      isEnabled: ctx.file.hasDocument,
      run: ctx.file.close,
    },
    ...(currentPlatformCapabilities().has('window.chrome')
      ? [
          {
            id: 'window.close',
            label: t('command.closeWindow'),
            defaultShortcut: 'mod+shift+w',
            menu: { section: 'window', group: 'window', order: 30 },
            run: ctx.window.close,
          },
        ]
      : []),
    {
      id: 'settings.open',
      label: t('command.openSettings'),
      defaultShortcut: 'mod+,',
      menu: { section: 'view', group: 'settings', order: 90 },
      keywords: ['preferences'],
      run: ctx.view.openSettings,
    },
    {
      id: 'editor.bold',
      label: t('command.bold'),
      defaultShortcut: 'mod+b',
      menu: { section: 'edit', group: 'format', order: 30 },
      isEnabled: ctx.editor.hasTarget,
      run: ctx.editor.toggleBold,
    },
    {
      id: 'editor.italic',
      label: t('command.italic'),
      defaultShortcut: 'mod+i',
      menu: { section: 'edit', group: 'format', order: 40 },
      isEnabled: ctx.editor.hasTarget,
      run: ctx.editor.toggleItalic,
    },
    ...viewCommands(ctx, t),
    {
      id: 'view.zoomIn',
      label: t('command.zoomIn'),
      defaultShortcut: 'mod+equal',
      menu: { section: 'view', group: 'zoom', order: 40 },
      run: ctx.view.zoomIn,
    },
    {
      id: 'view.zoomOut',
      label: t('command.zoomOut'),
      defaultShortcut: 'mod+minus',
      menu: { section: 'view', group: 'zoom', order: 50 },
      run: ctx.view.zoomOut,
    },
    {
      id: 'view.zoomReset',
      label: t('command.actualSize'),
      defaultShortcut: 'mod+0',
      menu: { section: 'view', group: 'zoom', order: 60 },
      run: ctx.view.resetZoom,
    },
    ...(ctx.view.canToggleFullscreen()
      ? [
          {
            id: 'view.toggleFullscreen',
            label: t('command.toggleFullscreen'),
            /*
             * F11 is the standard key everywhere the app has to supply one.
             * macOS is the exception: its View menu already offers Enter Full
             * Screen on Control-Command-F, so binding anything here would just
             * fight the OS. Deliberately not the title-bar double click either,
             * which every platform reserves for maximise/restore.
             */
            defaultShortcut: Platform.windowChrome.providesNativeFullscreenCommand ? undefined : 'f11',
            menu: { section: 'view', group: 'window', order: 80 },
            keywords: ['fullscreen', 'full screen', 'presentation', 'focus'],
            run: ctx.view.toggleFullscreen,
          },
        ]
      : []),
    {
      id: 'view.toggleSidebar',
      label: t('command.toggleSidebar'),
      defaultShortcut: 'mod+backslash',
      menu: { section: 'view', group: 'sidebar', order: 70 },
      run: ctx.view.toggleSidebar,
    },
  ];

  return commands;
};

function viewCommands(
  ctx: Parameters<CommandContributionFactory>[0],
  t: (key: Parameters<typeof translate>[1]) => string,
) {
  return [
    { mode: 'edit' as const, label: t('view.editorOnly'), shortcut: 'mod+shift+1', order: 10 },
    { mode: 'split' as const, label: t('view.splitView'), shortcut: 'mod+shift+2', order: 20 },
    { mode: 'preview' as const, label: t('view.previewOnly'), shortcut: 'mod+shift+3', order: 30 },
  ].map(({ mode, label, shortcut, order }) => ({
    id: `view.${mode}`,
    label,
    defaultShortcut: shortcut,
    menu: { section: 'view', group: 'mode', order },
    isEnabled: () => ctx.view.canSetMode(mode),
    run: () => ctx.view.setMode(mode),
  }));
}
