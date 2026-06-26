import type { PreviewContribution } from '../../app/feature';

const codeBlockCopyCleanups = new WeakMap<HTMLElement, () => void>();

interface CodeBlockCopyBinding {
  readonly button: HTMLButtonElement;
  onClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  resetTimer: number | null;
}

export const codeBlockCopyPreviewEnhancement: PreviewContribution = {
  id: 'preview-dom.code-block-copy',
  priority: -70,
  match: () => true,
  afterRender(root) {
    cleanupCodeBlockCopyButtons(root);

    const bindings = copyableCodeBlocks(root).map((block) => bindCodeBlockTypeButton(block));
    if (bindings.length === 0) return;

    codeBlockCopyCleanups.set(root, () => {
      bindings.forEach((binding) => {
        binding.button.removeEventListener('click', binding.onClick);
        binding.button.removeEventListener('pointerdown', binding.onPointerDown);
        if (binding.resetTimer !== null) window.clearTimeout(binding.resetTimer);
        binding.button.remove();
      });
    });
  },
  cleanup(root) {
    cleanupCodeBlockCopyButtons(root);
  },
};

function cleanupCodeBlockCopyButtons(root: HTMLElement): void {
  codeBlockCopyCleanups.get(root)?.();
  codeBlockCopyCleanups.delete(root);
  root.querySelectorAll('.code-type-button, .code-copy-button').forEach((button) => button.remove());
}

function copyableCodeBlocks(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('pre')).filter((block) => {
    if (block.classList.contains('plain-text-preview')) return false;
    if (!block.querySelector('code')) return false;
    return block.textContent !== null;
  });
}

function bindCodeBlockTypeButton(block: HTMLElement): CodeBlockCopyBinding {
  const source = codeBlockText(block);
  const label = codeBlockTypeLabel(block);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-type-button';
  button.setAttribute('aria-label', `${label} 코드 복사`);
  button.title = `${label} 코드 복사`;
  button.dataset.state = 'idle';
  button.textContent = label;

  const binding: CodeBlockCopyBinding = {
    button,
    onClick: () => undefined,
    onPointerDown: (event) => event.stopPropagation(),
    resetTimer: null,
  };

  binding.onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    void copyTextToClipboard(source)
      .then(() => setCopyButtonState(binding, 'copied'))
      .catch((error: unknown) => {
        console.warn('failed to copy code block', error);
        setCopyButtonState(binding, 'failed');
      });
  };

  button.addEventListener('click', binding.onClick);
  button.addEventListener('pointerdown', binding.onPointerDown);
  block.append(button);

  return binding;
}

function codeBlockTypeLabel(block: HTMLElement): string {
  return block.dataset.label || block.dataset.lang || (block.classList.contains('ascii-diagram') ? 'ascii' : 'code');
}

function codeBlockText(block: HTMLElement): string {
  const lines = Array.from(block.querySelectorAll<HTMLElement>('code .line'));
  if (lines.length > 0) {
    return lines.map((line) => line.textContent ?? '').join('\n');
  }

  return block.querySelector('code')?.textContent ?? '';
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (clipboardError: unknown) {
      try {
        fallbackCopyTextToClipboard(text);
        return;
      } catch (fallbackError: unknown) {
        throw clipboardCopyError(clipboardError, fallbackError);
      }
    }
  }

  fallbackCopyTextToClipboard(text);
}

function fallbackCopyTextToClipboard(text: string): void {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-1000px';
  textArea.style.opacity = '0';
  document.body.append(textArea);

  try {
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('document.execCommand("copy") returned false');
  } finally {
    textArea.remove();
  }
}

function setCopyButtonState(binding: CodeBlockCopyBinding, state: 'copied' | 'failed'): void {
  if (binding.resetTimer !== null) window.clearTimeout(binding.resetTimer);
  binding.button.dataset.state = state;
  binding.button.title = state === 'copied' ? '복사됨' : '복사 실패';
  binding.resetTimer = window.setTimeout(() => {
    binding.button.dataset.state = 'idle';
    binding.button.title = binding.button.getAttribute('aria-label') ?? '코드 복사';
    binding.resetTimer = null;
  }, 1400);
}

function clipboardCopyError(clipboardError: unknown, fallbackError: unknown): Error {
  return new Error(
    `clipboard copy failed: ${errorMessage(fallbackError)}; navigator.clipboard.writeText failed first: ${errorMessage(clipboardError)}`,
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
