import type { PreviewRenderScene } from './renderScene';

export function mountDomBackedPreviewScene(root: HTMLElement, scene: PreviewRenderScene | null): void {
  clearDomBackedPreviewScene(root);
  if (!scene) return;

  root.dataset.previewSceneId = scene.id;
  root.dataset.previewSceneSource = scene.source;
  root.dataset.previewSceneBoxCount = String(scene.entries.length);

  const elementsByKey = collectSceneElements(root);
  const rootRect = root.getBoundingClientRect();

  scene.entries.forEach((entry) => {
    const element = elementsByKey.get(entry.domKey);
    if (!element) return;

    const target = element.closest<HTMLElement>('.preview-layout-block') ?? element;
    annotateSceneElement(target, entry, rootRect, root.scrollLeft, root.scrollTop);
    if (target !== element) annotateSceneElement(element, entry, rootRect, root.scrollLeft, root.scrollTop);
  });
}

export function clearDomBackedPreviewScene(root: HTMLElement): void {
  delete root.dataset.previewSceneId;
  delete root.dataset.previewSceneSource;
  delete root.dataset.previewSceneBoxCount;

  root.querySelectorAll<HTMLElement>('[data-preview-box-id]').forEach((element) => {
    element.classList.remove('preview-render-box');
    delete element.dataset.previewBoxId;
    delete element.dataset.previewBoxKind;
    delete element.dataset.previewBoxFlow;
    delete element.dataset.previewBoxZIndex;
    delete element.dataset.previewBoxSourceLine;
    delete element.dataset.previewBoxSourceEndLine;
  });
}

function collectSceneElements(root: HTMLElement): Map<string, HTMLElement> {
  const elementsByKey = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>('[data-preview-box-key]').forEach((element) => {
    const key = element.dataset.previewBoxKey;
    if (key && !elementsByKey.has(key)) elementsByKey.set(key, element);
  });
  return elementsByKey;
}

function annotateSceneElement(
  element: HTMLElement,
  entry: PreviewRenderScene['entries'][number],
  rootRect: DOMRect,
  scrollLeft: number,
  scrollTop: number,
): void {
  const rect = element.getBoundingClientRect();
  entry.box.setBounds({
    x: Math.round(rect.left - rootRect.left + scrollLeft),
    y: Math.round(rect.top - rootRect.top + scrollTop),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });

  element.classList.add('preview-render-box');
  element.dataset.previewBoxId = entry.box.id;
  element.dataset.previewBoxKind = entry.box.kind;
  element.dataset.previewBoxFlow = entry.box.flow;
  element.dataset.previewBoxZIndex = String(entry.box.zIndex);
  if (entry.sourceLine !== null) element.dataset.previewBoxSourceLine = String(entry.sourceLine);
  if (entry.sourceEndLine !== null) element.dataset.previewBoxSourceEndLine = String(entry.sourceEndLine);
}
