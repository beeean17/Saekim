"""
Custom Title Bar Widget
"""

from PyQt6.QtWidgets import QWidget, QHBoxLayout, QLabel, QPushButton, QFrame
from PyQt6.QtCore import Qt, pyqtSignal
from utils.design_manager import DesignManager

class TitleBar(QFrame):
    """
    Custom title bar to replace the native OS window frame.
    Includes:
    - Hamburger menu (Sidebar toggle)
    - Window title
    - Window controls (Minimize, Maximize/Restore, Close)
    """
    
    # Signals
    toggle_sidebar = pyqtSignal()
    settings_requested = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.main_window = parent
        self.setFixedHeight(32) # Compact title bar height
        self.main_window = parent
        self.setFixedHeight(32) # Compact title bar height
        self.setObjectName("TitleBar")
        self.current_icon_color = "#D0D0D0" # Default color

        # Main layout
        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 0, 8, 0)
        layout.setSpacing(8)
        
        # --- Left: Navigation ---
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.HAMBURGER)
        self.btn_sidebar = QPushButton(text)
        if icon:
            self.btn_sidebar.setIcon(icon)
        self.btn_sidebar.setFixedSize(26, 26)
        self.btn_sidebar.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_sidebar.setToolTip("Toggle Sidebar")
        self.btn_sidebar.clicked.connect(self.toggle_sidebar.emit)
        self.btn_sidebar.setObjectName("TitleBarButton")
        layout.addWidget(self.btn_sidebar)

        # Settings Button
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.SETTINGS)
        self.btn_settings = QPushButton(text)
        if icon:
            self.btn_settings.setIcon(icon)
        self.btn_settings.setFixedSize(26, 26)
        self.btn_settings.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_settings.setToolTip("Settings")
        self.btn_settings.clicked.connect(self.settings_requested.emit)
        self.btn_settings.setObjectName("TitleBarButton")
        layout.addWidget(self.btn_settings)

        # --- Center: Title ---
        self.title_label = QLabel("Saekim")
        self.title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.title_label.setObjectName("TitleLabel")
        # Make title hit-test transparent for dragging if needed,
        # but we handle dragging in mousePressEvent of the TitleBar itself
        layout.addWidget(self.title_label, 1) # 1 = stretch

        # --- View Toggle Buttons (Connected Group) ---
        view_container = QWidget()
        view_container.setObjectName("ViewToggleContainer")
        view_layout = QHBoxLayout(view_container)
        view_layout.setContentsMargins(0, 0, 0, 0)
        view_layout.setSpacing(0)

        self.btn_view_edit = QPushButton("Edit")
        self.btn_view_edit.setFixedSize(50, 26)
        self.btn_view_edit.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_view_edit.setToolTip("편집 모드")
        self.btn_view_edit.setObjectName("ViewToggleButton")
        self.btn_view_edit.setProperty("position", "left")
        self.btn_view_edit.setProperty("active", True)
        self.btn_view_edit.clicked.connect(lambda: self.set_view_mode("edit"))
        view_layout.addWidget(self.btn_view_edit)

        self.btn_view_split = QPushButton("Split")
        self.btn_view_split.setFixedSize(50, 26)
        self.btn_view_split.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_view_split.setToolTip("분할 모드")
        self.btn_view_split.setObjectName("ViewToggleButton")
        self.btn_view_split.setProperty("position", "middle")
        self.btn_view_split.clicked.connect(lambda: self.set_view_mode("split"))
        view_layout.addWidget(self.btn_view_split)

        self.btn_view_preview = QPushButton("View")
        self.btn_view_preview.setFixedSize(50, 26)
        self.btn_view_preview.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_view_preview.setToolTip("미리보기 모드")
        self.btn_view_preview.setObjectName("ViewToggleButton")
        self.btn_view_preview.setProperty("position", "right")
        self.btn_view_preview.clicked.connect(lambda: self.set_view_mode("preview"))
        view_layout.addWidget(self.btn_view_preview)

        layout.addWidget(view_container)

        # --- Right: Window Controls ---
        # Container for controls to keep them grouped
        controls_layout = QHBoxLayout()
        controls_layout.setSpacing(4)

        icon, text = DesignManager.get_icon_data(DesignManager.Icons.MINIMIZE)
        self.btn_min = QPushButton(text)
        if icon:
            self.btn_min.setIcon(icon)
        self.btn_min.setFixedSize(26, 26)
        self.btn_min.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_min.setToolTip("Minimize")
        self.btn_min.clicked.connect(self.minimize_window)
        self.btn_min.setObjectName("TitleBarButton")
        controls_layout.addWidget(self.btn_min)

        icon, text = DesignManager.get_icon_data(DesignManager.Icons.MAXIMIZE)
        self.btn_max = QPushButton(text)
        if icon:
            self.btn_max.setIcon(icon)
        self.btn_max.setFixedSize(26, 26)
        self.btn_max.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_max.setToolTip("Maximize")
        self.btn_max.clicked.connect(self.toggle_max_restore)
        self.btn_max.setObjectName("TitleBarButton")
        controls_layout.addWidget(self.btn_max)

        icon, text = DesignManager.get_icon_data(DesignManager.Icons.CLOSE)
        self.btn_close = QPushButton(text)
        if icon:
            self.btn_close.setIcon(icon)
        self.btn_close.setFixedSize(26, 26)
        self.btn_close.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_close.setToolTip("Close")
        self.btn_close.clicked.connect(self.close_window)
        self.btn_close.setObjectName("TitleBarCloseButton")
        controls_layout.addWidget(self.btn_close)
        
        layout.addLayout(controls_layout)
        
        # Initial state update
        self.update_maximize_icon()

    def minimize_window(self):
        if self.main_window:
            self.main_window.showMinimized()

    def close_window(self):
        if self.main_window:
            self.main_window.close()
            
    def toggle_max_restore(self):
        if not self.main_window:
            return
            
        if self.main_window.isMaximized():
            self.main_window.showNormal()
        else:
            self.main_window.showMaximized()
        
        self.update_maximize_icon()
            
    def update_maximize_icon(self):
        if not self.main_window:
            return
            
        color = getattr(self, 'current_icon_color', "#D0D0D0")
            
        if self.main_window.isMaximized():
            icon, text = DesignManager.get_icon_data(DesignManager.Icons.RESTORE, color)
            self.btn_max.setText(text)
            if icon:
                self.btn_max.setIcon(icon)
            self.btn_max.setToolTip("Restore")
        else:
            icon, text = DesignManager.get_icon_data(DesignManager.Icons.MAXIMIZE, color)
            self.btn_max.setText(text)
            if icon:
                self.btn_max.setIcon(icon)
            self.btn_max.setToolTip("Maximize")

    def update_icons(self, color):
        """Update icons with new color"""
        self.current_icon_color = color
        
        # Sidebar
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.HAMBURGER, color)
        if icon: self.btn_sidebar.setIcon(icon)
        
        # Settings
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.SETTINGS, color)
        if icon: self.btn_settings.setIcon(icon)
        
        # Window Controls
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.MINIMIZE, color)
        if icon: self.btn_min.setIcon(icon)
        
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.CLOSE, color)
        if icon: self.btn_close.setIcon(icon)
        
        # Maximize/Restore
        self.update_maximize_icon()
            
    def set_title(self, title):
        self.title_label.setText(title)

    def set_view_mode(self, mode):
        """
        Set the view mode (edit, split, or preview)

        Args:
            mode: "edit", "split", or "preview"
        """
        # Update button states
        self.btn_view_edit.setProperty("active", mode == "edit")
        self.btn_view_split.setProperty("active", mode == "split")
        self.btn_view_preview.setProperty("active", mode == "preview")

        # Force style update
        self.btn_view_edit.style().unpolish(self.btn_view_edit)
        self.btn_view_edit.style().polish(self.btn_view_edit)
        self.btn_view_split.style().unpolish(self.btn_view_split)
        self.btn_view_split.style().polish(self.btn_view_split)
        self.btn_view_preview.style().unpolish(self.btn_view_preview)
        self.btn_view_preview.style().polish(self.btn_view_preview)

        # Call JS to update view mode in webview
        if self.main_window:
            js_code = f"""
                (function() {{
                    const editorPane = document.getElementById('editor-pane');
                    const previewPane = document.getElementById('preview-pane');
                    const resizer = document.getElementById('resizer');

                    if (!editorPane || !previewPane || !resizer) return;

                    // Reset
                    editorPane.style.display = 'flex';
                    previewPane.style.display = 'flex';
                    resizer.style.display = 'block';

                    if ('{mode}' === 'edit') {{
                        previewPane.style.display = 'none';
                        resizer.style.display = 'none';
                        editorPane.style.flex = '1';
                    }} else if ('{mode}' === 'split') {{
                        editorPane.style.flex = '1';
                        previewPane.style.flex = '1';
                    }} else if ('{mode}' === 'preview') {{
                        editorPane.style.display = 'none';
                        resizer.style.display = 'none';
                        previewPane.style.flex = '1';
                    }}
                }})();
            """
            self.main_window.run_js_in_active_tab(js_code)

    # --- Window Dragging Logic ---
    # Handled by MainWindow nativeEvent (WM_NCHITTEST) returning HTCAPTION
    # We don't need to do anything here for moving.
    # But we keep mouseDoubleClickEvent for maximize/restore.

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.toggle_max_restore()
        super().mouseDoubleClickEvent(event)
