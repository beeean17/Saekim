/**
 * CodeMirror 6 Initialization (Non-ES Module version)
 * Using global variables from CDN bundles
 */

(function() {
    'use strict';

    // Wait for all libraries to load
    function waitForLibraries(callback) {
        const checkInterval = setInterval(() => {
            // Check if CodeMirror globals are available
            if (typeof window.CM !== 'undefined' &&
                typeof window.CM.EditorView !== 'undefined' &&
                typeof window.CM.EditorState !== 'undefined') {
                clearInterval(checkInterval);
                callback();
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            console.error('❌ CodeMirror libraries failed to load');
            // Fallback to basic textarea
            initBasicTextarea();
        }, 10000);
    }

    function initCodeMirror() {
        const editorElement = document.getElementById('editor');

        if (!editorElement) {
            console.error('❌ Editor element not found');
            return;
        }

        console.log('✅ Initializing CodeMirror 6...');

        try {
            const { EditorView, EditorState, basicSetup } = window.CM;
            const { markdown } = window.CM;

            const initialContent = `# 여기에 마크다운을 작성하세요...

## 환영합니다!

새김 마크다운 에디터에 오신 것을 환영합니다.

### 주요 기능
- 실시간 미리보기
- 코드 하이라이팅
- 다이어그램 렌더링 (Mermaid.js)
- 수식 렌더링 (KaTeX)
- PDF/DOCX 변환

시작하려면 이 텍스트를 지우고 작성을 시작하세요!
`;

            // Create EditorState
            const startState = EditorState.create({
                doc: initialContent,
                extensions: [
                    basicSetup,
                    markdown(),
                    EditorView.lineWrapping,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            const content = update.state.doc.toString();

                            // Update preview
                            if (typeof PreviewModule !== 'undefined') {
                                PreviewModule.update(content);
                            }

                            // Mark as modified
                            if (typeof App !== 'undefined') {
                                App.markDirty();
                                App.saveState();
                            }

                            // Update word count
                            updateWordCount(content);
                        }
                    })
                ]
            });

            // Create EditorView
            window.editorView = new EditorView({
                state: startState,
                parent: editorElement
            });

            // Expose getter/setter for compatibility
            window.EditorModule = window.EditorModule || {};
            Object.assign(window.EditorModule, {
                getContent() {
                    return window.editorView ? window.editorView.state.doc.toString() : '';
                },

                setContent(content) {
                    if (window.editorView) {
                        window.editorView.dispatch({
                            changes: {
                                from: 0,
                                to: window.editorView.state.doc.length,
                                insert: content
                            }
                        });
                    }
                },

                init() {
                    console.log('✅ CodeMirror 6 ready');
                    // Trigger initial preview
                    const content = window.editorView.state.doc.toString();
                    if (typeof PreviewModule !== 'undefined') {
                        PreviewModule.update(content);
                    }
                }
            });

            // Initial word count
            updateWordCount(initialContent);

            console.log('✅ CodeMirror 6 initialized successfully');

            // Call init if EditorModule already has one
            if (EditorModule.init) {
                EditorModule.init();
            }

        } catch (error) {
            console.error('❌ CodeMirror initialization error:', error);
            // Fallback to basic textarea
            initBasicTextarea();
        }
    }

    function initBasicTextarea() {
        console.log('⚠️ Falling back to basic textarea');
        const editorElement = document.getElementById('editor');

        if (!editorElement) return;

        // Create textarea
        const textarea = document.createElement('textarea');
        textarea.id = 'editor-textarea';
        textarea.className = 'editor-textarea';
        textarea.placeholder = `# 여기에 마크다운을 작성하세요...

## 환영합니다!

새김 마크다운 에디터에 오신 것을 환영합니다.

### 주요 기능
- 실시간 미리보기
- 코드 하이라이팅
- 다이어그램 렌더링 (Mermaid.js)
- 수식 렌더링 (KaTeX)
- PDF/DOCX 변환

시작하려면 이 텍스트를 지우고 작성을 시작하세요!`;

        editorElement.appendChild(textarea);

        // Make EditorModule work with textarea
        window.EditorModule = window.EditorModule || {};
        window.EditorModule.editor = textarea;

        console.log('✅ Basic textarea initialized');
    }

    function updateWordCount(content) {
        const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = content.length;

        const wordCountElement = document.getElementById('word-count');
        if (wordCountElement) {
            wordCountElement.textContent = `${words} 단어`;
            wordCountElement.title = `${words} 단어, ${chars} 글자`;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Try CodeMirror, fallback to textarea
            initBasicTextarea(); // For now, use textarea until CodeMirror CDN is fixed
        });
    } else {
        initBasicTextarea();
    }

})();
