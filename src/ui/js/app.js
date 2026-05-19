/**
 * Main application controller for Saekim editor
 */

const PlatformUX = {
    isMac: /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent),

    primaryModifierLabel() {
        return this.isMac ? 'Cmd' : 'Ctrl';
    },

    alternateModifierLabel() {
        return this.isMac ? 'Option' : 'Alt';
    },

    shortcutLabel(sequence) {
        return sequence
            .replace(/\bPrimary\b/g, this.primaryModifierLabel())
            .replace(/\bAlt\b/g, this.alternateModifierLabel());
    },

    titleWithShortcut(title, sequence) {
        return `${title} (${this.shortcutLabel(sequence)})`;
    }
};

window.PlatformUX = PlatformUX;

const App = {
    // Backend reference (Python via QWebChannel)
    backend: null,

    // Application state
    state: {
        currentFile: null,
        isDirty: false,
        theme: 'light',
        editorContent: '',
        previewContent: '',
        projectRoot: ''  // Project root path for resolving relative paths
    },

    /**
     * Initialize the application
     */
    async init() {
        console.log('새김 에디터 초기화 중...');

        try {
            // Connect to Python backend
            await this.connectBackend();

            // Apply OS-specific labels before modules create additional controls
            this.applyPlatformUX();

            // Initialize modules
            this.setupResizer();
            this.setupEventListeners();

            // Load saved state from localStorage
            this.loadState();

            // Initialize editor
            if (typeof EditorModule !== 'undefined') {
                EditorModule.init();
            }

            // Initialize preview
            if (typeof PreviewModule !== 'undefined') {
                PreviewModule.init();
            }

            // Initialize theme
            if (typeof ThemeModule !== 'undefined') {
                ThemeModule.init();
            }

            // Initialize settings (font size, layout, etc.)
            if (typeof SettingsModule !== 'undefined') {
                SettingsModule.init();
            }

            console.log('✅ 초기화 완료');
        } catch (error) {
            console.error('❌ 초기화 실패:', error);
        }
    },

    /**
     * Connect to Python backend via QWebChannel
     */
    connectBackend() {
        return new Promise((resolve, reject) => {
            // Check if QWebChannel is available
            if (typeof QWebChannel === 'undefined') {
                console.warn('⚠️ QWebChannel을 사용할 수 없습니다 (개발 모드)');
                resolve();
                return;
            }

            // Check if qt.webChannelTransport is available
            if (typeof qt === 'undefined' || !qt.webChannelTransport) {
                console.warn('⚠️ Qt WebChannel transport를 사용할 수 없습니다');
                resolve();
                return;
            }

            // Connect to Python
            new QWebChannel(qt.webChannelTransport, (channel) => {
                this.backend = channel.objects.backend;
                console.log('✅ Python 백엔드 연결됨');

                // Get project root for image path resolution
                if (this.backend && this.backend.get_project_root) {
                    this.backend.get_project_root((resultJson) => {
                        try {
                            const result = JSON.parse(resultJson);
                            if (result.success) {
                                this.state.projectRoot = result.path.replace(/\\/g, '/');
                                console.log('🏠 프로젝트 루트:', this.state.projectRoot);
                            }
                        } catch (e) {
                            console.error('프로젝트 루트 파싱 실패:', e);
                        }
                    });
                }

                resolve();
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!this.backend) {
                    console.warn('⚠️ Backend 연결 타임아웃');
                    resolve(); // Still resolve to allow app to work in development
                }
            }, 5000);
        });
    },

    /**
     * Setup resizer for split panes
     */
    setupResizer() {
        const resizer = document.getElementById('resizer');
        const editorPane = document.querySelector('.editor-pane');
        const previewPane = document.querySelector('.preview-pane');

        if (!resizer || !editorPane || !previewPane) {
            console.warn('⚠️ Resizer 요소를 찾을 수 없습니다');
            return;
        }

        let isResizing = false;
        let startX = 0;
        let startEditorWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startEditorWidth = editorPane.offsetWidth;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newEditorWidth = startEditorWidth + deltaX;
            const containerWidth = editorPane.parentElement.offsetWidth;
            const minWidth = 300;
            const maxWidth = containerWidth - minWidth - resizer.offsetWidth;

            if (newEditorWidth >= minWidth && newEditorWidth <= maxWidth) {
                const previewWidth = containerWidth - newEditorWidth - resizer.offsetWidth;
                resizer.parentElement.style.gridTemplateColumns = `${newEditorWidth}px ${resizer.offsetWidth}px ${previewWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });

        console.log('✅ Resizer 설정 완료');
    },

    /**
     * Apply platform-specific UI affordances inside the web editor.
     */
    applyPlatformUX() {
        document.documentElement.dataset.platform = PlatformUX.isMac ? 'macos' : 'default';

        const shortcutTitles = [
            ['btn-undo', '실행 취소', 'Primary+Z'],
            ['btn-redo', '다시 실행', PlatformUX.isMac ? 'Primary+Shift+Z' : 'Primary+Y'],
            ['btn-markdown-helper', '마크다운 문법 도우미', 'Primary+Shift+D'],
            ['btn-katex-helper', 'KaTeX 수식 도우미', 'Primary+Shift+K'],
            ['btn-mermaid-helper', 'Mermaid 다이어그램 도우미', 'Primary+Shift+M'],
            ['btn-find', '찾기', 'Primary+F'],
        ];

        shortcutTitles.forEach(([id, title, shortcut]) => {
            const element = document.getElementById(id);
            if (element) {
                element.title = PlatformUX.titleWithShortcut(title, shortcut);
            }
        });

        console.log(`✅ Platform UX 적용: ${PlatformUX.isMac ? 'macOS' : 'default'}`);
    },

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            }

            // Ctrl/Cmd + O: Open
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                this.openFile();
            }

            // Ctrl/Cmd + N: New file
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.newFile();
            }

            // Ctrl/Cmd + F: Find
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (typeof FindReplaceModule !== 'undefined') {
                    FindReplaceModule.showFind();
                }
            }
        });

        // Warn before closing if there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.state.isDirty) {
                e.preventDefault();
                e.returnValue = '저장하지 않은 변경사항이 있습니다. 정말 종료하시겠습니까?';
            }
        });

        console.log('✅ 이벤트 리스너 설정 완료');
    },

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const savedContent = localStorage.getItem('saekim_draft');
            if (savedContent && typeof EditorModule !== 'undefined') {
                EditorModule.setContent(savedContent);
                this.state.editorContent = savedContent;
                console.log('✅ 자동 저장된 내용 복원됨');
            }

            // Load theme preference
            const savedTheme = localStorage.getItem('saekim_theme');
            if (savedTheme) {
                this.setTheme(savedTheme);
            }
        } catch (error) {
            console.error('❌ 상태 로드 실패:', error);
        }
    },

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            if (typeof EditorModule !== 'undefined') {
                const content = EditorModule.getContent();
                localStorage.setItem('saekim_draft', content);
                this.state.editorContent = content;
            }
        } catch (error) {
            console.error('❌ 상태 저장 실패:', error);
        }
    },

    /**
     * Set theme
     */
    setTheme(theme) {
        this.state.theme = theme;
        localStorage.setItem('saekim_theme', theme);

        const themeLink = document.getElementById('theme-stylesheet');
        if (themeLink) {
            themeLink.href = `css/theme-${theme}.css`;
        }

        document.body.setAttribute('data-theme', theme);
        console.log(`✅ 테마 변경: ${theme}`);

        // Save theme to QSettings via backend (for next startup)
        if (this.backend && this.backend.save_theme) {
            this.backend.save_theme(theme, (resultJson) => {
                try {
                    const result = JSON.parse(resultJson);
                    if (result.success) {
                        console.log('✅ 테마 설정 저장됨');
                    }
                } catch (e) {
                    console.error('테마 저장 실패:', e);
                }
            });
        }
    },

    /**
     * New file
     */
    newFile() {
        if (this.state.isDirty) {
            if (!confirm('저장하지 않은 변경사항이 있습니다. 새 파일을 만드시겠습니까?')) {
                return;
            }
        }

        if (typeof EditorModule !== 'undefined') {
            EditorModule.setContent('');
            this.state.editorContent = '';
            this.state.currentFile = null;
            this.state.isDirty = false;
        }

        console.log('📄 새 파일 생성');
    },

    /**
     * Open file
     */
    async openFile() {
        if (!this.backend) {
            console.warn('⚠️ Backend가 연결되지 않았습니다');
            return;
        }

        try {
            console.log('📂 파일 열기...');

            // Call Python backend to open file dialog
            this.backend.open_file_dialog((resultJson) => {
                const result = JSON.parse(resultJson);

                if (result.success) {
                    // Update editor with file content
                    if (typeof EditorModule !== 'undefined') {
                        EditorModule.setContent(result.content);
                        this.state.editorContent = result.content;
                        this.state.currentFile = result.filepath;
                        this.state.isDirty = false;

                        console.log('✅ 파일 열기 성공:', result.filepath);
                        if (typeof Utils !== 'undefined') {
                            Utils.showToast('파일을 열었습니다', 'success');
                        }
                    }
                } else if (result.error !== 'Cancelled') {
                    console.error('❌ 파일 열기 실패:', result.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('파일 열기 실패: ' + result.error, 'error');
                    }
                }
            });
        } catch (error) {
            console.error('❌ 파일 열기 실패:', error);
        }
    },

    /**
     * Save file
     */
    async saveFile() {
        if (!this.backend) {
            console.warn('⚠️ Backend가 연결되지 않았습니다');
            this.saveState(); // At least save to localStorage
            if (typeof Utils !== 'undefined') {
                Utils.showToast('로컬 저장소에 임시 저장되었습니다', 'info');
            }
            return;
        }

        try {
            const content = typeof EditorModule !== 'undefined' ? EditorModule.getContent() : '';

            console.log('💾 파일 저장 중...', content.length, 'characters');

            // Call Python backend to save file
            this.backend.save_file(content, (resultJson) => {
                const result = JSON.parse(resultJson);

                if (result.success) {
                    this.state.currentFile = result.filepath;
                    this.state.isDirty = false;

                    console.log('✅ 파일 저장 성공:', result.filepath);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('파일을 저장했습니다', 'success');
                    }
                } else if (result.error !== 'Cancelled') {
                    console.error('❌ 파일 저장 실패:', result.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('파일 저장 실패: ' + result.error, 'error');
                    }
                }
            });
        } catch (error) {
            console.error('❌ 파일 저장 실패:', error);
        }
    },

    /**
     * Save file as (with dialog)
     */
    async saveFileAs() {
        if (!this.backend) {
            console.warn('⚠️ Backend가 연결되지 않았습니다');
            return;
        }

        try {
            const content = typeof EditorModule !== 'undefined' ? EditorModule.getContent() : '';

            console.log('💾 다른 이름으로 저장...');

            // Call Python backend to save file as
            this.backend.save_file_as_dialog(content, (resultJson) => {
                const result = JSON.parse(resultJson);

                if (result.success) {
                    this.state.currentFile = result.filepath;
                    this.state.isDirty = false;

                    console.log('✅ 파일 저장 성공:', result.filepath);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('파일을 저장했습니다', 'success');
                    }
                } else if (result.error !== 'Cancelled') {
                    console.error('❌ 파일 저장 실패:', result.error);
                    if (typeof Utils !== 'undefined') {
                        Utils.showToast('파일 저장 실패: ' + result.error, 'error');
                    }
                }
            });
        } catch (error) {
            console.error('❌ 파일 저장 실패:', error);
        }
    },

    /**
     * Mark content as modified
     */
    markDirty() {
        this.state.isDirty = true;
        if (this.backend && this.backend.mark_modified) {
            this.backend.mark_modified('true');
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Global function for setting editor content from Python backend
window.setEditorContent = function (content) {
    if (typeof EditorModule !== 'undefined' && EditorModule.setContent) {
        EditorModule.setContent(content);
        App.state.editorContent = content;
        App.state.isDirty = false;
        // Clear localStorage draft since we're loading from file
        localStorage.removeItem('saekim_draft');
        console.log('✅ 초기 콘텐츠 설정됨 (' + content.length + ' chars)');
    } else {
        console.error('❌ EditorModule not available');
    }
};

// Global function for setting current file path from Python backend
window.setCurrentFile = function (filePath) {
    App.state.currentFile = filePath;
    console.log('✅ 현재 파일 설정:', filePath);
};

// Global function for updating icons from Python backend
window.updateIcons = function (icons) {
    console.log('🎨 아이콘 업데이트 중...');
    for (const [id, content] of Object.entries(icons)) {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = content;
        }
    }
    console.log('✅ 아이콘 업데이트 완료');
};
