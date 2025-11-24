/**
 * Editor module for text input and editing
 */

const EditorModule = {
    editor: null,
    wordCountDisplay: null,
    autoSaveTimeout: null,
    autoSaveDelay: 5000, // 5 seconds
    autoSaveEnabled: false, // TODO: 임시 비활성화

    /**
     * Initialize the editor
     */
    init() {
        this.editor = document.getElementById('editor');
        this.wordCountDisplay = document.getElementById('word-count');

        if (!this.editor) {
            console.error('❌ Editor element not found');
            return;
        }

        this.setupEventListeners();
        this.updateWordCount();

        console.log('✅ Editor 모듈 초기화 완료');
    },

    /**
     * Setup editor event listeners
     */
    setupEventListeners() {
        // Update preview on input (debounced)
        const updatePreview = Utils.debounce(() => {
            const content = this.getContent();

            // Update preview
            if (typeof PreviewModule !== 'undefined') {
                PreviewModule.update(content);
            }

            // Mark as dirty
            if (typeof App !== 'undefined') {
                App.markDirty();
                App.saveState(); // Auto-save to localStorage
            }
        }, 300);

        this.editor.addEventListener('input', () => {
            this.updateWordCount();
            updatePreview();

            // Trigger auto-save (debounced)
            this.scheduleAutoSave();
        });

        // Update cursor position on selection change
        this.editor.addEventListener('selectionchange', () => {
            this.updateCursorPosition();
        });

        this.editor.addEventListener('keydown', () => {
            this.updateCursorPosition();
        });

        this.editor.addEventListener('click', () => {
            this.updateCursorPosition();
        });

        // Tab key handling
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertTab();
            }
        });

        // Scroll synchronization
        this.editor.addEventListener('scroll', () => {
            if (typeof PreviewModule !== 'undefined') {
                PreviewModule.syncScroll(this.editor);
            }
        });
    },

    /**
     * Get editor content
     */
    getContent() {
        return this.editor ? this.editor.value : '';
    },

    /**
     * Set editor content
     */
    setContent(content) {
        if (this.editor) {
            this.editor.value = content;
            this.updateWordCount();

            if (typeof PreviewModule !== 'undefined') {
                PreviewModule.update(content);
            }
        }
    },

    /**
     * Insert text at cursor position
     */
    insertText(text) {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const content = this.editor.value;

        this.editor.value = content.substring(0, start) + text + content.substring(end);
        this.editor.selectionStart = this.editor.selectionEnd = start + text.length;
        this.editor.focus();

        // Trigger input event to update preview
        this.editor.dispatchEvent(new Event('input'));
    },

    /**
     * Insert tab character
     */
    insertTab() {
        this.insertText('    '); // 4 spaces
    },

    /**
     * Wrap selected text with given strings
     */
    wrapSelection(before, after) {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);
        const replacement = before + selectedText + after;

        this.insertText(replacement);

        // Reselect the text
        const newStart = start + before.length;
        const newEnd = newStart + selectedText.length;
        this.editor.selectionStart = newStart;
        this.editor.selectionEnd = newEnd;
    },

    /**
     * Update word count display
     */
    updateWordCount() {
        if (!this.wordCountDisplay) return;

        const content = this.getContent();
        const wordCount = Utils.countWords(content);
        const charCount = Utils.countCharacters(content);

        this.wordCountDisplay.textContent = `${wordCount} 단어`;
        this.wordCountDisplay.title = `${wordCount} 단어, ${charCount} 글자`;
    },

    /**
     * Update cursor position display
     */
    updateCursorPosition() {
        if (!this.editor) return;

        const position = Utils.getCursorPosition(this.editor);
        const content = this.getContent();
        const wordCount = Utils.countWords(content);
        const charCount = Utils.countCharacters(content);

        // Update status bar via backend
        if (typeof App !== 'undefined' && App.backend) {
            App.backend.update_status_bar(position.line, position.column, wordCount, charCount);
        }
    },

    /**
     * Schedule auto-save (debounced)
     */
    scheduleAutoSave() {
        if (!this.autoSaveEnabled) return;

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Schedule new auto-save
        this.autoSaveTimeout = setTimeout(() => {
            this.performAutoSave();
        }, this.autoSaveDelay);
    },

    /**
     * Perform auto-save
     * Only saves if there's a current file (doesn't open Save As dialog)
     */
    async performAutoSave() {
        // Only auto-save if App and backend are available
        if (typeof App === 'undefined' || !App.backend) {
            return;
        }

        // Check if there's a current file
        if (!App.state || !App.state.currentFile) {
            // No file opened yet, don't auto-save
            return;
        }

        try {
            const content = this.getContent();

            // Show auto-saving indicator
            if (typeof Utils !== 'undefined') {
                Utils.showToast('자동 저장 중...', 'info', 1000);
            }

            // Save via backend
            const resultJson = await new Promise((resolve) => {
                App.backend.save_file(content, resolve);
            });

            const result = JSON.parse(resultJson);

            if (result.success) {
                console.log('✅ 자동 저장 완료:', result.filepath);
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('자동 저장 완료', 'success', 1500);
                }
            } else if (result.error && result.error !== 'Cancelled') {
                console.error('❌ 자동 저장 실패:', result.error);
                // Don't show error toast for auto-save failures
            }
        } catch (error) {
            console.error('❌ 자동 저장 오류:', error);
        }
    },

    /**
     * Enable auto-save
     */
    enableAutoSave() {
        this.autoSaveEnabled = true;
        console.log('✅ 자동 저장 활성화');
    },

    /**
     * Disable auto-save
     */
    disableAutoSave() {
        this.autoSaveEnabled = false;

        // Clear pending auto-save
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }

        console.log('⏸️ 자동 저장 비활성화');
    },

    /**
     * Apply formatting to selected text
     */
    format: {
        bold() {
            EditorModule.wrapSelection('**', '**');
        },

        italic() {
            EditorModule.wrapSelection('*', '*');
        },

        strikethrough() {
            EditorModule.wrapSelection('~~', '~~');
        },

        code() {
            EditorModule.wrapSelection('`', '`');
        },

        codeBlock(language = '') {
            EditorModule.wrapSelection(`\n\`\`\`${language}\n`, '\n```\n');
        },

        heading(level) {
            const prefix = '#'.repeat(level) + ' ';
            EditorModule.insertText(prefix);
        },

        link() {
            EditorModule.wrapSelection('[', '](url)');
        },

        async image() {
            // Call backend to select and copy image
            if (typeof App === 'undefined' || !App.backend) {
                // Fallback to simple text insertion if backend not available
                EditorModule.wrapSelection('![', '](url)');
                return;
            }

            try {
                // Show loading toast
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('이미지 선택 중...', 'info');
                }

                // Call backend to select image
                const resultJson = await new Promise((resolve) => {
                    App.backend.select_and_insert_image(resolve);
                });

                const result = JSON.parse(resultJson);

                if (result.success) {
                    // Get selected text (for alt text)
                    const editor = document.getElementById('editor');
                    const start = editor.selectionStart;
                    const end = editor.selectionEnd;
                    const selectedText = editor.value.substring(start, end);

                    // Default alt text
                    const altText = selectedText || '이미지';

                    // Insert markdown image syntax with relative path
                    const imageMarkdown = `![${altText}](${result.relative_path})`;
                    EditorModule.insertText(imageMarkdown);

                    // Show success message
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('이미지가 추가되었습니다', 'success');
                    }

                    console.log('✅ 이미지 삽입:', result.relative_path);
                } else if (result.error && result.error !== 'Cancelled') {
                    // Show error (but not for user cancellation)
                    console.error('❌ 이미지 선택 실패:', result.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('이미지 선택 실패: ' + result.error, 'error');
                    }
                }
            } catch (error) {
                console.error('❌ 이미지 삽입 오류:', error);
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('이미지 삽입 중 오류 발생', 'error');
                }
            }
        },

        bulletList() {
            EditorModule.insertText('- ');
        },

        numberedList() {
            EditorModule.insertText('1. ');
        },

        quote() {
            EditorModule.insertText('> ');
        },

        horizontalRule() {
            EditorModule.insertText('\n---\n');
        }
    }
};
