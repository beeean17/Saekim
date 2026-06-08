import type { PreviewContribution } from '../../app/feature';
import { Backend } from '../../platform/common/backend';

type CleanupRef = {
  current: (() => void) | null;
};

const externalLinkCleanups = new WeakMap<HTMLElement, () => void>();
const imageLoadCleanups = new WeakMap<HTMLElement, () => void>();

export const externalLinkPreviewEnhancement: PreviewContribution = {
  id: 'core.preview.external-links',
  priority: -80,
  match: () => true,
  afterRender(root) {
    cleanupExternalLinks(root);

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') ?? '';
      if (!rawHref || rawHref.startsWith('#')) return;
      if (!Backend.runtime.isExternalUrl(anchor.href)) return;

      event.preventDefault();
      void Backend.runtime.openExternalUrl(anchor.href);
    };

    root.addEventListener('click', onClick);
    externalLinkCleanups.set(root, () => root.removeEventListener('click', onClick));
  },
  cleanup(root) {
    cleanupExternalLinks(root);
  },
};

export const imageLoadPreviewEnhancement: PreviewContribution = {
  id: 'core.preview.image-loads',
  priority: -90,
  match: () => true,
  afterRender(root) {
    cleanupImageLoads(root);

    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
    if (images.length === 0) return;

    const onLoad = (event: Event) => {
      if (event.currentTarget instanceof HTMLImageElement) {
        event.currentTarget.classList.remove('image-load-failed');
      }
      notifyPreviewRendered(root);
    };
    const onError = (event: Event) => {
      if (event.currentTarget instanceof HTMLImageElement) {
        event.currentTarget.classList.add('image-load-failed');
      }
      notifyPreviewRendered(root);
    };

    images.forEach((image) => {
      image.addEventListener('load', onLoad);
      image.addEventListener('error', onError);
    });

    imageLoadCleanups.set(root, () => {
      images.forEach((image) => {
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
      });
    });
  },
  cleanup(root) {
    cleanupImageLoads(root);
  },
};

export function notifyPreviewRendered(root: HTMLElement | null): void {
  root?.dispatchEvent(new CustomEvent('saekim-preview-rendered', { bubbles: false }));
}

export function bindHtmlPreviewFrame(
  frame: HTMLIFrameElement | null,
  root: HTMLElement | null,
  cleanupRef: CleanupRef,
): void {
  cleanupRef.current?.();
  cleanupRef.current = null;

  const doc = frame?.contentDocument;
  if (!frame || !doc) return;

  const syncHeight = () => {
    const bodyHeight = doc.body?.scrollHeight ?? 0;
    const documentHeight = doc.documentElement?.scrollHeight ?? 0;
    frame.style.height = `${Math.max(bodyHeight, documentHeight, root?.clientHeight ?? 0)}px`;
    notifyPreviewRendered(root);
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;

    const rawHref = anchor.getAttribute('href') ?? '';
    if (!rawHref || rawHref.startsWith('#')) return;
    if (!Backend.runtime.isExternalUrl(anchor.href)) return;

    event.preventDefault();
    void Backend.runtime.openExternalUrl(anchor.href);
  };

  const observer = new ResizeObserver(syncHeight);
  observer.observe(doc.documentElement);
  if (doc.body) observer.observe(doc.body);
  doc.addEventListener('click', onClick);
  requestAnimationFrame(syncHeight);

  cleanupRef.current = () => {
    observer.disconnect();
    doc.removeEventListener('click', onClick);
  };
}

function cleanupExternalLinks(root: HTMLElement): void {
  externalLinkCleanups.get(root)?.();
  externalLinkCleanups.delete(root);
}

function cleanupImageLoads(root: HTMLElement): void {
  imageLoadCleanups.get(root)?.();
  imageLoadCleanups.delete(root);
}
