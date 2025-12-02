/**
 * Find and Replace module
 */

const FindReplaceModule = {
    findDialogOpen: false,
    replaceDialogOpen: false,
    currentSearchTerm: '',
    currentReplaceTerm: '',
    caseSensitive: false,
    useRegex: false,
    matches: [],
    currentMatchIndex: -1,

    /**
     * Show find dialog
     */
    showFind() {
        this.findDialogOpen = true;
        this.createFindDialog();
    },


    /**
     * Create find dialog
     */
    createFindDialog() {
        // Remove existing dialog
        this.closeDialog();

        const dialog = document.createElement('div');
        dialog.id = 'find-dialog';
        dialog.className = 'find-replace-dialog';
        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>찾기</h3>
                <button class="close-btn" onclick="FindReplaceModule.closeDialog()">✕</button>
            </div>
            <div class="dialog-body">
                <div class="input-group">
                    <input type="text" id="find-input" placeholder="찾을 텍스트" />
                    <button onclick="FindReplaceModule.findNext()">다음 찾기</button>
                    <button onclick="FindReplaceModule.findPrevious()">이전 찾기</button>
                </div>
                <div class="options">
                    <label>
                        <input type="checkbox" id="case-sensitive" onchange="FindReplaceModule.toggleCaseSensitive()">
                        대소문자 구분
                    </label>
                    <label>
                        <input type="checkbox" id="use-regex" onchange="FindReplaceModule.toggleRegex()">
                        정규식 사용
                    </label>
                </div>
                <div class="match-count" id="match-count">0개 찾음</div>
            </div>
        `;

        document.body.appendChild(dialog);
        document.getElementById('find-input').focus();

        // Enter key to find next
        const findInput = document.getElementById('find-input');
        findInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.findNext();
            }
        });

        // Auto-search as user types
        findInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            if (searchTerm) {
                this.highlightMatches(searchTerm);
            } else {
                this.clearHighlights();
            }
        });
    },

    /**
     * Close dialog
     */
    closeDialog() {
        const findDialog = document.getElementById('find-dialog');

        if (findDialog) findDialog.remove();

        this.findDialogOpen = false;
        this.clearHighlights();
    },

    /**
     * Toggle case sensitive
     */
    toggleCaseSensitive() {
        const checkbox = document.getElementById('case-sensitive');
        this.caseSensitive = checkbox ? checkbox.checked : false;
    },

    /**
     * Toggle regex mode
     */
    toggleRegex() {
        const checkbox = document.getElementById('use-regex');
        this.useRegex = checkbox ? checkbox.checked : false;
    },

    /**
     * Find next occurrence
     */
    findNext() {
        const searchTerm = document.getElementById('find-input')?.value;
        if (!searchTerm) return;

        this.currentSearchTerm = searchTerm;

        if (typeof EditorModule === 'undefined' || !EditorModule.editor) return;

        const editor = EditorModule.editor;
        const content = editor.value;
        const start = editor.selectionEnd;

        let index;
        if (this.useRegex) {
            try {
                const regex = new RegExp(searchTerm, this.caseSensitive ? 'g' : 'gi');
                regex.lastIndex = start;
                const match = regex.exec(content);
                index = match ? match.index : -1;
            } catch (e) {
                console.error('Invalid regex:', e);
                return;
            }
        } else {
            index = this.caseSensitive
                ? content.indexOf(searchTerm, start)
                : content.toLowerCase().indexOf(searchTerm.toLowerCase(), start);
        }

        if (index === -1) {
            // Wrap around to beginning
            index = this.caseSensitive
                ? content.indexOf(searchTerm)
                : content.toLowerCase().indexOf(searchTerm.toLowerCase());
        }

        if (index !== -1) {
            editor.focus();
            editor.setSelectionRange(index, index + searchTerm.length);
            this.updateMatchCount(content, searchTerm);
        } else {
            this.updateMatchCount(content, searchTerm);
        }
    },

    /**
     * Find previous occurrence
     */
    findPrevious() {
        const searchTerm = document.getElementById('find-input')?.value;
        if (!searchTerm) return;

        if (typeof EditorModule === 'undefined' || !EditorModule.editor) return;

        const editor = EditorModule.editor;
        const content = editor.value;
        const start = editor.selectionStart - 1;

        let index;
        if (this.useRegex) {
            try {
                const regex = new RegExp(searchTerm, this.caseSensitive ? 'g' : 'gi');
                let lastMatch = -1;
                let match;
                regex.lastIndex = 0;
                while ((match = regex.exec(content)) !== null) {
                    if (match.index < start) {
                        lastMatch = match.index;
                    } else {
                        break;
                    }
                }
                index = lastMatch;
            } catch (e) {
                console.error('Invalid regex:', e);
                return;
            }
        } else {
            const searchContent = this.caseSensitive ? content : content.toLowerCase();
            const searchFor = this.caseSensitive ? searchTerm : searchTerm.toLowerCase();
            index = searchContent.lastIndexOf(searchFor, start);
        }

        if (index === -1) {
            // Wrap around to end
            const searchContent = this.caseSensitive ? content : content.toLowerCase();
            const searchFor = this.caseSensitive ? searchTerm : searchTerm.toLowerCase();
            index = searchContent.lastIndexOf(searchFor);
        }

        if (index !== -1) {
            editor.focus();
            editor.setSelectionRange(index, index + searchTerm.length);
        }
    },

    /**
     * Highlight all matches in the editor
     */
    highlightMatches(searchTerm) {
        if (!searchTerm || typeof EditorModule === 'undefined' || !EditorModule.editor) return;

        const editor = EditorModule.editor;
        const content = editor.value;

        // Update match count
        this.updateMatchCount(content, searchTerm);

        // Note: Actual highlighting in a textarea is not directly possible
        // This would require using a more advanced editor like CodeMirror
        // For now, we just update the count and the first match will be selected on Enter
    },

    /**
     * Update match count
     */
    updateMatchCount(content, searchTerm) {
        let count = 0;

        if (this.useRegex) {
            try {
                const regex = new RegExp(searchTerm, this.caseSensitive ? 'g' : 'gi');
                const matches = content.match(regex);
                count = matches ? matches.length : 0;
            } catch (e) {
                count = 0;
            }
        } else {
            const searchContent = this.caseSensitive ? content : content.toLowerCase();
            const searchFor = this.caseSensitive ? searchTerm : searchTerm.toLowerCase();
            let pos = 0;
            while ((pos = searchContent.indexOf(searchFor, pos)) !== -1) {
                count++;
                pos += searchFor.length;
            }
        }

        const matchCount = document.getElementById('match-count');
        if (matchCount) {
            matchCount.textContent = `${count}개 찾음`;
        }
    },

    /**
     * Clear highlights
     */
    clearHighlights() {
        // Implementation for clearing highlights if needed
    }
};
