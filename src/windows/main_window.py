"""
메인 윈도우 클래스

Defines the main application window with:
- UI layout setup
- Backend connection
- Event handling
"""

from pathlib import Path
from PyQt6.QtWidgets import QMainWindow
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import QUrl

from .menu_bar import MenuBar
from .toolbar import ToolBar
from .status_bar import StatusBar
from backend.api import BackendAPI


class MainWindow(QMainWindow):
    """Main application window"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("새김 - 마크다운 에디터")
        self.setGeometry(100, 100, 1200, 800)

        self.setup_ui()
        self.setup_backend()
        self.setup_menu_and_toolbar()

    def setup_ui(self):
        """Initialize UI components"""
        # Create web view for the editor UI
        self.webview = QWebEngineView()

        # Load the HTML UI
        ui_path = Path(__file__).parent.parent / 'ui' / 'index.html'

        if not ui_path.exists():
            print(f"Warning: UI file not found at {ui_path}")

        # Set as central widget
        self.setCentralWidget(self.webview)

        # Enable DevTools and settings
        from PyQt6.QtWebEngineCore import QWebEngineSettings, QWebEnginePage

        # Capture console messages for debugging
        class WebPage(QWebEnginePage):
            def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):
                print(f"[JS Console] {message} (line {lineNumber})")

        page = WebPage(self.webview)
        self.webview.setPage(page)

        settings = page.settings()
        settings.setAttribute(
            QWebEngineSettings.WebAttribute.JavascriptEnabled,
            True
        )
        # Enable remote URLs for CDN resources
        settings.setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls,
            True
        )

        # Load the HTML file
        self.webview.load(QUrl.fromLocalFile(str(ui_path)))

        print(f"[OK] UI loaded from: {ui_path}")
        print("[OK] JavaScript console logging enabled")

    def setup_menu_and_toolbar(self):
        """Setup menu bar, toolbar, and status bar"""
        # Create menu bar
        self.menu_bar = MenuBar(self)
        self.setMenuBar(self.menu_bar)

        # Create toolbar
        self.toolbar = ToolBar(self)
        self.addToolBar(self.toolbar)

        # Create status bar
        self.status_bar = StatusBar(self)
        self.setStatusBar(self.status_bar)

        print("[OK] Menu bar, toolbar, and status bar initialized")

    def setup_backend(self):
        """Setup backend connection with QWebChannel"""
        # Create QWebChannel
        self.channel = QWebChannel()

        # Create backend API instance
        self.backend = BackendAPI(self)

        # Register backend object (accessible from JS as 'backend')
        self.channel.registerObject("backend", self.backend)

        # Set the channel on the web page
        self.webview.page().setWebChannel(self.channel)

        print("[OK] QWebChannel setup complete - backend API registered")
