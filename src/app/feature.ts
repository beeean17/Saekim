import type { ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent, ReactNode, RefObject } from 'react';
import type { EditorHelperItemBase } from '../core/editor/helperTypes';
import type { FileTypeContribution, FileTypeInfo } from '../core/document/fileType';
import type { PlatformCapability } from '../platform/common/capabilities';
import type { BlockLayout } from '../types/metadata';
import type { HtmlPreviewMode } from '../types/session';
import type { ThemeName, OpenFile } from '../types/workspace';

export interface SaekimFeature {
  id: string;
  label: string;
  dependsOn?: string[];
  requiresCapabilities?: FeatureCapabilityRequirements;
  preview?: PreviewContribution | PreviewContribution[];
  fileTypes?: FileTypeContribution | FileTypeContribution[];
  editor?: EditorContribution | EditorContribution[];
  commands?: CommandContributionFactory;
  metadata?: MetadataContribution | MetadataContribution[];
  pdf?: PdfContribution | PdfContribution[];
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
  theme: ThemeName;
  htmlPreviewMode: HtmlPreviewMode;
  setHtmlPreviewMode(value: HtmlPreviewMode): void;
  signal?: AbortSignal;
}

export interface EditorContribution {
  toolbar?: EditorToolbarItem[];
  helpers?: EditorHelperContribution[];
  handlers?: EditorEventHandlers;
  imageActions?: EditorImageActions;
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
  run(ctx: CommandRuntimeContext): void | Promise<void>;
  defaultShortcut?: string;
  menu?: { section: string; label: string };
}

export type CommandContributionFactory = (ctx: CommandRuntimeContext) => CommandContribution[];

export interface CommandRuntimeContext {
  search: {
    openFind(): void;
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
    }
  | {
      kind: 'react';
      node: ReactNode;
      renderKey?: string;
    };
