/**
 * Toolbar module for formatting actions
 */

const ToolbarModule = {
    /**
     * Apply bold formatting
     */
    bold() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.bold();
        }
    },

    /**
     * Apply italic formatting
     */
    italic() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.italic();
        }
    },

    /**
     * Apply strikethrough formatting
     */
    strikethrough() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.strikethrough();
        }
    },

    /**
     * Insert heading
     */
    heading(level = 1) {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.heading(level);
        }
    },

    /**
     * Insert bullet list
     */
    bulletList() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.bulletList();
        }
    },

    /**
     * Insert numbered list
     */
    numberedList() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.numberedList();
        }
    },

    /**
     * Insert inline code
     */
    code() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.code();
        }
    },

    /**
     * Insert code block
     */
    codeBlock(language = '') {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.codeBlock(language);
        }
    },

    /**
     * Insert quote
     */
    quote() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.quote();
        }
    },

    /**
     * Insert link
     */
    link() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.link();
        }
    },

    /**
     * Insert image
     */
    image() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.image();
        }
    },

    /**
     * Insert horizontal rule
     */
    horizontalRule() {
        if (typeof EditorModule !== 'undefined') {
            EditorModule.format.horizontalRule();
        }
    },

    /**
     * Insert table
     */
    insertTable(rows = 3, cols = 3) {
        let table = '\n';

        // Header row
        table += '|';
        for (let i = 0; i < cols; i++) {
            table += ` Header ${i + 1} |`;
        }
        table += '\n';

        // Separator row
        table += '|';
        for (let i = 0; i < cols; i++) {
            table += ' --- |';
        }
        table += '\n';

        // Data rows
        for (let r = 0; r < rows - 1; r++) {
            table += '|';
            for (let c = 0; c < cols; c++) {
                table += ` Cell |`;
            }
            table += '\n';
        }

        table += '\n';

        if (typeof EditorModule !== 'undefined') {
            EditorModule.insertText(table);
        }
    }
};

// Initialize toolbar button events
document.addEventListener('DOMContentLoaded', () => {
    // History
    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.addEventListener('click', () => {
        if (typeof EditorModule !== 'undefined') EditorModule.editor.focus();
        document.execCommand('undo');
    });

    const btnRedo = document.getElementById('btn-redo');
    if (btnRedo) btnRedo.addEventListener('click', () => {
        if (typeof EditorModule !== 'undefined') EditorModule.editor.focus();
        document.execCommand('redo');
    });

    // Image button
    const btnInsertImage = document.getElementById('btn-insert-image');
    if (btnInsertImage) {
        btnInsertImage.addEventListener('click', () => ToolbarModule.image());
    }

    // Table button
    const btnInsertTable = document.getElementById('btn-insert-table');
    if (btnInsertTable) {
        btnInsertTable.addEventListener('click', () => ToolbarModule.insertTable());
    }
});
