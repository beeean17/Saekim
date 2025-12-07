/**
 * Settings module for UI preferences
 * Handles font size, layout, and other user preferences
 */

const SettingsModule = {
    SETTINGS_KEY: 'saekim_settings',

    // Default settings
    defaults: {
        fontSize: 14,
        minFontSize: 10,
        maxFontSize: 24,
        fontSizeStep: 2,
        layout: 'horizontal', // or 'vertical'
    },

    settings: {},

    /**
     * Initialize settings module
     */
    init() {
        // Load settings from localStorage
        this.loadSettings();

        // Apply initial settings
        this.applyFontSize();

        // Setup font size controls
        this.setupFontSizeControls();

        console.log('✅ Settings 모듈 초기화 완료:', this.settings);
    },

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(this.SETTINGS_KEY);
            if (saved) {
                this.settings = { ...this.defaults, ...JSON.parse(saved) };
            } else {
                this.settings = { ...this.defaults };
            }
        } catch (error) {
            console.error('❌ 설정 로드 실패:', error);
            this.settings = { ...this.defaults };
        }
    },

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error('❌ 설정 저장 실패:', error);
        }
    },

    /**
     * Setup font size controls
     */
    setupFontSizeControls() {
        // Font size buttons removed in favor of keyboard shortcuts
        // const increaseFontBtn = document.getElementById('btn-font-increase');
        // const decreaseFontBtn = document.getElementById('btn-font-decrease');

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + = or + : Increase font size
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                this.increaseFontSize();
            }
            // Ctrl/Cmd + - : Decrease font size
            if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                this.decreaseFontSize();
            }
            // Ctrl/Cmd + 0 : Reset font size
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                this.resetFontSize();
            }
        });
    },

    /**
     * Increase font size
     */
    increaseFontSize() {
        const newSize = this.settings.fontSize + this.settings.fontSizeStep;
        if (newSize <= this.settings.maxFontSize) {
            this.setFontSize(newSize);
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`글꼴 크기: ${newSize}px`, 'info');
            }
        } else {
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`최대 글꼴 크기입니다 (${this.settings.maxFontSize}px)`, 'warning');
            }
        }
    },

    /**
     * Decrease font size
     */
    decreaseFontSize() {
        const newSize = this.settings.fontSize - this.settings.fontSizeStep;
        if (newSize >= this.settings.minFontSize) {
            this.setFontSize(newSize);
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`글꼴 크기: ${newSize}px`, 'info');
            }
        } else {
            if (typeof Utils !== 'undefined') {
                Utils.showToast(`최소 글꼴 크기입니다 (${this.settings.minFontSize}px)`, 'warning');
            }
        }
    },

    /**
     * Reset font size to default
     */
    resetFontSize() {
        this.setFontSize(this.defaults.fontSize);
        if (typeof Utils !== 'undefined') {
            Utils.showToast(`글꼴 크기 초기화: ${this.defaults.fontSize}px`, 'info');
        }
    },

    /**
     * Set font size
     * @param {number} size - Font size in pixels
     */
    setFontSize(size) {
        this.settings.fontSize = size;
        this.applyFontSize();
        this.saveSettings();
        console.log('🔤 글꼴 크기 변경:', size + 'px');
    },

    /**
     * Apply font size to editor and preview
     */
    applyFontSize() {
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');

        if (editor) {
            editor.style.fontSize = this.settings.fontSize + 'px';
        }

        if (preview) {
            preview.style.fontSize = this.settings.fontSize + 'px';
        }

        // Update CSS variable for consistency
        document.documentElement.style.setProperty('--font-size-base', this.settings.fontSize + 'px');
    },

    /**
     * Get current font size
     * @returns {number}
     */
    getFontSize() {
        return this.settings.fontSize;
    },

    /**
     * Set layout mode
     * @param {string} layout - 'horizontal' or 'vertical'
     */
    setLayout(layout) {
        if (layout !== 'horizontal' && layout !== 'vertical') {
            console.error('❌ Invalid layout:', layout);
            return;
        }

        this.settings.layout = layout;
        this.applyLayout();
        this.saveSettings();
        console.log('📐 레이아웃 변경:', layout);
    },

    /**
     * Apply layout
     */
    applyLayout() {
        const splitContainer = document.querySelector('.split-container');
        if (!splitContainer) return;

        if (this.settings.layout === 'vertical') {
            splitContainer.style.flexDirection = 'column';

            // Update resizer cursor
            const resizer = document.getElementById('resizer');
            if (resizer) {
                resizer.style.cursor = 'row-resize';
                resizer.style.width = '100%';
                resizer.style.height = '8px';
            }
        } else {
            splitContainer.style.flexDirection = 'row';

            // Update resizer cursor
            const resizer = document.getElementById('resizer');
            if (resizer) {
                resizer.style.cursor = 'col-resize';
                resizer.style.width = '8px';
                resizer.style.height = '100%';
            }
        }

        if (typeof Utils !== 'undefined') {
            const layoutName = this.settings.layout === 'vertical' ? '세로' : '가로';
            Utils.showToast(`레이아웃: ${layoutName}`, 'info');
        }
    },

    /**
     * Toggle layout between horizontal and vertical
     */
    toggleLayout() {
        const newLayout = this.settings.layout === 'horizontal' ? 'vertical' : 'horizontal';
        this.setLayout(newLayout);
    },

    /**
     * Get current layout
     * @returns {string}
     */
    getLayout() {
        return this.settings.layout;
    },

    /**
     * Get all settings
     * @returns {object}
     */
    getAllSettings() {
        return { ...this.settings };
    }
};
