"""
메인 윈도우 클래스

Defines the main application window with:
- Tab interface for multiple files
- Lazy-loaded webviews with LRU cache
- File explorer sidebar
- Backend connection
"""

import json
from pathlib import Path
from typing import Dict, Optional
from PyQt6.QtWidgets import (QMainWindow, QTabWidget, QStackedWidget, QWidget,
                              QVBoxLayout, QHBoxLayout, QLabel, QPushButton)
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineSettings
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import QUrl, Qt, QFile, QTextStream, QEvent
from PyQt6.QtGui import QCloseEvent, QShortcut, QKeySequence, QFont

from .menu_bar import MenuBar
from .toolbar import ToolBar
from .status_bar import StatusBar
from .file_explorer import FileExplorer
from backend.api import BackendAPI
from backend.tab_manager import TabManager
from backend.session_manager import SessionManager
from backend.file_manager import FileManager
from utils.theme_manager import ThemeManager
from utils.design_manager import DesignManager
from .title_bar import TitleBar
from .settings_dialog import SettingsDialog


class MainWindow(QMainWindow):
    """Main application window with tab interface"""

    MAX_WEBVIEW_CACHE = 3  # Maximum number of cached webviews

    def __init__(self, initial_file=None, initial_content=None):
        super().__init__()
        self.setWindowFlags(Qt.WindowType.Window)
        self.setWindowTitle("Saekim - Markdown Editor")
        self.setGeometry(100, 100, 1200, 800)

        # Windows native event handling setup
        self._border_width = 5
        self._title_bar_height = 32
        
        # Apply Windows styles for Aero Snap
        self._apply_native_window_styles()





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

        self.setup_backend()
        self.setup_ui()
        
        # Initialize theme manager before menu bar
        self.theme_manager = ThemeManager(self.session_manager.session_file)
        
        # self.setup_menu_and_toolbar() # Removed for custom UI
        self.setup_custom_title_bar()
        
        # Apply initial theme
        self.apply_theme(self.theme_manager.current_theme)
        
        self.restore_session()

    def changeEvent(self, event):
        """Handle window state changes to adjust margins"""
        if event.type() == QEvent.Type.WindowStateChange:
            if self.windowState() & Qt.WindowState.WindowMaximized:
                # Add margin when maximized to prevent content from being cut off
                # Windows usually pushes the window 8px off screen when maximized
                self.setContentsMargins(8, 8, 8, 8)
            else:
                # Remove margin when restored
                self.setContentsMargins(0, 0, 0, 0)
                
        super().changeEvent(event)

    def resizeEvent(self, event):
        """Handle window resize events"""
        # Limit file explorer width to 1/3 of window width
        if hasattr(self, 'file_explorer'):
            max_width = self.width() // 3
            self.file_explorer.setMaximumWidth(max_width)
            
        super().resizeEvent(event)

    def _apply_native_window_styles(self):
        """Apply Windows styles to enable Aero Snap while keeping frameless look"""
        import ctypes
        from ctypes import wintypes
        
        hwnd = self.winId().__int__()
        
        # Constants
        GWL_STYLE = -16
        WS_CAPTION = 0x00C00000
        WS_THICKFRAME = 0x00040000
        SWP_FRAMECHANGED = 0x0020
        SWP_NOMOVE = 0x0002
        SWP_NOSIZE = 0x0001
        SWP_NOZORDER = 0x0004
        SWP_NOACTIVATE = 0x0010
        
        # Get current style
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_STYLE)
        
        # Add Caption and ThickFrame styles
        # These are required for Aero Snap and native resizing
        style |= WS_CAPTION | WS_THICKFRAME
        
        # Set new style
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_STYLE, style)
        
        # Trigger frame recalculation (WM_NCCALCSIZE)
        ctypes.windll.user32.SetWindowPos(
            hwnd, 0, 0, 0, 0, 0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
        )

    def nativeEvent(self, event_type, message):
        """Handle Windows native events for resizing and snapping"""
        try:
            # Ensure attributes exist (in case called before __init__ completes)
            if not hasattr(self, '_border_width') or not hasattr(self, '_title_bar_height'):
                return False, 0

            if event_type == "windows_generic_MSG":
                import ctypes
                from ctypes import wintypes
                from PyQt6.QtGui import QCursor
                from PyQt6.QtWidgets import QPushButton
                
                msg = ctypes.wintypes.MSG.from_address(int(message))
                
                # WM_NCCALCSIZE = 0x0083
                if msg.message == 0x0083:
                    # If wParam is TRUE, it specifies that the application should indicate 
                    # which part of the client area contains valid information.
                    if msg.wParam:
                        # We return 0 to indicate that the entire window is the client area,
                        # effectively hiding the native frame and caption.
                        
                        # However, when maximized, the window extends beyond the screen boundaries
                        # to hide the borders. We need to adjust for this.
                        if self.isMaximized():
                            # Get monitor info to adjust coordinates
                            monitor = ctypes.windll.user32.MonitorFromWindow(msg.hWnd, 2) # MONITOR_DEFAULTTONEAREST
                            
                            class MONITORINFO(ctypes.Structure):
                                _fields_ = [
                                    ("cbSize", ctypes.c_ulong),
                                    ("rcMonitor", ctypes.wintypes.RECT),
                                    ("rcWork", ctypes.wintypes.RECT),
                                    ("dwFlags", ctypes.c_ulong),
                                ]
                            
                            monitor_info = MONITORINFO()
                            monitor_info.cbSize = ctypes.sizeof(MONITORINFO)
                            ctypes.windll.user32.GetMonitorInfoW(monitor, ctypes.byref(monitor_info))
                            
                            # For now, returning 0 (WVR_REDRAW might be better) works for "fullscreen" client area.
                            pass

                        return True, 0
                
                # WM_NCHITTEST = 0x0084
                if msg.message == 0x0084:
                    # Use QCursor.pos() for DPI-aware coordinates
                    # msg.lParam provides physical pixels, but Qt works with logical pixels
                    global_pos = QCursor.pos()
                    x = global_pos.x()
                    y = global_pos.y()

                    # Get window geometry in global coordinates (logical pixels)
                    frame = self.frameGeometry()
                    
                    # Determine borders based on global coordinates
                    # Note: When maximized, we shouldn't allow resizing
                    if self.isMaximized():
                        isOnLeft = False
                        isOnRight = False
                        isOnTop = False
                        isOnBottom = False
                    else:
                        isOnLeft = x < frame.x() + self._border_width
                        isOnRight = x >= frame.x() + frame.width() - self._border_width
                        isOnTop = y < frame.y() + self._border_width
                        isOnBottom = y >= frame.y() + frame.height() - self._border_width
                    
                    # Hit test codes
                    HTCLIENT = 1
                    HTCAPTION = 2
                    HTLEFT = 10
                    HTRIGHT = 11
                    HTTOP = 12
                    HTTOPLEFT = 13
                    HTTOPRIGHT = 14
                    HTBOTTOM = 15
                    HTBOTTOMLEFT = 16
                    HTBOTTOMRIGHT = 17
                    
                    # 1. Corners
                    if isOnLeft and isOnTop: return True, HTTOPLEFT
                    if isOnRight and isOnTop: return True, HTTOPRIGHT
                    if isOnLeft and isOnBottom: return True, HTBOTTOMLEFT
                    if isOnRight and isOnBottom: return True, HTBOTTOMRIGHT
                        
                    # 2. Edges
                    if isOnLeft: return True, HTLEFT
                    if isOnRight: return True, HTRIGHT
                    if isOnTop: return True, HTTOP
                    if isOnBottom: return True, HTBOTTOM
                        
                    # 3. Title bar (Caption)
                    # Check if y is within title bar height from top of frame
                    if y < frame.y() + self._title_bar_height and not isOnTop:
                        # Check for child widgets (buttons)
                        # We need local coordinates for childAt
                        # Use QCursor.pos() for reliable global position
                        global_pos = QCursor.pos()
                        local_pos = self.mapFromGlobal(global_pos)
                        
                        child = self.childAt(local_pos)
                        if child:
                            # If hovering over a button, let it handle the event
                            curr = child
                            while curr and curr != self:
                                if isinstance(curr, QPushButton):
                                    return True, HTCLIENT
                                curr = curr.parent()
                        
                        return True, HTCAPTION
                        
                    return True, HTCLIENT
                    
        except Exception as e:
            # Print error but don't crash
            import traceback
            traceback.print_exc()
            print(f"Native event error: {e}")
            pass
            
        return False, 0

    def apply_theme(self, theme_name: str):
        """Apply theme using ThemeManager"""
        theme_data = self.theme_manager.apply_theme(theme_name)

        # Save preference
        self.theme_manager.save_preference()

        # Determine icon color
        icon_color = "#D0D0D0" if theme_data.get('is_dark', True) else "#555555"

        # Update UI icons
        if hasattr(self, 'title_bar'):
            self.title_bar.update_icons(icon_color)

        if hasattr(self, 'file_explorer'):
            self.file_explorer.update_icons(icon_color)

        # Update welcome screen styling
        if hasattr(self, 'welcome_widget'):
            self.update_welcome_screen_theme(theme_data, icon_color)

        # Update webview if it exists
        if hasattr(self, 'webview_cache'):
            for webview in self.webview_cache.values():
                self.update_webview_theme(webview, theme_data)
                # Also update icons in webview
                import json
                icons_json = json.dumps(DesignManager.get_web_icons(icon_color))
                webview.page().runJavaScript(f"if(window.updateIcons) window.updateIcons({icons_json});")

    def update_welcome_screen_theme(self, theme_data: dict, icon_color: str):
        """Update welcome screen styling via JS"""
        if hasattr(self, 'welcome_widget') and isinstance(self.welcome_widget, QWebEngineView):
            # Pass theme data to JS
            js_code = f"if (typeof updateTheme === 'function') {{ updateTheme({json.dumps(theme_data)}); }}"
            self.welcome_widget.page().runJavaScript(js_code)
            
            # Pass icons to JS
            icons = {
                'open_folder': DesignManager.Icons.OPEN_FOLDER.replace('{color}', '#2E3440' if theme_data.get('is_dark') else '#FFFFFF'), # Primary button text color
                'open_file': DesignManager.Icons.OPEN_FILE.replace('{color}', icon_color),
                'new_file': DesignManager.Icons.NEW_FILE.replace('{color}', icon_color)
            }
            # Adjust icon color for primary button (Open Folder)
            # The primary button usually has a contrasting text color (e.g. white or dark grey)
            # For now, let's use the icon_color for secondary buttons, and a specific color for primary
            
            # Re-evaluating colors based on theme
            is_dark = theme_data.get('is_dark', True)
            primary_btn_text_color = "#2E3440" if is_dark else "#FFFFFF" # Based on CSS vars
            
            icons['open_folder'] = DesignManager.Icons.OPEN_FOLDER.replace('{color}', primary_btn_text_color)
            
            js_code_icons = f"if (typeof updateIcons === 'function') {{ updateIcons({json.dumps(icons)}); }}"
            self.welcome_widget.page().runJavaScript(js_code_icons)

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

        # Create stacked widget to switch between welcome screen and tab widget
        self.stacked_widget = QStackedWidget()

        # Create welcome screen widget
        self.welcome_widget = self._create_welcome_widget()

        # Add widgets to stacked widget
        self.stacked_widget.addWidget(self.tab_widget)  # index 0
        self.stacked_widget.addWidget(self.welcome_widget)  # index 1

        # Set stacked widget as central widget
        self.setCentralWidget(self.stacked_widget)

        # Start with tab widget visible
        self.stacked_widget.setCurrentWidget(self.tab_widget)

        # Apply tab styling after file explorer is created
        # self.apply_tab_styling()  # Removed in favor of global QSS

        # Setup shortcuts
        self.shortcut_close_tab = QShortcut(QKeySequence("Ctrl+W"), self)
        self.shortcut_close_tab.activated.connect(self.close_current_tab)

        print("[OK] Tab interface and file explorer initialized")

    def _create_welcome_widget(self):
        """Create welcome screen using QWebEngineView"""
        # Create webview
        webview = QWebEngineView()
        webview.setObjectName("WelcomeScreenWebView")
        
        # Configure page settings
        settings = webview.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        
        # Setup QWebChannel
        channel = QWebChannel(webview.page())
        channel.registerObject('backend', self.backend)
        webview.page().setWebChannel(channel)
        
        # Load HTML
        welcome_html_path = self.ui_path.parent / 'welcome.html'
        if welcome_html_path.exists():
            webview.setUrl(QUrl.fromLocalFile(str(welcome_html_path)))
        else:
            print(f"Error: Welcome HTML not found at {welcome_html_path}")
            
        return webview
        card_widget.setFixedWidth(300)
        card_layout = QVBoxLayout(card_widget)
        card_layout.setSpacing(30)
        card_layout.setContentsMargins(40, 50, 40, 50)

        # Message only - Removed as per user request
        # message_label = QLabel("파일을 왼쪽의 File explorer나 아래의 버튼으로 열어서 시작하세요")
        # ...

        # Buttons container
        buttons_layout = QVBoxLayout()
        buttons_layout.setSpacing(12)

        # Open Folder button
        folder_icon, folder_text = DesignManager.get_icon_data(DesignManager.Icons.OPEN_FOLDER)
        self.welcome_btn_open_folder = QPushButton("폴더 열기")
        if folder_icon:
            self.welcome_btn_open_folder.setIcon(folder_icon)
        self.welcome_btn_open_folder.setObjectName("WelcomeButtonPrimary")
        self.welcome_btn_open_folder.setMinimumHeight(50)
        self.welcome_btn_open_folder.setCursor(Qt.CursorShape.PointingHandCursor)
        buttons_layout.addWidget(self.welcome_btn_open_folder)

        # Open File button
        file_icon, file_text = DesignManager.get_icon_data(DesignManager.Icons.OPEN_FILE)
        self.welcome_btn_open_file = QPushButton("파일 열기")
        if file_icon:
            self.welcome_btn_open_file.setIcon(file_icon)
        self.welcome_btn_open_file.setObjectName("WelcomeButtonPrimary")
        self.welcome_btn_open_file.setMinimumHeight(50)
        self.welcome_btn_open_file.setCursor(Qt.CursorShape.PointingHandCursor)
        buttons_layout.addWidget(self.welcome_btn_open_file)

        # New File button
        new_icon, new_text = DesignManager.get_icon_data(DesignManager.Icons.NEW_FILE)
        self.welcome_btn_new_file = QPushButton("새 파일")
        if new_icon:
            self.welcome_btn_new_file.setIcon(new_icon)
        self.welcome_btn_new_file.setObjectName("WelcomeButtonSecondary")
        self.welcome_btn_new_file.setMinimumHeight(50)
        self.welcome_btn_new_file.setCursor(Qt.CursorShape.PointingHandCursor)
        buttons_layout.addWidget(self.welcome_btn_new_file)

        card_layout.addLayout(buttons_layout)

        # Add card to main layout
        main_layout.addWidget(card_widget, alignment=Qt.AlignmentFlag.AlignCenter)

        # Styling will be applied dynamically based on theme
        return widget

    def close_current_tab(self):
        """Close the currently active tab"""
        index = self.tab_widget.currentIndex()
        if index != -1:
            self.on_tab_close_requested(index)

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
        # Set default background color to prevent white flash
        from PyQt6.QtGui import QColor
        page.setBackgroundColor(QColor("#1E1E1E"))
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

            # Inject icons
            import json
            # Determine icon color
            theme_data = self.theme_manager.get_current_theme_data()
            icon_color = "#D0D0D0" if theme_data.get('is_dark', True) else "#555555"
            icons_json = json.dumps(DesignManager.get_web_icons(icon_color))
            webview.page().runJavaScript(f"if(window.updateIcons) window.updateIcons({icons_json});")

            # Set default view mode to split
            if hasattr(self, 'title_bar'):
                self.title_bar.set_view_mode('split')

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

        # Connect title bar signals
        self.title_bar.toggle_sidebar.connect(self.toggle_file_explorer)
        self.title_bar.settings_requested.connect(self.show_settings)

        # Connect TitleBar signals for file operations
        self.title_bar.new_file_requested.connect(self.backend.new_file)
        self.title_bar.open_folder_requested.connect(self.open_folder_dialog)
        self.title_bar.import_md_requested.connect(self.backend.open_file_dialog)
        self.title_bar.import_pdf_requested.connect(self.import_from_pdf)
        self.title_bar.export_pdf_requested.connect(self.export_pdf)

        print("[OK] Custom title bar and file explorer signals connected")

    def open_folder_dialog(self):
        """Open folder dialog and set file explorer root"""
        from PyQt6.QtWidgets import QFileDialog
        folder_path = QFileDialog.getExistingDirectory(self, "Open Folder", self.file_explorer.get_current_path())
        if folder_path:
            self.file_explorer.set_root_path(folder_path)
            # Show file explorer if it was hidden
            if self.file_explorer.isHidden():
                self.file_explorer.show()

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
            self.setWindowTitle(f"{title} - Saekim")
            if hasattr(self, 'title_bar'):
                self.title_bar.set_title(f"{title} - Saekim")

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

        # If no tabs left, show welcome screen
        if self.tab_widget.count() == 0:
            self.setWindowTitle("새김 - 마크다운 에디터")
            if hasattr(self, 'title_bar'):
                self.title_bar.set_title("새김 - 마크다운 에디터")
            # Show welcome screen - check if explorer has path
            has_explorer_path = self.file_explorer.has_root_path()
            self.show_welcome_screen(show_folder_button=not has_explorer_path, hide_explorer=False)

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

        # Hide welcome screen if it's showing (first tab created)
        if self.stacked_widget.currentWidget() == self.welcome_widget:
            self.hide_welcome_screen()

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

    def show_welcome_screen(self, show_folder_button=True, hide_explorer=False):
        """
        Show welcome screen and hide tab widget

        Args:
            show_folder_button: Show "Open Folder" button (True for first run, False if explorer path exists)
            hide_explorer: Hide file explorer completely (True for first run)
        """
        # Hide file explorer if requested
        if hide_explorer:
            self.file_explorer.hide()

        # Apply current theme to welcome screen
        if hasattr(self, 'theme_manager'):
            theme_data = self.theme_manager.THEMES.get(self.theme_manager.current_theme, {})
            icon_color = "#D0D0D0" if theme_data.get('is_dark', True) else "#555555"
            self.update_welcome_screen_theme(theme_data, icon_color)

        # Switch to welcome screen
        self.stacked_widget.setCurrentWidget(self.welcome_widget)

        # Handle file explorer visibility
        if hide_explorer:
            self.file_explorer.hide()
        else:
            # Keep explorer visible but set to empty state if no path
            if not self.file_explorer.has_root_path():
                self.file_explorer.set_empty_state()

        print(f"[OK] Welcome screen displayed (folder_btn={show_folder_button}, hide_explorer={hide_explorer})")

    def hide_welcome_screen(self):
        """Hide welcome screen and show tab widget"""
        # Switch to tab widget
        self.stacked_widget.setCurrentWidget(self.tab_widget)

        # Show file explorer if it was hidden
        if self.file_explorer.isHidden():
            self.file_explorer.show()

        print("[OK] Welcome screen hidden")

    def restore_session(self):
        """Restore previous session if available"""
        # Try to restore session
        try:
            session_data = self.session_manager.load_session()
        except Exception as e:
            print(f"[ERROR] Session corrupted: {e}")
            self.session_manager.clear_session()
            # No session - show full welcome screen with folder button and hide explorer
            self.show_welcome_screen(show_folder_button=True, hide_explorer=True)
            return

        # No session data at all - first run
        if not session_data:
            self.show_welcome_screen(show_folder_button=True, hide_explorer=True)
            return

        # Get explorer path from session
        explorer_path = session_data.get('explorer_path')
        tabs_data = session_data.get('tabs', [])

        # Try to restore tabs
        restored_tabs = 0
        if tabs_data:
            for tab_data in tabs_data:
                file_path = tab_data.get('file_path')
                if file_path and Path(file_path).exists():
                    success, content, error = FileManager.open_file(file_path)
                    if success:
                        self.create_new_tab(file_path, content)
                        restored_tabs += 1

        # Scenario 1: Tabs were restored successfully
        if restored_tabs > 0:
            print(f"[OK] Session restored: {restored_tabs} tabs")
            # Set file explorer to first tab's directory
            first_tab = self.tab_manager.get_active_tab()
            if first_tab and first_tab.file_path:
                self.file_explorer.set_root_path(str(first_tab.file_path.parent))
            elif explorer_path:
                self.file_explorer.set_root_path(explorer_path)
            self.initial_file = None
            return

        # Scenario 2: Session exists with explorer path but no tabs
        if explorer_path:
            print(f"[OK] Session has explorer path but no tabs: {explorer_path}")
            self.file_explorer.set_root_path(explorer_path)
            # Show simplified welcome screen (no folder button)
            self.show_welcome_screen(show_folder_button=False, hide_explorer=False)
            return

        # Scenario 3: Session exists but no tabs and no explorer path - treat as first run
        print("[OK] Session exists but empty - showing full welcome screen")
        self.show_welcome_screen(show_folder_button=True, hide_explorer=True)

    def closeEvent(self, event: QCloseEvent):
        """
        Called when window is closing

        Args:
            event: Close event
        """
        # Get current file explorer path
        explorer_path = None
        if self.file_explorer.has_root_path():
            explorer_path = self.file_explorer.model.rootPath()

        # Check if there are any tabs with file paths
        tabs_with_files = [
            tab for tab in self.tab_manager.tabs.values()
            if tab.file_path is not None
        ]

        if tabs_with_files or explorer_path:
            # Save session if there are tabs with files OR explorer has a path
            self.session_manager.save_session(self.tab_manager, explorer_path)
            print(f"[OK] Session saved on exit: {len(tabs_with_files)} tabs, explorer: {explorer_path}")
        else:
            # No tabs with files and no explorer path - clear session
            self.session_manager.clear_session()
            print("[OK] Session cleared on exit (no files open)")

        # Accept the close event
        event.accept()
