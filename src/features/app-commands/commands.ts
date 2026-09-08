import type { CommandContributionFactory } from '../../app/feature';
import { currentPlatformCapabilities } from '../../platform/common/capabilities';
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
      id: 'file.save',
      label: t('command.save'),
      defaultShortcut: 'mod+s',
      menu: { section: 'file', group: 'save', order: 50 },
      run: ctx.file.save,
    },
    {
      id: 'file.saveAs',
      label: t('command.saveAs'),
      defaultShortcut: 'mod+shift+s',
      menu: { section: 'file', group: 'save', order: 60 },
      run: ctx.file.saveAs,
    },
    {
      id: 'file.print',
      label: t('command.print'),
      defaultShortcut: 'mod+p',
      menu: { section: 'file', group: 'output', order: 70 },
      run: ctx.file.print,
    },
    {
      id: 'file.close',
      label: t('command.closeFile'),
      defaultShortcut: 'mod+w',
      menu: { section: 'file', group: 'close', order: 90 },
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
