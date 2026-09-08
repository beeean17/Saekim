import type { ClipboardEvent as ReactClipboardEvent, ComponentType, DragEvent as ReactDragEvent, ReactNode, RefObject } from 'react';
import type { EditorHelperItemBase } from '../core/editor/helperTypes';
import type { FileTypeContribution, FileTypeInfo } from '../core/document/fileType';
import type { PlatformCapability } from '../platform/common/capabilities';
import type { PreviewRenderScene } from '../core/preview/renderScene';
import type { BlockLayout } from '../types/metadata';
import type { HtmlPreviewMode } from '../types/session';
import type { OpenFile, ResolvedThemeName } from '../types/workspace';

export interface SaekimFeature {
  id: string;
  label: string;
  dependsOn?: string[];
  requiresCapabilities?: FeatureCapabilityRequirements;
  preview?: PreviewContribution | PreviewContribution[];
  fileTypes?: FileTypeContribution | FileTypeContribution[];
  editor?: EditorContribution | EditorContribution[];
  sidebar?: SidebarContribution | SidebarContribution[];
  app?: AppContribution | AppContribution[];
  commands?: CommandContributionFactory;
  metadata?: MetadataContribution | MetadataContribution[];
  pdf?: PdfContribution | PdfContribution[];
}

export interface AppContribution {
  overlays?: AppOverlayContribution[];
}

export interface AppOverlayContribution {
  id: string;
  component: ComponentType<AppOverlayProps>;
}

export interface AppOverlayProps {
  commandRegistry: ReadonlyMap<string, CommandContribution>;
}

export interface FeatureCapabilityRequirements {
  required?: PlatformCapability[];
  optional?: PlatformCapability[];
}

export interface PreviewContribution {
  id: string;
  match(ctx: PreviewMatchContext): boolean;
  priority: number;
  render?(ctx: PreviewRenderContext): PreviewResult | Promise<PreviewResult>;
  afterRender?(root: HTMLElement, ctx: PreviewRenderContext, signal: AbortSignal): void | Promise<void>;
  cleanup?(root: HTMLElement): void;
  head?(ctx: PreviewRenderContext): ReactNode;
  supportsBlockLayouts?: boolean;
}

export interface PreviewMatchContext {
  file: OpenFile;
  fileType: FileTypeInfo;
}

export interface PreviewRenderContext extends PreviewMatchContext {
  theme: ResolvedThemeName;
  htmlPreviewMode: HtmlPreviewMode;
  setHtmlPreviewMode(value: HtmlPreviewMode): void;
  signal?: AbortSignal;
}

export interface EditorContribution {
  topBars?: EditorTopBarContribution[];
  toolbar?: EditorToolbarItem[];
  overlays?: EditorOverlayContribution[];
  helpers?: EditorHelperContribution[];
  handlers?: EditorEventHandlers;
  imageActions?: EditorImageActions;
}

export interface SidebarContribution {
  id: string;
  label: string;
  component: ComponentType<SidebarPanelProps>;
}

export interface SidebarPanelProps {
  activeFile: OpenFile | null;
  textareaRef: RefObject<HTMLTextAreaElement>;
  editorScrollRef: RefObject<HTMLDivElement>;
  previewRef: RefObject<HTMLDivElement>;
}

export interface EditorTopBarContribution {
  id: string;
  component: ComponentType;
}

export interface EditorOverlayContribution {
  id: string;
  component: ComponentType<EditorOverlayProps>;
}

export interface EditorOverlayProps {
  activeFile: OpenFile | null;
  textareaRef: RefObject<HTMLTextAreaElement>;
}

export interface EditorToolbarItem {
  id: string;
  label?: string;
  icon?: string;
  tooltip: string;
  helperMode?: string;
  commandId?: string;
}

export interface EditorHelperContribution<Item extends EditorHelperItemBase = EditorHelperItemBase> {
  mode: string;
  title: string;
  placeholder: string;
  description: string;
  items: Item[];
  syntax(item: Item): string;
  snippet(item: Item): string;
  action?(item: Item): 'indent' | 'outdent' | null;
  insertLabel?(item: Item): string;
  renderPreview(item: Item, ctx: EditorHelperPreviewContext): ReactNode;
}

export interface EditorHelperPreviewContext {
  onImageInsert?(mode: EditorImageInsertMode): void;
}

export type EditorImageInsertMode = 'link' | 'copy';

export interface EditorImageActions {
  insertSelectedImage(textarea: HTMLTextAreaElement | null, activeFile: OpenFile | null, mode: EditorImageInsertMode): Promise<void>;
}

export interface EditorHandlerContext {
  activeFile: OpenFile | null;
  textareaRef: RefObject<HTMLTextAreaElement>;
  refreshWorkspace(): void;
}

export interface EditorEventHandlers {
  windowDragOver?(event: DragEvent, ctx: EditorHandlerContext): void;
  windowDrop?(event: DragEvent, ctx: EditorHandlerContext): void;
  textareaDragOver?(event: ReactDragEvent<HTMLTextAreaElement>, ctx: EditorHandlerContext): void;
  textareaDrop?(event: ReactDragEvent<HTMLTextAreaElement>, ctx: EditorHandlerContext): void;
  paste?(event: ReactClipboardEvent<HTMLTextAreaElement>, ctx: EditorHandlerContext): void;
}

export interface CommandContribution {
  id: string;
  label: string;
  run(): void | Promise<void>;
  isEnabled?(): boolean;
  defaultShortcut?: string;
  keywords?: string[];
  menu?: { section: string; label?: string; group?: string; order?: number };
}

export type CommandContributionFactory = (ctx: CommandRuntimeContext) => CommandContribution[];

export interface CommandRuntimeContext {
  file: {
    newFile(): void;
    openFile(): void;
    openFolder(): void;
    save(): void;
    saveAs(): void;
    print(): void;
    close(): void;
  };
  window: {
    newWindow(): void;
    close(): void;
  };
  editor: {
    hasTarget(): boolean;
    toggleBold(): void;
    toggleItalic(): void;
  };
  view: {
    openSettings(): void;
    setMode(mode: 'edit' | 'split' | 'preview'): void;
    canSetMode(mode: 'edit' | 'split' | 'preview'): boolean;
    toggleSidebar(): void;
  };
  search: {
    openFind(): void;
    openReplace(): void;
  };
  palette: {
    open(): void;
  };
}

export interface MetadataContribution {
  readLayout(file: OpenFile): Promise<BlockLayout[]>;
  writeLayout(layout: BlockLayout): Promise<void>;
}

export interface PdfContribution {
  exportCurrent(): Promise<void>;
}

export type PreviewResult =
  | {
      kind: 'html';
      html: string;
      renderMode?: 'default' | 'browser-frame';
      scene?: PreviewRenderScene;
    }
  | {
      kind: 'react';
      node: ReactNode;
      renderKey?: string;
      scene?: PreviewRenderScene;
    };
