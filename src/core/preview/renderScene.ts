import type { PreviewBoxSnapshot, PreviewRenderBox } from './renderObjectTypes';

export type PreviewRenderSceneId = `preview-scene:${string}`;
export type PreviewSceneDomKey = `preview-dom:${string}`;
export type PreviewRenderSceneSource = 'markdown' | 'html' | 'react' | 'text';

export interface PreviewRenderSceneEntry {
  readonly box: PreviewRenderBox;
  readonly domKey: PreviewSceneDomKey;
  readonly sourceLine: number | null;
  readonly sourceEndLine: number | null;
}

export interface PreviewRenderSceneSnapshot {
  readonly id: PreviewRenderSceneId;
  readonly source: PreviewRenderSceneSource;
  readonly boxes: readonly PreviewBoxSnapshot[];
}

export class PreviewRenderScene {
  readonly id: PreviewRenderSceneId;
  readonly source: PreviewRenderSceneSource;
  readonly entries: readonly PreviewRenderSceneEntry[];

  constructor(id: PreviewRenderSceneId, source: PreviewRenderSceneSource, entries: readonly PreviewRenderSceneEntry[]) {
    this.id = id;
    this.source = source;
    this.entries = entries;
  }

  get boxes(): readonly PreviewRenderBox[] {
    return this.entries.map((entry) => entry.box);
  }

  snapshot(): PreviewRenderSceneSnapshot {
    return {
      id: this.id,
      source: this.source,
      boxes: this.entries.map((entry) => entry.box.snapshot()),
    };
  }
}

export function previewRenderSceneId(seed: string): PreviewRenderSceneId {
  return `preview-scene:${seed}`;
}

export function previewSceneDomKey(seed: string): PreviewSceneDomKey {
  return `preview-dom:${seed}`;
}
