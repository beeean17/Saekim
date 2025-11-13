/**
 * Preview module for rendering markdown
 */

const PreviewModule = {
    previewElement: null,
    currentContent: '',
    scrollSyncEnabled: true,
    isScrolling: false,

    /**
     * Initialize the preview module
     */
    init() {
        this.previewElement = document.getElementById('preview');

        if (!this.previewElement) {
            console.error('❌ Preview element not found');
            return;
        }

        // Setup scroll sync button
        const syncButton = document.getElementById('btn-sync-scroll');
        if (syncButton) {
            syncButton.addEventListener('click', () => {
                this.toggleScrollSync();
            });
        }

        console.log('✅ Preview 모듈 초기화 완료');
    },

    /**
     * Toggle scroll synchronization
     */
    toggleScrollSync() {
        this.scrollSyncEnabled = !this.scrollSyncEnabled;
        const syncButton = document.getElementById('btn-sync-scroll');
        if (syncButton) {
            syncButton.setAttribute('data-active', this.scrollSyncEnabled);
            syncButton.textContent = this.scrollSyncEnabled ? '🔗' : '🔓';
            syncButton.title = this.scrollSyncEnabled ? '스크롤 동기화 켜짐' : '스크롤 동기화 꺼짐';
        }
        console.log('스크롤 동기화:', this.scrollSyncEnabled ? '켜짐' : '꺼짐');
    },

    /**
     * Synchronize preview scroll with editor
     */
    syncScroll(editorElement) {
        if (!this.scrollSyncEnabled || !this.previewElement || !editorElement) return;
        if (this.isScrolling) return;

        this.isScrolling = true;

        // Calculate scroll percentage
        const scrollPercentage = editorElement.scrollTop /
            (editorElement.scrollHeight - editorElement.clientHeight);

        // Apply to preview
        const previewMaxScroll = this.previewElement.scrollHeight - this.previewElement.clientHeight;
        this.previewElement.scrollTop = previewMaxScroll * scrollPercentage;

        // Reset flag after a short delay
        setTimeout(() => {
            this.isScrolling = false;
        }, 100);
    },

    /**
     * Update preview with markdown content
     */
    update(markdown) {
        if (!this.previewElement) return;

        this.currentContent = markdown;

        // For now, just display as plain text
        // TODO: Integrate Marked.js for actual markdown rendering
        if (markdown.trim() === '') {
            this.showPlaceholder();
        } else {
            this.renderMarkdown(markdown);
        }
    },

    /**
     * Show placeholder when no content
     */
    showPlaceholder() {
        this.previewElement.innerHTML = `
            <div class="preview-placeholder">
                <p>마크다운 미리보기가 여기에 표시됩니다.</p>
            </div>
        `;
    },

    /**
     * Render markdown using Marked.js
     */
    renderMarkdown(markdown) {
        try {
            // Configure Marked.js
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true, // Convert \n to <br>
                    gfm: true, // GitHub Flavored Markdown
                    headerIds: true,
                    mangle: false,
                    sanitize: false, // We'll use DOMPurify instead
                    highlight: function(code, lang) {
                        // Skip highlighting for mermaid diagrams (will be rendered separately)
                        if (lang === 'mermaid') {
                            return code;
                        }

                        // Use Highlight.js for syntax highlighting
                        if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                            try {
                                return hljs.highlight(code, { language: lang }).value;
                            } catch (err) {
                                console.error('Highlight error:', err);
                            }
                        }
                        // Auto-detect language if not specified
                        if (typeof hljs !== 'undefined' && lang !== 'mermaid') {
                            try {
                                return hljs.highlightAuto(code).value;
                            } catch (err) {
                                console.error('Highlight auto error:', err);
                            }
                        }
                        return code; // Fallback to plain code
                    }
                });

                // Convert markdown to HTML
                let html = marked.parse(markdown);

                // Sanitize HTML to prevent XSS attacks
                if (typeof DOMPurify !== 'undefined') {
                    html = DOMPurify.sanitize(html, {
                        ADD_ATTR: ['class'], // Preserve class attributes for code blocks
                        ADD_TAGS: ['pre', 'code']
                    });
                }

                this.previewElement.innerHTML = html;

                // Apply syntax highlighting to any code blocks that weren't caught
                if (typeof hljs !== 'undefined') {
                    this.previewElement.querySelectorAll('pre code').forEach((block) => {
                        if (!block.classList.contains('hljs')) {
                            hljs.highlightElement(block);
                        }
                    });
                }

                // Add copy buttons to code blocks
                this.addCopyButtons();

                // Render Mermaid diagrams
                this.renderMermaidDiagrams();
            } else {
                // Fallback to basic rendering if Marked.js not loaded
                let html = this.basicMarkdownToHtml(markdown);
                this.previewElement.innerHTML = html;
            }
        } catch (error) {
            console.error('❌ Preview rendering error:', error);
            this.previewElement.innerHTML = `<div class="error">Preview rendering error: ${error.message}</div>`;
        }
    },

    /**
     * Render Mermaid diagrams
     */
    renderMermaidDiagrams() {
        if (typeof mermaid === 'undefined') {
            console.warn('⚠️ Mermaid.js not loaded');
            return;
        }

        try {
            // Initialize Mermaid with configuration
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: 'var(--font-sans)',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                }
            });

            // Find all code blocks with language "mermaid"
            const mermaidBlocks = this.previewElement.querySelectorAll('pre code.language-mermaid, pre code[class*="mermaid"]');
            console.log(`🔍 Found ${mermaidBlocks.length} Mermaid code blocks`);

            mermaidBlocks.forEach((block, index) => {
                const code = block.textContent;
                const pre = block.parentElement;

                // Create a container for the diagram
                const diagramId = `mermaid-diagram-${Date.now()}-${index}`;
                const diagramContainer = document.createElement('div');
                diagramContainer.className = 'mermaid-container';
                diagramContainer.id = diagramId;

                // Render the diagram
                mermaid.render(`mermaid-svg-${Date.now()}-${index}`, code).then(({ svg }) => {
                    diagramContainer.innerHTML = svg;
                    // Replace the code block with the rendered diagram
                    pre.replaceWith(diagramContainer);
                }).catch(err => {
                    console.error('❌ Mermaid render error:', err);
                    // Show error in the diagram container
                    diagramContainer.innerHTML = `
                        <div class="mermaid-error">
                            <p><strong>Mermaid Diagram Error:</strong></p>
                            <pre>${err.message}</pre>
                            <details>
                                <summary>Show diagram code</summary>
                                <pre>${code}</pre>
                            </details>
                        </div>
                    `;
                    pre.replaceWith(diagramContainer);
                });
            });

            console.log(`✅ Rendered ${mermaidBlocks.length} Mermaid diagrams`);
        } catch (error) {
            console.error('❌ Mermaid initialization error:', error);
        }
    },

    /**
     * Basic markdown to HTML conversion
     * This is a simplified version, will be replaced with Marked.js
     */
    basicMarkdownToHtml(markdown) {
        let html = markdown;

        // Escape HTML
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert markdown syntax
        // Headings
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Strikethrough
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Code (inline)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

        // Lists (simple version)
        html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

        // Blockquotes
        html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');

        // Horizontal rules
        html = html.replace(/^---$/gim, '<hr>');

        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    },

    /**
     * Scroll to specific position
     */
    scrollTo(percentage) {
        if (!this.previewElement) return;

        const maxScroll = this.previewElement.scrollHeight - this.previewElement.clientHeight;
        this.previewElement.scrollTop = maxScroll * percentage;
    },

    /**
     * Get current scroll percentage
     */
    getScrollPercentage() {
        if (!this.previewElement) return 0;

        const maxScroll = this.previewElement.scrollHeight - this.previewElement.clientHeight;
        if (maxScroll === 0) return 0;

        return this.previewElement.scrollTop / maxScroll;
    },

    /**
     * Add copy buttons to code blocks
     */
    addCopyButtons() {
        if (!this.previewElement) return;

        this.previewElement.querySelectorAll('pre').forEach((pre) => {
            // Skip if button already exists
            if (pre.querySelector('.code-copy-btn')) return;

            const button = document.createElement('button');
            button.className = 'code-copy-btn';
            button.textContent = '복사';
            button.title = '코드 복사';

            button.addEventListener('click', () => {
                const code = pre.querySelector('code');
                if (code) {
                    const text = code.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        button.textContent = '복사됨!';
                        button.classList.add('copied');

                        setTimeout(() => {
                            button.textContent = '복사';
                            button.classList.remove('copied');
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy:', err);
                        button.textContent = '실패';
                    });
                }
            });

            pre.appendChild(button);
        });
    }
};
