import type { ReactNode } from 'react';
import type { FileTypeContribution, FileTypeInfo } from '../core/document/fileType';
import type { PlatformCapability } from '../platform/common/capabilities';
import type { HtmlPreviewMode } from '../types/session';
import type { ThemeName, OpenFile } from '../types/workspace';

export interface SaekimFeature {
  id: string;
  label: string;
  dependsOn?: string[];
  requiresCapabilities?: FeatureCapabilityRequirements;
  preview?: PreviewContribution | PreviewContribution[];
  fileTypes?: FileTypeContribution | FileTypeContribution[];
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
