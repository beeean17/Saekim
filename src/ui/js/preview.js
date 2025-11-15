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
        // Protect math expressions from Marked.js parsing
        const mathExpressions = [];
        let processedMarkdown = markdown;

        // Protect display math ($$...$$)
        processedMarkdown = processedMarkdown.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
            const placeholder = `MATHDISPLAYPLACEHOLDER${mathExpressions.length}ENDPLACEHOLDER`;
            // content에 순수 LaTeX만 저장 ($$는 제거)
            mathExpressions.push({ type: 'display', content: math.trim(), placeholder });
            console.log(`📊 Display math protected: "${math.substring(0, 50)}..." → ${placeholder}`);
            return placeholder;
        });

        // Protect inline math ($...$)
        processedMarkdown = processedMarkdown.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
            const placeholder = `MATHINLINEPLACEHOLDER${mathExpressions.length}ENDPLACEHOLDER`;
            // content에 순수 LaTeX만 저장 ($는 제거)
            mathExpressions.push({ type: 'inline', content: math.trim(), placeholder });
            console.log(`📝 Inline math protected: "${math}" → ${placeholder}`);
            return placeholder;
        });

        // Configure Marked.js
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: true,
                mangle: false,
                sanitize: false,
                highlight: function(code, lang) {
                    if (lang === 'mermaid') {
                        return code;
                    }
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {
                            console.error('Highlight error:', err);
                        }
                    }
                    if (typeof hljs !== 'undefined' && lang !== 'mermaid') {
                        try {
                            return hljs.highlightAuto(code).value;
                        } catch (err) {
                            console.error('Highlight auto error:', err);
                        }
                    }
                    return code;
                }
            });

            // Convert markdown to HTML
            let html = marked.parse(processedMarkdown);

            // Restore math expressions - content에 이미 순수 LaTeX만 있음
            console.log(`🔄 Restoring ${mathExpressions.length} math expressions...`);
            mathExpressions.forEach(({ type, content, placeholder }) => {
                if (type === 'display') {
                    // div 태그 사용 + data attribute로 LaTeX 저장
                    html = html.replaceAll(placeholder,
                        `<div class="math-display" data-math="${this.escapeHtml(content)}"></div>`);
                    console.log(`📊 Display restore: ${placeholder}, content="${content.substring(0, 30)}..."`);
                } else {
                    html = html.replaceAll(placeholder,
                        `<span class="math-inline" data-math="${this.escapeHtml(content)}"></span>`);
                    console.log(`📝 Inline restore: ${placeholder}, content="${content}"`);
                }
            });

            // Sanitize HTML
            if (typeof DOMPurify !== 'undefined') {
                html = DOMPurify.sanitize(html, {
                    ADD_ATTR: ['class', 'style', 'id', 'data-math'],
                    ADD_TAGS: ['pre', 'code', 'span', 'div'],
                    ALLOW_DATA_ATTR: true,
                    KEEP_CONTENT: true
                });
            }

            this.previewElement.innerHTML = html;

            // p 태그로 감싸진 math-display를 unwrap
            this.unwrapMathDisplays();

            if (typeof hljs !== 'undefined') {
                this.previewElement.querySelectorAll('pre code').forEach((block) => {
                    if (!block.classList.contains('hljs')) {
                        hljs.highlightElement(block);
                    }
                });
            }

            this.addCopyButtons();
            this.renderMermaidDiagrams();
            this.renderMathEquations();
        } else {
            let html = this.basicMarkdownToHtml(markdown);
            this.previewElement.innerHTML = html;
        }
    } catch (error) {
        console.error('❌ Preview rendering error:', error);
        this.previewElement.innerHTML = `<div class="error">Preview rendering error: ${error.message}</div>`;
    }
},

/**
 * Escape HTML for attributes
 */
escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
},

/**
 * Unwrap math-display elements from p tags
 */
unwrapMathDisplays() {
    if (!this.previewElement) return;

    // p 태그 내부에 math-display만 있는 경우를 찾아서 p 태그 제거
    const paragraphs = this.previewElement.querySelectorAll('p');
    paragraphs.forEach(p => {
        // p 태그의 자식이 하나뿐이고, 그것이 math-display인 경우
        if (p.children.length === 1 && p.children[0].classList.contains('math-display')) {
            // p 태그를 math-display로 교체
            const mathDisplay = p.children[0];
            p.replaceWith(mathDisplay);
            console.log('✅ Unwrapped math-display from p tag');
        }
        // p 태그의 텍스트 내용이 비어있고 math-display만 있는 경우
        else if (p.textContent.trim() === '' && p.querySelector('.math-display')) {
            const mathDisplay = p.querySelector('.math-display');
            if (mathDisplay) {
                p.replaceWith(mathDisplay);
                console.log('✅ Unwrapped math-display from empty p tag');
            }
        }
    });
},

/**
 * Render math equations using KaTeX
 */
renderMathEquations() {
    if (typeof katex === 'undefined') {
        console.warn('⚠️ KaTeX not loaded');
        return;
    }

    try {
        console.log('🔢 Starting KaTeX rendering...');

        // Render display math
        const displayMath = this.previewElement.querySelectorAll('.math-display');
        console.log(`📊 Found ${displayMath.length} display math elements`);
        displayMath.forEach((element, index) => {
            // data-math 속성에서 LaTeX 가져오기
            let math = element.getAttribute('data-math') || element.textContent.trim();

            // 줄바꿈 처리: \n을 LaTeX 줄바꿈 \\로 변환
            // 단, 이미 \\가 있는 경우는 제외
            // 먼저 \\를 임시 플레이스홀더로 대체
            const placeholder = '___LATEX_NEWLINE___';
            math = math.replace(/\\\\/g, placeholder);
            // 일반 줄바꿈을 \\로 변환
            math = math.replace(/\n/g, ' \\\\ ');
            // 플레이스홀더를 다시 \\로 복원
            math = math.replace(new RegExp(placeholder, 'g'), '\\\\');

            console.log(`📊 Display[${index}] math (after newline conversion): "${math}"`);

            try {
                katex.render(math, element, {
                    displayMode: true,
                    throwOnError: false,
                    errorColor: '#cc0000',
                    strict: false,
                    trust: false,
                    macros: {
                        "\\RR": "\\mathbb{R}",
                        "\\NN": "\\mathbb{N}",
                        "\\ZZ": "\\mathbb{Z}",
                        "\\QQ": "\\mathbb{Q}",
                        "\\CC": "\\mathbb{C}"
                    }
                });
                console.log(`✅ Display[${index}] rendered successfully`);
            } catch (error) {
                console.error('❌ KaTeX display error:', error, 'Math:', math);
                element.textContent = `[Math Error: ${error.message}]`;
                element.style.color = '#cc0000';
            }
        });

        // Render inline math
        const inlineMath = this.previewElement.querySelectorAll('.math-inline');
        console.log(`📝 Found ${inlineMath.length} inline math elements`);
        inlineMath.forEach((element, index) => {
            // data-math 속성에서 LaTeX 가져오기
            const math = element.getAttribute('data-math') || element.textContent.trim();
            console.log(`📝 Inline[${index}] math: "${math}"`);

            try {
                katex.render(math, element, {
                    displayMode: false,
                    throwOnError: false,
                    errorColor: '#cc0000',
                    strict: false,
                    trust: false,
                    macros: {
                        "\\RR": "\\mathbb{R}",
                        "\\NN": "\\mathbb{N}",
                        "\\ZZ": "\\mathbb{Z}",
                        "\\QQ": "\\mathbb{Q}",
                        "\\CC": "\\mathbb{C}"
                    }
                });
                console.log(`✅ Inline[${index}] rendered successfully`);
            } catch (error) {
                console.error('❌ KaTeX inline error:', error, 'Math:', math);
                element.textContent = `[Math Error: ${error.message}]`;
                element.style.color = '#cc0000';
            }
        });

        const equations = this.previewElement.querySelectorAll('.katex');
        console.log(`✅ Rendered ${equations.length} math equations (${displayMath.length} display + ${inlineMath.length} inline)`);
    } catch (error) {
        console.error('❌ KaTeX rendering error:', error);
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
                fontFamily: 'Malgun Gothic, 맑은 고딕, Segoe UI, Arial, sans-serif',
                fontSize: 14,
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                },
                themeVariables: {
                    fontFamily: 'Malgun Gothic, 맑은 고딕, Segoe UI, Arial, sans-serif',
                    fontSize: '14px'
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
