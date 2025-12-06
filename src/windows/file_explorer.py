"""
File Explorer Widget
Provides a file system tree view for navigating and opening markdown files
"""

from pathlib import Path
from PyQt6.QtWidgets import (QDockWidget, QTreeView, QWidget, QVBoxLayout,
                              QHBoxLayout, QPushButton, QToolButton, QLabel,
                              QSizePolicy, QMenu, QHeaderView)
from PyQt6.QtCore import pyqtSignal, Qt, QDir
from PyQt6.QtGui import QFileSystemModel
from utils.design_manager import DesignManager


class FileExplorer(QDockWidget):
    """File explorer dock widget with tree view and history navigation"""

    # Signal emitted when a file is double-clicked
    file_double_clicked = pyqtSignal(str)  # file_path
    
    # New signals for UI actions
    settings_requested = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__("File Explorer", parent)

        # Set dock properties
        self.setAllowedAreas(Qt.DockWidgetArea.LeftDockWidgetArea |
                            Qt.DockWidgetArea.RightDockWidgetArea)
        self.setFeatures(QDockWidget.DockWidgetFeature.DockWidgetMovable |
                        QDockWidget.DockWidgetFeature.DockWidgetClosable)

        # Set minimum width to prevent resizing below navigation buttons
        self.setMinimumWidth(100)

        # Path history for navigation
        self.path_history = []
        self.history_index = -1
        self.navigating_history = False  # Flag to prevent adding to history during navigation

        # Create main widget and layout
        main_widget = QWidget()
        layout = QVBoxLayout(main_widget)
        layout.setContentsMargins(0, 0, 0, 0)

        # --- Header Section ---
        header_widget = QWidget()
        header_layout = QVBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)
        header_layout.setSpacing(2)
        
        # 1. File Actions Row - Removed (Moved to Title Bar)
        
        # 2. Path Label

        # 2. Path Label
        self.path_label = QLabel()
        self.path_label.setWordWrap(True)
        self.path_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.path_label.setMinimumHeight(0)
        self.path_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.path_label.setContentsMargins(5, 5, 5, 0)
        header_layout.addWidget(self.path_label)
        
        layout.addWidget(header_widget)

        # Create navigation toolbar
        nav_layout = QHBoxLayout()
        nav_layout.setContentsMargins(5, 2, 5, 2)

        # Back button
        self.back_button = QToolButton()
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.BACK)
        self.back_button.setText(text)
        if icon:
            self.back_button.setIcon(icon)
        self.back_button.setToolTip("이전 경로")
        self.back_button.setEnabled(False)
        self.back_button.clicked.connect(self.go_back)
        nav_layout.addWidget(self.back_button)

        # Forward button
        self.forward_button = QToolButton()
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.FORWARD)
        self.forward_button.setText(text)
        if icon:
            self.forward_button.setIcon(icon)
        self.forward_button.setToolTip("다음 경로")
        self.forward_button.setEnabled(False)
        self.forward_button.clicked.connect(self.go_forward)
        nav_layout.addWidget(self.forward_button)

        # Up button
        self.up_button = QToolButton()
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.UP)
        self.up_button.setText(text)
        if icon:
            self.up_button.setIcon(icon)
        self.up_button.setToolTip("상위 디렉토리")
        self.up_button.clicked.connect(self.go_up)
        nav_layout.addWidget(self.up_button)

        nav_layout.addStretch()

        layout.addLayout(nav_layout)

        # Create file system model
        self.model = QFileSystemModel()
        self.model.setRootPath("")

        # Set name filters for markdown and text files
        self.model.setNameFilters(["*.md", "*.markdown", "*.txt"])
        self.model.setNameFilterDisables(False)  # Hide non-matching files

        # Create tree view
        self.tree = QTreeView()
        self.tree.setModel(self.model)

        # Configure tree view appearance
        self.tree.setAnimated(True)
        self.tree.setIndentation(20)
        self.tree.setSortingEnabled(True)
        self.tree.sortByColumn(0, Qt.SortOrder.AscendingOrder)

        # Hide size, type, and date columns - only show name
        self.tree.setColumnHidden(1, True)  # Size
        self.tree.setColumnHidden(2, True)  # Type
        self.tree.setColumnHidden(3, True)  # Date Modified

        # Set column width
        self.tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        # self.tree.setColumnWidth(0, 250) # Removed fixed width

        # Connect double-click signal
        self.tree.doubleClicked.connect(self._on_double_click)

        # Add tree to layout
        layout.addWidget(self.tree)

        # Set main widget
        self.setWidget(main_widget)

        # Set default root to user's home directory
        self.set_root_path(str(Path.home()))

    def _on_double_click(self, index):
        """
        Handle double-click on tree item

        Args:
            index: QModelIndex of clicked item
        """
        file_path = self.model.filePath(index)

        # Only emit signal for files, not directories
        if self.model.isDir(index):
            # For directories, just expand/collapse
            if self.tree.isExpanded(index):
                self.tree.collapse(index)
            else:
                self.tree.expand(index)
        else:
            # For files, emit signal to open in new tab
            self.file_double_clicked.emit(file_path)

    def set_root_path(self, path: str):
        """
        Set the root path for the file explorer

        Args:
            path: Root directory path to display
        """
        if not path:
            path = str(Path.home())

        # Convert to Path object and resolve
        root_path = Path(path)
        if root_path.is_file():
            root_path = root_path.parent

        path_str = str(root_path)

        # Add to history if not navigating and different from current
        if not self.navigating_history:
            # If we're not at the end of history, remove forward history
            if self.history_index < len(self.path_history) - 1:
                self.path_history = self.path_history[:self.history_index + 1]

            # Only add if different from current path
            if not self.path_history or self.path_history[-1] != path_str:
                self.path_history.append(path_str)
                self.history_index = len(self.path_history) - 1

            self._update_navigation_buttons()

        # Set root path in model
        root_index = self.model.setRootPath(path_str)
        self.tree.setRootIndex(root_index)

        # Update path label
        # Inject zero-width space after backslashes to allow wrapping
        display_path = path_str.replace('\\', '\\\u200b')
        self.path_label.setText(f"📁 {display_path}")

        # Update path label styling to match tree view
        # self.update_path_label_style()  # Removed in favor of global QSS

        # Expand the root - Disabled to improve startup performance
        # self.tree.expand(root_index)

    def focus_on_file(self, file_path: str):
        """
        Focus and select a specific file in the tree

        Args:
            file_path: Path to the file to focus on
        """
        if not file_path:
            return

        # Get the model index for the file
        index = self.model.index(file_path)

        if index.isValid():
            # Scroll to the file and select it
            self.tree.scrollTo(index)
            self.tree.setCurrentIndex(index)

            # Expand parent directories to make file visible
            parent = index.parent()
            while parent.isValid():
                self.tree.expand(parent)
                parent = parent.parent()

    def get_current_path(self) -> str:
        """
        Get the currently selected path in the tree

        Returns:
            Path of selected item, or empty string if none
        """
        current_index = self.tree.currentIndex()
        if current_index.isValid():
            return self.model.filePath(current_index)
        return ""

    def refresh(self):
        """Refresh the file system model"""
        current_root = self.model.rootPath()
        self.model.setRootPath("")
        self.model.setRootPath(current_root)

    def go_back(self):
        """Navigate to previous path in history"""
        if self.history_index > 0:
            self.history_index -= 1
            self.navigating_history = True
            self.set_root_path(self.path_history[self.history_index])
            self.navigating_history = False
            self._update_navigation_buttons()

    def go_forward(self):
        """Navigate to next path in history"""
        if self.history_index < len(self.path_history) - 1:
            self.history_index += 1
            self.navigating_history = True
            self.set_root_path(self.path_history[self.history_index])
            self.navigating_history = False
            self._update_navigation_buttons()

    def go_up(self):
        """Navigate to parent directory"""
        current_root = self.model.rootPath()
        if current_root:
            parent = Path(current_root).parent
            if parent != Path(current_root):  # Not already at root
                self.set_root_path(str(parent))

    def _update_navigation_buttons(self):
        """Update enabled state of navigation buttons"""
        self.back_button.setEnabled(self.history_index > 0)
        self.forward_button.setEnabled(self.history_index < len(self.path_history) - 1)

    def update_icons(self, color):
        """Update icons with new color"""
        # Header buttons - Removed
        
        # Navigation buttons
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.BACK, color)
        if icon: self.back_button.setIcon(icon)
        
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.FORWARD, color)
        if icon: self.forward_button.setIcon(icon)
        
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.UP, color)
        if icon: self.up_button.setIcon(icon)

    def set_empty_state(self):
        """Set file explorer to empty state (no root path)"""
        # Clear the tree view
        empty_index = self.model.index("")
        self.tree.setRootIndex(empty_index)

        # Update path label
        self.path_label.setText("폴더가 열리지 않음")

        # Disable navigation buttons
        self.back_button.setEnabled(False)
        self.forward_button.setEnabled(False)
        self.up_button.setEnabled(False)

    def has_root_path(self):
        """
        Check if file explorer has a valid root path

        Returns:
            bool: True if a root path is set, False otherwise
        """
        current_root = self.model.rootPath()
        return bool(current_root and current_root != "")

