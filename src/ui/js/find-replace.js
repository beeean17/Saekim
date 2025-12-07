/**
 * Find and Replace module - VS Code-style implementation
 * Features: Real-time highlighting, backdrop overlay, replace functionality
 */

const FindReplaceModule = {
    findDialogOpen: false,
    replaceExpanded: false,
    currentSearchTerm: '',
    currentReplaceTerm: '',
    caseSensitive: false,
    useRegex: false,
    wholeWord: false,
    matches: [],
    currentMatchIndex: -1,

    // DOM element references
    widget: null,
    findInput: null,
    replaceInput: null,
    backdrop: null,
    editor: null,

    /**
     * Show find dialog (toggle behavior)
     */
    showFind() {
        if (this.findDialogOpen) {
            this.closeDialog();
            return;
        }
        this.findDialogOpen = true;
        this.createFindDialog();
    },

    /**
     * Create VS Code-style find dialog
     */
    createFindDialog() {
        // Remove existing dialog
        this.closeDialog(false);

        // Get editor pane for positioning
        const editorPane = document.getElementById('editor-pane');
        if (!editorPane) return;

        // Create widget container
        const widget = document.createElement('div');
        widget.id = 'find-widget';
        widget.className = 'find-widget';
        widget.innerHTML = `
            <!-- Top Row: Toggle, Find Input, Options, Count, Nav, Close -->
            <div class="find-widget-row">
                <button class="find-toggle-btn" id="find-toggle-btn" title="바꾸기 토글">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="find-input-wrapper">
                    <input type="text" class="find-input" id="find-input" placeholder="찾기" spellcheck="false" />
                </div>
                <button class="find-option-btn" id="opt-case" title="대소문자 구분 (Alt+C)">Aa</button>
                <button class="find-option-btn" id="opt-word" title="전체 단어 일치 (Alt+W)">W</button>
                <button class="find-option-btn" id="opt-regex" title="정규식 사용 (Alt+R)">.*</button>
                <span class="find-result-count" id="find-result-count">결과 없음</span>
                <div class="find-separator"></div>
                <button class="find-nav-btn" id="find-prev-btn" title="이전 찾기 (Shift+Enter)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 9L7 5L11 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="find-nav-btn" id="find-next-btn" title="다음 찾기 (Enter)">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="find-close-btn" id="find-close-btn" title="닫기 (Escape)">✕</button>
            </div>
            <!-- Bottom Row: Replace Input, Replace Buttons (Collapsible) -->
            <div class="find-widget-row find-replace-row" id="find-replace-row">
                <div class="find-input-wrapper">
                    <input type="text" class="find-input" id="replace-input" placeholder="바꾸기" spellcheck="false" />
                </div>
                <button class="find-replace-btn" id="replace-btn" title="바꾸기 (Enter)">바꾸기</button>
                <button class="find-replace-btn" id="replace-all-btn" title="모두 바꾸기 (Ctrl+Alt+Enter)">모두 바꾸기</button>
            </div>
        `;

        // Insert into editor pane (inside pane-content for correct positioning)
        const paneContent = editorPane.querySelector('.pane-content');
        if (paneContent) {
            paneContent.appendChild(widget);
        } else {
            editorPane.appendChild(widget);
        }

        this.widget = widget;
        this.findInput = document.getElementById('find-input');
        this.replaceInput = document.getElementById('replace-input');
        this.backdrop = document.getElementById('highlight-backdrop');
        this.editor = document.getElementById('editor');

        // Initialize event listeners
        this.initEventListeners();

        // Focus find input
        this.findInput.focus();

        // If there's selected text, use it as search term
        if (this.editor && this.editor.selectionStart !== this.editor.selectionEnd) {
            const selectedText = this.editor.value.substring(this.editor.selectionStart, this.editor.selectionEnd);
            if (selectedText && !selectedText.includes('\n')) {
                this.findInput.value = selectedText;
                this.findInput.select();
                this.onFindInputChange();
            }
        }
    },

    /**
     * Initialize all event listeners
     */
    initEventListeners() {
        // Toggle button for replace row
        const toggleBtn = document.getElementById('find-toggle-btn');
        toggleBtn?.addEventListener('click', () => this.toggleReplaceRow());

        // Find input events
        this.findInput?.addEventListener('input', () => this.onFindInputChange());
        this.findInput?.addEventListener('keydown', (e) => this.onFindKeyDown(e));

        // Replace input events
        this.replaceInput?.addEventListener('keydown', (e) => this.onReplaceKeyDown(e));

        // Option buttons
        document.getElementById('opt-case')?.addEventListener('click', () => this.toggleOption('case'));
        document.getElementById('opt-word')?.addEventListener('click', () => this.toggleOption('word'));
        document.getElementById('opt-regex')?.addEventListener('click', () => this.toggleOption('regex'));

        // Navigation buttons
        document.getElementById('find-prev-btn')?.addEventListener('click', () => this.findPrevious());
        document.getElementById('find-next-btn')?.addEventListener('click', () => this.findNext());

        // Replace buttons
        document.getElementById('replace-btn')?.addEventListener('click', () => this.replace());
        document.getElementById('replace-all-btn')?.addEventListener('click', () => this.replaceAll());

        // Close button
        document.getElementById('find-close-btn')?.addEventListener('click', () => this.closeDialog());

        // Sync scroll between editor and backdrop
        this.editor?.addEventListener('scroll', () => this.syncBackdropScroll());

        // Update highlights on editor input
        this.editor?.addEventListener('input', () => {
            if (this.findInput?.value) {
                this.updateHighlights();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.findDialogOpen && this.findInput?.value) {
                this.updateHighlights();
            }
        });
    },

    /**
     * Toggle replace row visibility
     */
    toggleReplaceRow() {
        this.replaceExpanded = !this.replaceExpanded;
        const replaceRow = document.getElementById('find-replace-row');
        const toggleBtn = document.getElementById('find-toggle-btn');

        if (this.replaceExpanded) {
            replaceRow?.classList.add('visible');
            toggleBtn?.classList.add('expanded');
        } else {
            replaceRow?.classList.remove('visible');
            toggleBtn?.classList.remove('expanded');
        }
    },

    /**
     * Toggle search option
     */
    toggleOption(option) {
        const btn = document.getElementById(`opt-${option}`);

        switch (option) {
            case 'case':
                this.caseSensitive = !this.caseSensitive;
                btn?.classList.toggle('active', this.caseSensitive);
                break;
            case 'word':
                this.wholeWord = !this.wholeWord;
                btn?.classList.toggle('active', this.wholeWord);
                break;
            case 'regex':
                this.useRegex = !this.useRegex;
                btn?.classList.toggle('active', this.useRegex);
                break;
        }

        // Re-run search with new options
        this.onFindInputChange();
    },

    /**
     * Handle find input changes
     */
    onFindInputChange() {
        const searchTerm = this.findInput?.value || '';
        this.currentSearchTerm = searchTerm;

        if (searchTerm) {
            this.findMatches();
            this.updateHighlights();
            this.updateResultCount();

            // Auto-navigate to first match (without focusing editor to keep focus in find input)
            if (this.matches.length > 0 && this.currentMatchIndex === -1) {
                this.currentMatchIndex = 0;
                this.navigateToMatch(0, false); // false = don't focus editor
            }
        } else {
            this.clearHighlights();
            this.matches = [];
            this.currentMatchIndex = -1;
            this.updateResultCount();
        }
    },

    /**
     * Handle keydown in find input
     */
    onFindKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                this.findPrevious();
            } else {
                this.findNext();
            }
        } else if (e.key === 'Escape') {
            this.closeDialog();
        } else if (e.altKey) {
            switch (e.key.toLowerCase()) {
                case 'c':
                    e.preventDefault();
                    this.toggleOption('case');
                    break;
                case 'w':
                    e.preventDefault();
                    this.toggleOption('word');
                    break;
                case 'r':
                    e.preventDefault();
                    this.toggleOption('regex');
                    break;
            }
        }
    },

    /**
     * Handle keydown in replace input
     */
    onReplaceKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.ctrlKey && e.altKey) {
                this.replaceAll();
            } else {
                this.replace();
            }
        } else if (e.key === 'Escape') {
            this.closeDialog();
        }
    },

    /**
     * Find all matches in the editor content
     */
    findMatches() {
        if (!this.editor || !this.currentSearchTerm) {
            this.matches = [];
            return;
        }

        const content = this.editor.value;
        this.matches = [];

        let searchPattern;
        let searchTerm = this.currentSearchTerm;

        if (this.useRegex) {
            try {
                const flags = this.caseSensitive ? 'g' : 'gi';
                searchPattern = new RegExp(searchTerm, flags);
            } catch (e) {
                // Invalid regex
                return;
            }
        } else {
            // Escape special regex characters for literal search
            searchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            if (this.wholeWord) {
                searchTerm = `\\b${searchTerm}\\b`;
            }

            const flags = this.caseSensitive ? 'g' : 'gi';
            searchPattern = new RegExp(searchTerm, flags);
        }

        let match;
        while ((match = searchPattern.exec(content)) !== null) {
            this.matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0]
            });

            // Prevent infinite loop for zero-length matches
            if (match[0].length === 0) {
                searchPattern.lastIndex++;
            }
        }
    },

    /**
     * Update result count display
     */
    updateResultCount() {
        const countEl = document.getElementById('find-result-count');
        if (!countEl) return;

        if (this.matches.length === 0) {
            countEl.textContent = this.currentSearchTerm ? '결과 없음' : '결과 없음';
        } else {
            const current = this.currentMatchIndex + 1;
            countEl.textContent = `${current} / ${this.matches.length}`;
        }
    },

    /**
     * Find next occurrence
     */
    findNext() {
        if (this.matches.length === 0) return;

        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
        this.navigateToMatch(this.currentMatchIndex, false); // Don't focus editor
        this.updateResultCount();
        this.updateHighlights();

        // Keep focus in find input for continuous Enter pressing
        this.findInput?.focus();
    },

    /**
     * Find previous occurrence
     */
    findPrevious() {
        if (this.matches.length === 0) return;

        this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
        this.navigateToMatch(this.currentMatchIndex, false); // Don't focus editor
        this.updateResultCount();
        this.updateHighlights();

        // Keep focus in find input for continuous Shift+Enter pressing
        this.findInput?.focus();
    },

    /**
     * Navigate to a specific match
     * @param {number} matchIndex - Index of the match to navigate to
     * @param {boolean} focusEditor - Whether to focus the editor (default: true)
     */
    navigateToMatch(matchIndex, focusEditor = true) {
        if (!this.editor || matchIndex < 0 || matchIndex >= this.matches.length) return;

        const match = this.matches[matchIndex];

        // Set selection (focus only if requested)
        if (focusEditor) {
            this.editor.focus();
        }
        this.editor.setSelectionRange(match.index, match.index + match.length);

        // Scroll to selection
        this.scrollToSelection();
    },

    /**
     * Scroll editor to show the current selection
     */
    scrollToSelection() {
        if (!this.editor) return;

        // Get text before selection to calculate position
        const textBeforeSelection = this.editor.value.substring(0, this.editor.selectionStart);
        const lines = textBeforeSelection.split('\n');
        const lineNumber = lines.length - 1;

        // Estimate line height
        const lineHeight = parseFloat(getComputedStyle(this.editor).lineHeight) || 22.4;
        const targetScrollTop = lineNumber * lineHeight - (this.editor.clientHeight / 2) + lineHeight;

        this.editor.scrollTop = Math.max(0, targetScrollTop);
    },

    /**
     * Update highlight backdrop with match markers
     */
    updateHighlights() {
        if (!this.backdrop || !this.editor) return;

        const content = this.editor.value;

        if (!this.currentSearchTerm || this.matches.length === 0) {
            this.clearHighlights();
            return;
        }

        // Add transparent background to editor
        this.editor.classList.add('with-highlights');

        // Sync backdrop dimensions with editor (important for text wrapping)
        this.syncBackdropDimensions();

        // Build highlighted content
        let highlightedContent = '';
        let lastIndex = 0;

        this.matches.forEach((match, index) => {
            // Escape HTML for text before match
            const textBefore = this.escapeHtml(content.substring(lastIndex, match.index));
            const matchText = this.escapeHtml(match.text);

            highlightedContent += textBefore;

            // Add highlight mark with 'current' class for current match
            const currentClass = index === this.currentMatchIndex ? ' current' : '';
            highlightedContent += `<mark class="highlight-mark${currentClass}">${matchText}</mark>`;

            lastIndex = match.index + match.length;
        });

        // Add remaining text + extra newline to match textarea padding behavior
        highlightedContent += this.escapeHtml(content.substring(lastIndex));
        // Add a trailing character to ensure backdrop has same scrollable height as textarea
        highlightedContent += '\n';

        // Update backdrop content
        this.backdrop.innerHTML = highlightedContent;

        // Sync scroll position
        this.syncBackdropScroll();
    },

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Sync backdrop scroll with editor
     */
    syncBackdropScroll() {
        if (this.backdrop && this.editor) {
            this.backdrop.scrollTop = this.editor.scrollTop;
            this.backdrop.scrollLeft = this.editor.scrollLeft;
        }
    },

    /**
     * Sync backdrop dimensions with editor to ensure text wraps identically
     */
    syncBackdropDimensions() {
        if (this.backdrop && this.editor) {
            // Match the exact width of the textarea content area (minus scrollbar)
            const editorStyle = getComputedStyle(this.editor);
            const scrollbarWidth = this.editor.offsetWidth - this.editor.clientWidth;

            // Apply same width minus scrollbar to backdrop
            this.backdrop.style.width = `calc(100% - ${scrollbarWidth}px)`;
        }
    },

    /**
     * Clear all highlights
     */
    clearHighlights() {
        if (this.backdrop) {
            this.backdrop.innerHTML = '';
        }
        if (this.editor) {
            this.editor.classList.remove('with-highlights');
        }
    },

    /**
     * Replace current match
     */
    replace() {
        if (!this.editor || this.matches.length === 0 || this.currentMatchIndex < 0) return;

        const match = this.matches[this.currentMatchIndex];
        const replaceTerm = this.replaceInput?.value || '';
        const content = this.editor.value;

        // Replace the current match
        const newContent = content.substring(0, match.index) + replaceTerm + content.substring(match.index + match.length);

        // Update editor value
        this.editor.value = newContent;

        // Trigger input event for preview update
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));

        // Recalculate matches
        this.findMatches();

        // Navigate to next match (or stay at same index if matches remain)
        if (this.matches.length > 0) {
            this.currentMatchIndex = Math.min(this.currentMatchIndex, this.matches.length - 1);
            this.navigateToMatch(this.currentMatchIndex);
        } else {
            this.currentMatchIndex = -1;
        }

        this.updateResultCount();
        this.updateHighlights();
    },

    /**
     * Replace all matches
     */
    replaceAll() {
        if (!this.editor || this.matches.length === 0) return;

        const replaceTerm = this.replaceInput?.value || '';
        let content = this.editor.value;

        // Replace from end to beginning to maintain indices
        for (let i = this.matches.length - 1; i >= 0; i--) {
            const match = this.matches[i];
            content = content.substring(0, match.index) + replaceTerm + content.substring(match.index + match.length);
        }

        // Update editor value
        this.editor.value = content;

        // Trigger input event for preview update
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));

        // Clear matches
        this.matches = [];
        this.currentMatchIndex = -1;

        this.updateResultCount();
        this.clearHighlights();
    },

    /**
     * Close dialog
     * @param {boolean} clearHighlights - Whether to clear highlights (default: true)
     */
    closeDialog(clearHighlights = true) {
        const widget = document.getElementById('find-widget');
        if (widget) {
            widget.remove();
        }

        this.widget = null;
        this.findInput = null;
        this.replaceInput = null;
        this.findDialogOpen = false;
        this.replaceExpanded = false;

        if (clearHighlights) {
            this.clearHighlights();
            this.matches = [];
            this.currentMatchIndex = -1;
        }

        // Focus editor
        this.editor?.focus();
    }
};
