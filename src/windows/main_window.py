"""
메인 윈도우 클래스

Defines the main application window with:
- Tab interface for multiple files
- Lazy-loaded webviews with LRU cache
- File explorer sidebar
- Backend connection
"""

from pathlib import Path
from typing import Dict, Optional
from PyQt6.QtWidgets import QMainWindow, QTabWidget
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import QUrl, Qt, QFile, QTextStream
from PyQt6.QtGui import QCloseEvent

from .menu_bar import MenuBar
from .toolbar import ToolBar
from .status_bar import StatusBar
from .file_explorer import FileExplorer
from backend.api import BackendAPI
from backend.tab_manager import TabManager
from backend.session_manager import SessionManager
from backend.file_manager import FileManager
from utils.theme_manager import ThemeManager
from .title_bar import TitleBar
from .settings_dialog import SettingsDialog


class MainWindow(QMainWindow):
    """Main application window with tab interface"""

    MAX_WEBVIEW_CACHE = 3  # Maximum number of cached webviews

    def __init__(self, initial_file=None, initial_content=None):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self.setWindowTitle("새김 - 마크다운 에디터")
        self.setGeometry(100, 100, 1200, 800)

        # Store initial file info
        self.initial_file = initial_file
        self.initial_content = initial_content if initial_content else ""

        # Tab management
        self.tab_manager = TabManager()

        # Session management
        session_file = Path.home() / '.saekim' / 'session.json'
        self.session_manager = SessionManager(session_file)

        # Webview cache (LRU cache of webviews)
        self.webview_cache: Dict[str, QWebEngineView] = {}  # tab_id -> webview

        # Shared QWebChannel for all tabs
        self.channel = QWebChannel()

        self.setup_ui()
        self.setup_backend()
        
        # Initialize theme manager before menu bar
        self.theme_manager = ThemeManager(self.session_manager.session_file)
        
        # self.setup_menu_and_toolbar() # Removed for custom UI
        self.setup_custom_title_bar()
        
        # Apply initial theme
        self.apply_theme(self.theme_manager.current_theme)
        
        self.restore_session()

    def apply_theme(self, theme_name: str):
        """Apply theme using ThemeManager"""
        theme_data = self.theme_manager.apply_theme(theme_name)
        
        # Save preference
        self.theme_manager.save_preference()
        
        # Update webview if it exists
        if hasattr(self, 'webview_cache'):
            for webview in self.webview_cache.values():
                self.update_webview_theme(webview, theme_data)

    def update_webview_theme(self, webview: QWebEngineView, theme_data: dict):
        """Update theme in a specific webview"""
        if not theme_data:
            return
            
        css_file = theme_data.get('css')
        if css_file:
            # We need to tell the webview to load this CSS file
            # This logic depends on how the webview handles themes.
            # Assuming we have a JS function to set the theme CSS.
            js_code = f"if (typeof ThemeModule !== 'undefined') {{ ThemeModule.loadThemeCSS('{css_file}'); }}"
            webview.page().runJavaScript(js_code)
            
        # Also set the theme mode (light/dark) for other JS logic
        mode = 'dark' if theme_data.get('is_dark') else 'light'
        js_code = f"if (typeof ThemeModule !== 'undefined') {{ ThemeModule.setTheme('{mode}'); }}"
        webview.page().runJavaScript(js_code)

    def setup_ui(self):
        """Initialize UI components with tab interface"""
        # Get UI path first
        self.ui_path = Path(__file__).parent.parent / 'ui' / 'index.html'
        if not self.ui_path.exists():
            print(f"Warning: UI file not found at {self.ui_path}")

        # Create file explorer first (needed for styling)
        self.file_explorer = FileExplorer(self)
        self.file_explorer.file_double_clicked.connect(self.open_file_in_new_tab)
        self.addDockWidget(Qt.DockWidgetArea.LeftDockWidgetArea, self.file_explorer)

        # Create tab widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabsClosable(True)
        self.tab_widget.setMovable(True)
        self.tab_widget.setDocumentMode(True)

        # Connect tab signals
        self.tab_widget.currentChanged.connect(self.on_tab_changed)
        self.tab_widget.tabCloseRequested.connect(self.on_tab_close_requested)

        # Set as central widget
        self.setCentralWidget(self.tab_widget)

        # Apply tab styling after file explorer is created
        # self.apply_tab_styling()  # Removed in favor of global QSS

        print("[OK] Tab interface and file explorer initialized")

    # def apply_tab_styling(self):
    #     """
    #     Apply tab styling to match file explorer colors
    #     Uses system palette from file explorer for consistency
    #     """
    #     # Removed in favor of global QSS
    #     pass

    def create_webview(self, tab_id: str) -> QWebEngineView:
        """
        Create a new webview for a tab with proper setup

        Args:
            tab_id: Tab ID to associate with this webview

        Returns:
            Configured QWebEngineView
        """
        from PyQt6.QtWebEngineCore import QWebEngineSettings, QWebEnginePage

        # Create webview
        webview = QWebEngineView()

        # Capture console messages for debugging
        class WebPage(QWebEnginePage):
            def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):
                print(f"[JS Console] {message} (line {lineNumber})")

        page = WebPage(webview)
        webview.setPage(page)

        # Enable settings
        settings = page.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)

        # Set web channel
        page.setWebChannel(self.channel)

        # Load UI
        webview.load(QUrl.fromLocalFile(str(self.ui_path)))

        # Connect load finished to restore tab content
        webview.loadFinished.connect(lambda ok: self.on_webview_loaded(ok, tab_id))

        return webview

    def on_webview_loaded(self, ok: bool, tab_id: str):
        """
        Called when a webview finishes loading

        Args:
            ok: Whether the load was successful
            tab_id: Tab ID associated with this webview
        """
        if not ok:
            return

        # Apply current theme to the new webview
        webview = self.webview_cache.get(tab_id)
        if webview:
            self.update_webview_theme(webview, self.theme_manager.get_current_theme_data())

        # Get tab info
        tab = self.tab_manager.get_tab(tab_id)
        if not tab:
            return

        # Set file path if available
        if tab.file_path:
            escaped_path = str(tab.file_path).replace('\\', '\\\\')
            js_file_code = f"""
                if (typeof window.setCurrentFile === 'function') {{
                    window.setCurrentFile("{escaped_path}");
                }}
            """
            webview = self.webview_cache.get(tab_id)
            if webview:
                webview.page().runJavaScript(js_file_code)

        # Set content
        if tab.content:
            # Escape content for JavaScript
            escaped_content = tab.content.replace('\\', '\\\\')
            escaped_content = escaped_content.replace('`', '\\`')
            escaped_content = escaped_content.replace('$', '\\$')

            js_code = f"""
                if (typeof window.setEditorContent === 'function') {{
                    window.setEditorContent(`{escaped_content}`);
                }} else {{
                    setTimeout(function() {{
                        if (typeof window.setEditorContent === 'function') {{
                            window.setEditorContent(`{escaped_content}`);
                        }}
                    }}, 500);
                }}
            """
            webview = self.webview_cache.get(tab_id)
            if webview:
                webview.page().runJavaScript(js_code)

        print(f"[OK] Tab {tab_id} content loaded")

    def setup_custom_title_bar(self):
        """Setup custom title bar"""
        self.title_bar = TitleBar(self)
        self.setMenuWidget(self.title_bar)
        
        # Connect signals
        self.title_bar.toggle_sidebar.connect(self.toggle_file_explorer)
        
        # Connect FileExplorer signals
        self.file_explorer.new_file_requested.connect(self.backend.new_file)
        self.file_explorer.open_folder_requested.connect(self.open_folder_dialog)
        self.file_explorer.import_md_requested.connect(self.backend.open_file_dialog)
        self.file_explorer.import_pdf_requested.connect(self.import_from_pdf)
        self.file_explorer.export_pdf_requested.connect(self.export_pdf)
        self.file_explorer.settings_requested.connect(self.show_settings)
        
        print("[OK] Custom title bar and file explorer signals connected")

    def open_folder_dialog(self):
        """Open folder dialog and set file explorer root"""
        from PyQt6.QtWidgets import QFileDialog
        folder_path = QFileDialog.getExistingDirectory(self, "Open Folder", self.file_explorer.get_current_path())
        if folder_path:
            self.file_explorer.set_root_path(folder_path)

    def import_from_pdf(self):
        """Trigger PDF import in JS"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.importFromPDF(); }"
        self.run_js_in_active_tab(js_code)

    def export_pdf(self):
        """Trigger PDF export in JS"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToPDF(); }"
        self.run_js_in_active_tab(js_code)
        
    def show_settings(self):
        """Show settings"""
        dialog = SettingsDialog(self, self.theme_manager)
        dialog.exec()
        
    def run_js_in_active_tab(self, js_code):
        """Run JavaScript in the active tab's webview"""
        tab = self.tab_manager.get_active_tab()
        if tab:
            webview = self.webview_cache.get(tab.tab_id)
            if webview:
                webview.page().runJavaScript(js_code)

    def toggle_file_explorer(self):
        """Toggle file explorer visibility"""
        if self.file_explorer.isVisible():
            self.file_explorer.hide()
        else:
            self.file_explorer.show()

    # def setup_menu_and_toolbar(self):
    #     """Setup menu bar, toolbar, and status bar"""
    #     # Create menu bar
    #     self.menu_bar = MenuBar(self)
    #     self.setMenuBar(self.menu_bar)
    # 
    #     # Create toolbar
    #     self.toolbar = ToolBar(self)
    #     self.addToolBar(self.toolbar)
    # 
    #     # Create status bar
    #     self.status_bar = StatusBar(self)
    #     self.setStatusBar(self.status_bar)
    # 
    #     print("[OK] Menu bar, toolbar, and status bar initialized")

    def setup_backend(self):
        """Setup backend connection with QWebChannel"""
        # Create backend API instance
        self.backend = BackendAPI(self)

        # Register backend object (accessible from JS as 'backend')
        self.channel.registerObject("backend", self.backend)

        print("[OK] QWebChannel setup complete - backend API registered")

    def get_or_create_webview(self, tab_id: str) -> QWebEngineView:
        """
        Get existing webview or create new one with LRU cache management

        Args:
            tab_id: Tab ID

        Returns:
            QWebEngineView for the tab
        """
        # Check if webview exists in cache
        if tab_id in self.webview_cache:
            return self.webview_cache[tab_id]

        # Check cache size and evict if necessary
        if len(self.webview_cache) >= self.MAX_WEBVIEW_CACHE:
            self.evict_lru_webview()

        # Create new webview
        webview = self.create_webview(tab_id)
        self.webview_cache[tab_id] = webview

        print(f"[OK] Webview created for tab {tab_id} (cache size: {len(self.webview_cache)})")

        return webview

    def evict_lru_webview(self):
        """Evict least recently used webview from cache"""
        lru_tab_id = self.tab_manager.get_least_recently_used()

        # If LRU returns None or tab not in cache, evict first cached webview
        if not lru_tab_id or lru_tab_id not in self.webview_cache:
            if self.webview_cache:
                # Evict first item in cache as fallback
                lru_tab_id = next(iter(self.webview_cache))
                print(f"[WARN] LRU failed, evicting first cached tab: {lru_tab_id}")
            else:
                print("[WARN] No webviews to evict")
                return

        if lru_tab_id in self.webview_cache:
            # Remove from cache
            webview = self.webview_cache[lru_tab_id]
            del self.webview_cache[lru_tab_id]

            # Cleanup webview
            webview.deleteLater()

            print(f"[OK] Webview evicted for tab {lru_tab_id}")

    def on_tab_changed(self, index: int):
        """
        Called when active tab changes

        Args:
            index: New tab index
        """
        if index < 0:
            return

        # Get tab ID from tab widget
        tab_id = self.tab_widget.tabWhatsThis(index)
        if not tab_id:
            return

        # Update tab manager
        self.tab_manager.switch_tab(tab_id)

        # Get the container and its layout
        container = self.tab_widget.widget(index)
        layout = container.layout()

        # Check if webview already exists in layout
        webview_in_layout = None
        if layout.count() > 0:
            widget = layout.itemAt(0).widget()
            if isinstance(widget, QWebEngineView):
                webview_in_layout = widget

        # Get or create webview for this tab
        webview = self.get_or_create_webview(tab_id)

        # Only update layout if webview is different
        if webview_in_layout != webview:
            # Clear existing widgets from layout
            while layout.count():
                item = layout.takeAt(0)
                if item.widget():
                    item.widget().setParent(None)

            # Add webview to layout
            layout.addWidget(webview)

        # Update window title
        tab = self.tab_manager.get_tab(tab_id)
        if tab:
            title = tab.get_display_name()
            if tab.is_modified:
                title = f"*{title}"
            if tab.is_modified:
                title = f"*{title}"
            self.setWindowTitle(f"{title} - 새김")
            if hasattr(self, 'title_bar'):
                self.title_bar.set_title(f"{title} - 새김")

        # Update file explorer to show current tab's file directory
        if tab and tab.file_path:
            # Set root to parent directory and focus on the file
            self.file_explorer.set_root_path(str(tab.file_path.parent))
            self.file_explorer.focus_on_file(str(tab.file_path))

    def on_tab_close_requested(self, index: int):
        """
        Called when user requests to close a tab

        Args:
            index: Tab index to close
        """
        # Get tab ID
        tab_id = self.tab_widget.tabWhatsThis(index)
        if not tab_id:
            return

        # Check if tab has unsaved changes
        tab = self.tab_manager.get_tab(tab_id)
        if tab and tab.is_modified:
            # TODO: Show save dialog
            pass

        # Remove from tab widget
        self.tab_widget.removeTab(index)

        # Remove from webview cache
        if tab_id in self.webview_cache:
            webview = self.webview_cache[tab_id]
            webview.deleteLater()
            del self.webview_cache[tab_id]

        # Remove from tab manager
        self.tab_manager.close_tab(tab_id)

        # If no tabs left, reset window title
        if self.tab_widget.count() == 0:
            self.setWindowTitle("새김 - 마크다운 에디터")
            if hasattr(self, 'title_bar'):
                self.title_bar.set_title("새김 - 마크다운 에디터")

    def create_new_tab(self, file_path: Optional[str] = None, content: str = ""):
        """
        Create a new tab

        Args:
            file_path: Optional file path
            content: Initial content
        """
        # Create tab in tab manager
        tab_id = self.tab_manager.create_tab(file_path, content)

        # Create container widget for the tab
        from PyQt6.QtWidgets import QWidget, QVBoxLayout
        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)

        # Create webview immediately and add to layout
        webview = self.get_or_create_webview(tab_id)
        layout.addWidget(webview)

        # Add tab to tab widget
        tab_label = FileManager.get_file_name(file_path)
        index = self.tab_widget.addTab(container, tab_label)

        # Store tab ID in tab widget
        self.tab_widget.setTabWhatsThis(index, tab_id)

        # Switch to new tab (this will trigger on_tab_changed)
        self.tab_widget.setCurrentIndex(index)

        print(f"[OK] New tab created: {tab_id}")

        return tab_id

    def open_file_in_new_tab(self, file_path: str):
        """
        Open a file in a new tab

        Args:
            file_path: Path to file to open
        """
        # Check if file is already open
        existing_tab_id = self.tab_manager.find_tab_by_path(file_path)
        if existing_tab_id:
            # Switch to existing tab
            for i in range(self.tab_widget.count()):
                if self.tab_widget.tabWhatsThis(i) == existing_tab_id:
                    self.tab_widget.setCurrentIndex(i)
                    return

        # Load file content
        success, content, error = FileManager.open_file(file_path)

        if not success:
            print(f"[ERROR] Failed to open file: {error}")
            return

        # Create new tab with file
        self.create_new_tab(file_path, content)

        # Update file explorer root to file's directory
        self.file_explorer.set_root_path(str(Path(file_path).parent))

    def restore_session(self):
        """Restore previous session if available"""
        # Try to restore session
        session_data = self.session_manager.load_session()

        if session_data and session_data.get('tabs'):
            # Restore tabs from session
            for tab_data in session_data['tabs']:
                file_path = tab_data.get('file_path')
                if file_path and Path(file_path).exists():
                    success, content, error = FileManager.open_file(file_path)
                    if success:
                        self.create_new_tab(file_path, content)

            # If any tabs were restored, we're done (ignore initial_file)
            if self.tab_widget.count() > 0:
                print(f"[OK] Session restored: {self.tab_widget.count()} tabs")
                # Clear initial_file to prevent opening it again
                self.initial_file = None
                return

        # No session - use initial file if provided
        if self.initial_file:
            self.open_file_in_new_tab(self.initial_file)
        else:
            # Create empty tab
            self.create_new_tab()

    def closeEvent(self, event: QCloseEvent):
        """
        Called when window is closing

        Args:
            event: Close event
        """
        # Save session
        self.session_manager.save_session(self.tab_manager)

        # Accept the close event
        event.accept()

        print("[OK] Session saved on exit")
