"""
Custom Title Bar Widget
"""

from PyQt6.QtWidgets import QWidget, QHBoxLayout, QLabel, QPushButton, QFrame
from PyQt6.QtCore import Qt, pyqtSignal

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
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.setFixedHeight(32) # Compact title bar height
        self.setObjectName("TitleBar")

        # Main layout
        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 0, 8, 0)
        layout.setSpacing(8)
        
        # --- Left: Navigation ---
        self.btn_sidebar = QPushButton("☰")
        self.btn_sidebar.setFixedSize(26, 26)
        self.btn_sidebar.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_sidebar.setToolTip("Toggle Sidebar")
        self.btn_sidebar.clicked.connect(self.toggle_sidebar.emit)
        self.btn_sidebar.setObjectName("TitleBarButton")
        layout.addWidget(self.btn_sidebar)

        # --- Center: Title ---
        self.title_label = QLabel("Saekim")
        self.title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.title_label.setObjectName("TitleLabel")
        # Make title hit-test transparent for dragging if needed,
        # but we handle dragging in mousePressEvent of the TitleBar itself
        layout.addWidget(self.title_label, 1) # 1 = stretch

        # --- Right: Window Controls ---
        # Container for controls to keep them grouped
        controls_layout = QHBoxLayout()
        controls_layout.setSpacing(4)

        self.btn_min = QPushButton("─")
        self.btn_min.setFixedSize(26, 26)
        self.btn_min.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_min.setToolTip("Minimize")
        self.btn_min.clicked.connect(self.minimize_window)
        self.btn_min.setObjectName("TitleBarButton")
        controls_layout.addWidget(self.btn_min)

        self.btn_max = QPushButton("□")
        self.btn_max.setFixedSize(26, 26)
        self.btn_max.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_max.setToolTip("Maximize")
        self.btn_max.clicked.connect(self.toggle_max_restore)
        self.btn_max.setObjectName("TitleBarButton")
        controls_layout.addWidget(self.btn_max)

        self.btn_close = QPushButton("✕")
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
        if self.parent:
            self.parent.showMinimized()

    def close_window(self):
        if self.parent:
            self.parent.close()
            
    def toggle_max_restore(self):
        if not self.parent:
            return
            
        if self.parent.isMaximized():
            self.parent.showNormal()
        else:
            self.parent.showMaximized()
        
        self.update_maximize_icon()
            
    def update_maximize_icon(self):
        if not self.parent:
            return
            
        if self.parent.isMaximized():
            self.btn_max.setText("❐") # Restore icon
            self.btn_max.setToolTip("Restore")
        else:
            self.btn_max.setText("□") # Maximize icon
            self.btn_max.setToolTip("Maximize")
            
    def set_title(self, title):
        self.title_label.setText(title)

    # --- Window Dragging Logic ---
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            if self.parent:
                # Use windowHandle().startSystemMove() for native-like moving
                # This works well on Windows 10/11
                self.parent.windowHandle().startSystemMove()
        super().mousePressEvent(event)
            
    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.toggle_max_restore()
        super().mouseDoubleClickEvent(event)
