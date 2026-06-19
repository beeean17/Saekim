import { reusePreviewLayoutBlocks } from '../../features/block-layout/preview';

export function replacePreviewHtml(root: HTMLElement, html: string): void {
  try {
    replacePreviewHtmlWithReuse(root, html);
  } catch (error) {
    console.error('failed to reuse preview DOM; replacing preview without reuse', error);
    replacePreviewHtmlWithoutReuse(root, html);
  }
}

function replacePreviewHtmlWithReuse(root: HTMLElement, html: string): void {
  const reusableImages = collectReusableImages(root);
  const template = document.createElement('template');
  template.innerHTML = html;
  reuseExistingImages(template.content, reusableImages);
  reusePreviewLayoutBlocks(root, template.content);
  root.replaceChildren(...Array.from(template.content.childNodes));
}

function replacePreviewHtmlWithoutReuse(root: HTMLElement, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  root.replaceChildren(...Array.from(template.content.childNodes));
}

function collectReusableImages(root: HTMLElement): Map<string, HTMLImageElement[]> {
  const imagesByKey = new Map<string, HTMLImageElement[]>();
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const key = imageReuseKey(image);
    if (!key) return;
    const images = imagesByKey.get(key) ?? [];
    images.push(image);
    imagesByKey.set(key, images);
  });
  return imagesByKey;
}

function reuseExistingImages(root: ParentNode, reusableImages: Map<string, HTMLImageElement[]>): void {
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const key = imageReuseKey(image);
    const reusableImage = key ? reusableImages.get(key)?.shift() : null;
    if (!reusableImage) return;

    syncReusableImageAttributes(reusableImage, image);
    image.replaceWith(reusableImage);
  });
}

function syncReusableImageAttributes(target: HTMLImageElement, source: HTMLImageElement): void {
  const sameOriginalSrc =
    Boolean(target.getAttribute('data-original-src')) &&
    target.getAttribute('data-original-src') === source.getAttribute('data-original-src');

  Array.from(target.attributes).forEach((attribute) => {
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  });
  Array.from(source.attributes).forEach((attribute) => {
    if (attribute.name === 'src' && (sameOriginalSrc || target.getAttribute('src') === attribute.value)) return;
    target.setAttribute(attribute.name, attribute.value);
  });
  target.className = source.className;
}

function imageReuseKey(image: HTMLImageElement): string | null {
  const originalSrc = image.getAttribute('data-original-src');
  if (originalSrc) return originalSrc;

  const src = image.getAttribute('src');
  if (!src) return null;
  return src;
}
