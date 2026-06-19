import type { PreviewContribution, PreviewRenderContext, PreviewResult } from '../../app/feature';
import { clearDomBackedPreviewScene, mountDomBackedPreviewScene } from './domBackedScene';
import type { PreviewRendererContribution, PreviewRenderSnapshot } from './renderTypes';

const PREVIEW_ERROR_RESULT: PreviewResult = {
  kind: 'html',
  html: '<div class="preview-error-panel compact"><strong>Preview failed</strong><pre>미리보기를 렌더링하지 못했습니다.</pre></div>',
};

interface PreviewRenderTaskOptions {
  readonly context: PreviewRenderContext;
  readonly renderer: PreviewRendererContribution;
  readonly enhancements: readonly PreviewContribution[];
  readonly delayMs: number;
  readonly onComplete: (snapshot: PreviewRenderSnapshot) => void;
  readonly onError: (message: string, error: Error) => void;
}

interface PreviewDomLifecycleOptions {
  readonly root: HTMLElement;
  readonly snapshot: PreviewRenderSnapshot;
  readonly onRendered: (root: HTMLElement) => void;
  readonly onError: (message: string, error: Error) => void;
}

export class PreviewRenderTask {
  private controller: AbortController | null = null;
  private timer: number | null = null;

  constructor(private readonly options: PreviewRenderTaskOptions) {}

  start(): void {
    this.timer = window.setTimeout(() => this.render(), this.options.delayMs);
  }

  cancel(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.controller?.abort();
    this.controller = null;
  }

  private render(): void {
    this.timer = null;
    const controller = new AbortController();
    this.controller = controller;
    const context = { ...this.options.context, signal: controller.signal };

    void Promise.resolve(this.options.renderer.render(context))
      .then((result) => this.complete(controller, result))
      .catch((error: unknown) => {
        if (error instanceof Error) {
          this.fail(controller, error);
          return;
        }
        this.fail(controller, new PreviewUnknownError('Preview render failed with a non-Error value', error));
      });
  }

  private complete(controller: AbortController, result: PreviewResult): void {
    if (!this.isActive(controller)) return;
    this.options.onComplete(this.snapshot(result));
  }

  private fail(controller: AbortController, error: Error): void {
    if (!this.isActive(controller)) return;
    this.options.onError(`failed to render preview contribution "${this.options.renderer.id}"`, error);
    this.options.onComplete(this.snapshot(PREVIEW_ERROR_RESULT));
  }

  private snapshot(result: PreviewResult): PreviewRenderSnapshot {
    return {
      context: this.options.context,
      renderer: this.options.renderer,
      enhancements: this.options.enhancements,
      result,
    };
  }

  private isActive(controller: AbortController): boolean {
    return this.controller === controller && !controller.signal.aborted;
  }
}

export class PreviewDomLifecycle {
  private readonly controller = new AbortController();

  constructor(private readonly options: PreviewDomLifecycleOptions) {}

  start(): void {
    void this.run();
  }

  cleanup(): void {
    this.controller.abort();
    clearDomBackedPreviewScene(this.options.root);
    this.options.snapshot.renderer.cleanup?.(this.options.root);
    this.options.snapshot.enhancements.forEach((enhancement) => enhancement.cleanup?.(this.options.root));
  }

  private async run(): Promise<void> {
    try {
      const { root, snapshot } = this.options;
      const context = { ...snapshot.context, signal: this.controller.signal };
      const scene = snapshot.result.scene ?? null;

      await runAfterRender(snapshot.renderer, root, context, this.controller.signal);
      mountDomBackedPreviewScene(root, scene);
      for (const enhancement of snapshot.enhancements) {
        if (this.controller.signal.aborted) return;
        await runAfterRender(enhancement, root, context, this.controller.signal);
      }
      mountDomBackedPreviewScene(root, scene);
      if (!this.controller.signal.aborted) this.options.onRendered(root);
    } catch (error: unknown) {
      if (this.controller.signal.aborted) return;
      if (error instanceof Error) {
        this.options.onError('failed to run preview lifecycle', error);
        return;
      }
      this.options.onError(
        'failed to run preview lifecycle',
        new PreviewUnknownError('Preview lifecycle failed with a non-Error value', error),
      );
    }
  }
}

class PreviewUnknownError extends Error {
  readonly value: unknown;

  constructor(message: string, value: unknown) {
    super(message);
    this.name = 'PreviewUnknownError';
    this.value = value;
  }
}

async function runAfterRender(
  contribution: PreviewContribution,
  root: HTMLElement,
  context: PreviewRenderContext,
  signal: AbortSignal,
): Promise<void> {
  const result = contribution.afterRender?.(root, context, signal);
  if (isPromiseLike(result)) await result;
}

function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return Boolean(value && typeof value.then === 'function');
}
