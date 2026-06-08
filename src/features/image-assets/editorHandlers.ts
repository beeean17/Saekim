import type { EditorContribution, EditorHandlerContext, EditorImageInsertMode } from '../../app/feature';
import { insertTextAtSelection, escapeRegExp, replaceTextRange } from '../../core/editor/textEditing';
import { Backend } from '../../lib/backend';
import { isTauriRuntime } from '../../lib/tauri/invoke';
import type { OpenFile } from '../../types/workspace';

type DroppedImage =
  | { type: 'remote'; url: string }
  | { type: 'file'; file: File };

const MAX_DROPPED_IMAGE_BYTES = 20 * 1024 * 1024;

interface ImageDownloadProgressPayload {
  id: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  progress: number | null;
  message?: string;
}

export const imageAssetsEditorContribution: EditorContribution = {
  handlers: {
    windowDragOver(event) {
      if (!event.dataTransfer || !hasPotentialImageDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    windowDrop(event, ctx) {
      if (event.defaultPrevented || !event.dataTransfer) return;
      if (!hasPotentialImageDrop(event.dataTransfer)) return;
      const droppedImage = getDroppedImage(event.dataTransfer);

      const textarea = ctx.textareaRef.current;
      if (!textarea) return;

      event.preventDefault();
      event.stopPropagation();
      textarea.focus();
      if (droppedImage) {
        void insertDroppedImage(textarea, ctx.activeFile, droppedImage).then(ctx.refreshWorkspace);
      } else {
        insertDroppedImageHelp(textarea);
      }
    },
    textareaDragOver(event) {
      if (!hasPotentialImageDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    textareaDrop(event, ctx) {
      if (!hasPotentialImageDrop(event.dataTransfer)) return;
      const droppedImage = getDroppedImage(event.dataTransfer);
      event.preventDefault();
      event.stopPropagation();
      if (droppedImage) {
        void insertDroppedImage(event.currentTarget, ctx.activeFile, droppedImage).then(ctx.refreshWorkspace);
      } else {
        insertDroppedImageHelp(event.currentTarget);
      }
    },
    paste(event, ctx) {
      const imageFile = getClipboardImageFile(event.clipboardData);
      if (!imageFile) return;

      event.preventDefault();
      event.stopPropagation();
      void insertPastedImageFile(event.currentTarget, ctx.activeFile, imageFile).then(ctx.refreshWorkspace);
    },
  },
  imageActions: {
    insertSelectedImage,
  },
};

export async function insertSelectedImage(
  textarea: HTMLTextAreaElement | null,
  activeFile: OpenFile | null,
  mode: EditorImageInsertMode,
): Promise<void> {
  if (!textarea) return;

  let currentFilePath = '';
  if (mode === 'copy') {
    try {
      currentFilePath = requireSavedActiveFile(activeFile);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
      textarea.focus();
      return;
    }
  }

  const path = await Backend.pickImagePath();
  if (!path) {
    textarea.focus();
    return;
  }

  if (mode === 'link') {
    insertTextAtSelection(textarea, markdownImageSnippet(path));
    return;
  }

  try {
    const assetPath = await Backend.copyImageToAssets(path, currentFilePath);
    insertTextAtSelection(textarea, markdownImageSnippet(assetPath));
  } catch (error) {
    console.error('이미지 복사 실패:', error);
    window.alert(error instanceof Error ? error.message : '이미지 복사에 실패했습니다.');
    textarea.focus();
  }
}

function hasPotentialImageDrop(dataTransfer: DataTransfer): boolean {
  const types = Array.from(dataTransfer.types);
  if (['text/uri-list', 'text/html'].some((type) => types.includes(type))) return true;
  return Array.from(dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

async function insertDroppedRemoteImage(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, imageUrl: string): Promise<void> {
  let currentFilePath = '';
  try {
    currentFilePath = requireSavedActiveFile(activeFile);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
    textarea.focus();
    return;
  }

  const id = `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pendingMarker = pendingImageSnippet(id, 0);
  insertTextAtSelection(textarea, pendingMarker);

  let unlisten: (() => void) | null = null;
  try {
    if (isTauriRuntime()) {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<ImageDownloadProgressPayload>('image-download-progress', (event) => {
        if (event.payload.id !== id || event.payload.status !== 'progress') return;
        replacePendingImageMarker(textarea, id, pendingImageSnippet(id, event.payload.progress));
      });
    }

    const assetPath = await Backend.downloadImageToAssets(id, imageUrl, currentFilePath);
    replacePendingImageMarker(textarea, id, markdownImageSnippet(assetPath));
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 다운로드에 실패했습니다.';
    console.error('이미지 다운로드 실패:', error);
    replacePendingImageMarker(textarea, id, failedImageSnippet(id, message));
  } finally {
    unlisten?.();
    textarea.focus();
  }
}

async function insertDroppedImage(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, droppedImage: DroppedImage): Promise<void> {
  if (droppedImage.type === 'remote') {
    await insertDroppedRemoteImage(textarea, activeFile, droppedImage.url);
    return;
  }

  await insertDroppedImageFile(textarea, activeFile, droppedImage.file);
}

async function insertDroppedImageFile(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, file: File): Promise<void> {
  await insertImageFileFromBytes(textarea, activeFile, file, {
    fileName: file.name || null,
    selectAltAfterInsert: false,
  });
}

async function insertPastedImageFile(textarea: HTMLTextAreaElement, activeFile: OpenFile | null, file: File): Promise<void> {
  await insertImageFileFromBytes(textarea, activeFile, file, {
    fileName: clipboardImageFileName(file),
    selectAltAfterInsert: true,
  });
}

async function insertImageFileFromBytes(
  textarea: HTMLTextAreaElement,
  activeFile: OpenFile | null,
  file: File,
  options: { fileName: string | null; selectAltAfterInsert: boolean },
): Promise<void> {
  let currentFilePath = '';
  try {
    currentFilePath = requireSavedActiveFile(activeFile);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
    textarea.focus();
    return;
  }

  if (file.size > MAX_DROPPED_IMAGE_BYTES) {
    window.alert('이미지는 20MB 이하만 가져올 수 있습니다.');
    textarea.focus();
    return;
  }

  const id = `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  insertTextAtSelection(textarea, pendingImageSnippet(id, null));

  try {
    const bytes = await fileToByteArray(file);
    const assetPath = await Backend.importImageBytesToAssets(bytes, options.fileName, file.type || null, currentFilePath);
    if (options.selectAltAfterInsert) {
      replacePendingImageMarkerWithSelectedAlt(textarea, id, assetPath);
    } else {
      replacePendingImageMarker(textarea, id, markdownImageSnippet(assetPath));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 가져오기에 실패했습니다.';
    console.error('이미지 가져오기 실패:', error);
    replacePendingImageMarker(textarea, id, failedImageSnippet(id, message));
  } finally {
    textarea.focus();
  }
}

function insertDroppedImageHelp(textarea: HTMLTextAreaElement): void {
  insertTextAtSelection(
    textarea,
    failedImageSnippet(
      `help-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      '이미지 주소를 찾지 못했습니다. 검색 결과나 게시글 링크는 이미지로 가져올 수 없습니다. 이미지 우클릭 후 이미지 주소 복사를 사용하거나, 이미지 버튼의 URL 가져오기를 사용하세요.',
    ),
  );
}

function markdownImageSnippet(path: string, altText?: string): string {
  const name = fileNameFromPath(path);
  const alt = altText ?? (name.replace(/\.[^.]+$/, '') || '이미지');
  return `![${alt}](<${escapeMarkdownDestination(path)}>)`;
}

function pendingImageSnippet(id: string, progress: number | null): string {
  const label = progress === null ? '이미지 다운로드 중' : `이미지 다운로드 중 ${progress}%`;
  return `![${label}](saekim-pending-image://${id})`;
}

function failedImageSnippet(id: string, message: string): string {
  return `![이미지 다운로드 실패: ${escapeMarkdownAlt(message)}](saekim-failed-image://${id})`;
}

function requireSavedActiveFile(activeFile: OpenFile | null): string {
  if (!activeFile || activeFile.path.startsWith('~') || activeFile.path.startsWith('browser://')) {
    throw new Error('이미지를 assets로 가져오려면 먼저 현재 문서를 저장해야 합니다.');
  }
  return activeFile.path;
}

function extractRemoteImageUrl(dataTransfer: DataTransfer): string | null {
  const uri = dataTransfer.getData('text/uri-list').split('\n').find((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });
  const plain = dataTransfer.getData('text/plain').trim();
  const html = dataTransfer.getData('text/html');
  const htmlSrc = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? '';
  const cssUrl = html.match(/url\(["']?([^"')]+)["']?\)/i)?.[1] ?? '';

  return [uri, htmlSrc, cssUrl, plain].map((value) => value?.trim() ?? '').find(isRemoteHttpUrl) ?? null;
}

function getDroppedImage(dataTransfer: DataTransfer): DroppedImage | null {
  const imageUrl = extractRemoteImageUrl(dataTransfer);
  if (imageUrl) return { type: 'remote', url: imageUrl };

  const imageFile = extractDroppedImageFile(dataTransfer);
  return imageFile ? { type: 'file', file: imageFile } : null;
}

function extractDroppedImageFile(dataTransfer: DataTransfer): File | null {
  const files = Array.from(dataTransfer.files);
  const imageFile = files.find((file) => isImageFile(file));
  if (imageFile) return imageFile;

  const items = Array.from(dataTransfer.items);
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) return file;
  }

  return null;
}

function getClipboardImageFile(clipboardData: DataTransfer): File | null {
  const items = Array.from(clipboardData.items);
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) return file;
  }

  return Array.from(clipboardData.files).find((file) => isImageFile(file)) ?? null;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|bmp|ico|avif)$/i.test(file.name);
}

async function fileToByteArray(file: File): Promise<number[]> {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

function clipboardImageFileName(file: File): string {
  if (file.name && file.name.trim()) return file.name;

  return `clipboard-image-${formatClipboardTimestamp(new Date())}.${imageExtensionFromMime(file.type)}`;
}

function formatClipboardTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function imageExtensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/bmp':
      return 'bmp';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'ico';
    case 'image/png':
    default:
      return 'png';
  }
}

function isRemoteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? 'image';
}

function escapeMarkdownDestination(path: string): string {
  return path.replace(/\\/g, '/').replace(/>/g, '%3E');
}

function escapeMarkdownAlt(value: string): string {
  return value.replace(/]/g, '\\]');
}

function replacePendingImageMarker(textarea: HTMLTextAreaElement, id: string, replacement: string): void {
  const markerPattern = new RegExp(`!\\[[^\\]]*\\]\\(saekim-(?:pending|failed)-image://${escapeRegExp(id)}\\)`);
  const match = textarea.value.match(markerPattern);
  if (!match || match.index === undefined) return;

  replaceTextRange(textarea, match.index, match.index + match[0].length, replacement);
}

function replacePendingImageMarkerWithSelectedAlt(textarea: HTMLTextAreaElement, id: string, assetPath: string): void {
  const markerPattern = new RegExp(`!\\[[^\\]]*\\]\\(saekim-(?:pending|failed)-image://${escapeRegExp(id)}\\)`);
  const match = textarea.value.match(markerPattern);
  if (!match || match.index === undefined) return;

  const altText = 'image';
  const replacement = markdownImageSnippet(assetPath, altText);
  const start = match.index;
  replaceTextRange(textarea, start, start + match[0].length, replacement);
  textarea.focus();
  textarea.selectionStart = start + 2;
  textarea.selectionEnd = start + 2 + altText.length;
}
