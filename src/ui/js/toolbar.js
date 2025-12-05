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

    // Formatting
    const btnBold = document.getElementById('btn-bold');
    if (btnBold) btnBold.addEventListener('click', () => ToolbarModule.bold());

    const btnItalic = document.getElementById('btn-italic');
    if (btnItalic) btnItalic.addEventListener('click', () => ToolbarModule.italic());

    const btnHeading = document.getElementById('btn-heading');
    if (btnHeading) btnHeading.addEventListener('click', () => ToolbarModule.heading(1));

    const btnLink = document.getElementById('btn-link');
    if (btnLink) btnLink.addEventListener('click', () => ToolbarModule.link());

    const btnCodeBlock = document.getElementById('btn-code-block');
    if (btnCodeBlock) btnCodeBlock.addEventListener('click', () => ToolbarModule.codeBlock());

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

    // View Toggles
    const btnViewEdit = document.getElementById('btn-view-edit');
    const btnViewSplit = document.getElementById('btn-view-split');
    const btnViewPreview = document.getElementById('btn-view-preview');
    const editorPane = document.getElementById('editor-pane');
    const previewPane = document.getElementById('preview-pane');
    const resizer = document.getElementById('resizer');

    function setActiveView(mode) {
        // Reset buttons
        [btnViewEdit, btnViewSplit, btnViewPreview].forEach(btn => btn?.classList.remove('active'));

        // Reset panes
        if (editorPane) editorPane.style.display = 'flex';
        if (previewPane) previewPane.style.display = 'flex';
        if (resizer) resizer.style.display = 'block';

        if (mode === 'edit') {
            btnViewEdit?.classList.add('active');
            if (previewPane) previewPane.style.display = 'none';
            if (resizer) resizer.style.display = 'none';
            if (editorPane) editorPane.style.flex = '1';
        } else if (mode === 'split') {
            btnViewSplit?.classList.add('active');
            if (editorPane) editorPane.style.flex = '1';
            if (previewPane) previewPane.style.flex = '1';
        } else if (mode === 'preview') {
            btnViewPreview?.classList.add('active');
            if (editorPane) editorPane.style.display = 'none';
            if (resizer) resizer.style.display = 'none';
            if (previewPane) previewPane.style.flex = '1';
        }
    }

    if (btnViewEdit) btnViewEdit.addEventListener('click', () => setActiveView('edit'));
    if (btnViewSplit) btnViewSplit.addEventListener('click', () => setActiveView('split'));
    if (btnViewPreview) btnViewPreview.addEventListener('click', () => setActiveView('preview'));

    // Default to split view
    setActiveView('split');
});
