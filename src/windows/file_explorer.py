"""
File Explorer Widget
Provides a file system tree view for navigating and opening markdown files
"""

from pathlib import Path
from PyQt6.QtWidgets import (QDockWidget, QTreeView, QWidget, QVBoxLayout,
                              QHBoxLayout, QToolButton, QLabel,
                              QSizePolicy, QHeaderView, QStyledItemDelegate,
                              QMenu)
from PyQt6.QtCore import pyqtSignal, Qt, QDateTime, QRect
from PyQt6.QtGui import QFileSystemModel, QColor, QFont, QPen
from utils.design_manager import DesignManager


def format_relative_time(qdatetime: QDateTime) -> str:
    """Return compact relative modified time for the file tree."""
    if not qdatetime.isValid():
        return ""

    seconds = max(0, qdatetime.secsTo(QDateTime.currentDateTime()))
    if seconds < 60:
        return "now"
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    if seconds < 604800:
        return f"{seconds // 86400}d"
    if seconds < 2592000:
        return f"{seconds // 604800}w"
    return qdatetime.toString("yy.MM")


class FileTreeItemDelegate(QStyledItemDelegate):
    """Draw dirty marker and file modified metadata."""

    def __init__(self, model: QFileSystemModel, parent=None):
        super().__init__(parent)
        self.model = model
        self.current_file_path = ""
        self.dirty_files = set()
        self.meta_color = QColor(106, 119, 135)
        self.warning_color = QColor(251, 191, 36)

    def set_current_file(self, file_path: str):
        self.current_file_path = str(file_path or "")

    def set_dirty_files(self, dirty_files: set[str]):
        self.dirty_files = {str(path) for path in dirty_files if path}

    def paint(self, painter, option, index):
        super().paint(painter, option, index)

        if index.column() != 0:
            return

        file_path = self.model.filePath(index)
        if not file_path:
            return

        rect = option.rect
        normalized_path = str(Path(file_path).resolve())
        is_dirty = normalized_path in self.dirty_files

        painter.save()
        if not self.model.isDir(index):
            meta = format_relative_time(self.model.lastModified(index))
            if meta:
                painter.setPen(QPen(self.meta_color))
                meta_font = QFont(option.font)
                meta_font.setPointSize(max(8, meta_font.pointSize() - 1))
                painter.setFont(meta_font)
                meta_rect = QRect(rect.right() - 50, rect.top(), 46, rect.height())
                painter.drawText(meta_rect, Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter, meta)

        if is_dirty:
            painter.setPen(QPen(self.warning_color))
            dirty_rect = QRect(rect.right() - 66, rect.top(), 12, rect.height())
            painter.drawText(dirty_rect, Qt.AlignmentFlag.AlignCenter, "●")

        painter.restore()


class FileExplorer(QDockWidget):
    """File explorer dock widget with tree view and history navigation"""

    # Signal emitted when a file is double-clicked
    file_double_clicked = pyqtSignal(str)  # file_path
    
    # Signals for drag & drop
    file_dropped = pyqtSignal(str)  # file_path for .md/.txt files
    pdf_dropped = pyqtSignal(str)   # file_path for .pdf files
    
    # New signals for UI actions
    settings_requested = pyqtSignal()
    new_file_requested = pyqtSignal()
    new_folder_requested = pyqtSignal()
    refresh_requested = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__("File Explorer", parent)

        # Set dock properties
        self.setAllowedAreas(Qt.DockWidgetArea.LeftDockWidgetArea |
                            Qt.DockWidgetArea.RightDockWidgetArea)
        self.setFeatures(QDockWidget.DockWidgetFeature.NoDockWidgetFeatures)
        empty_title_bar = QWidget()
        empty_title_bar.setFixedHeight(0)
        self.setTitleBarWidget(empty_title_bar)

        # Set minimum width to prevent resizing below navigation buttons
        self.setMinimumWidth(240)

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
        header_widget.setObjectName("ExplorerHeader")
        header_layout = QVBoxLayout(header_widget)
        header_layout.setContentsMargins(10, 8, 10, 6)
        header_layout.setSpacing(6)

        explorer_row = QHBoxLayout()
        explorer_row.setContentsMargins(0, 0, 0, 0)
        explorer_row.setSpacing(4)

        explorer_label = QLabel("EXPLORER")
        explorer_label.setObjectName("ExplorerTitle")
        explorer_label.setFont(DesignManager.get_font("small"))
        explorer_row.addWidget(explorer_label)
        explorer_row.addStretch()

        self.new_file_button = self._create_header_button(DesignManager.Icons.NEW_FILE, "새 파일")
        self.new_file_button.clicked.connect(self.new_file_requested.emit)
        explorer_row.addWidget(self.new_file_button)

        self.new_folder_button = self._create_header_button(DesignManager.Icons.NEW_FOLDER, "새 폴더")
        self.new_folder_button.clicked.connect(self.new_folder_requested.emit)
        explorer_row.addWidget(self.new_folder_button)

        self.refresh_button = self._create_header_button(DesignManager.Icons.REFRESH, "새로고침")
        self.refresh_button.clicked.connect(self.refresh_requested.emit)
        explorer_row.addWidget(self.refresh_button)

        header_layout.addLayout(explorer_row)

        # Path label is placed in the navigation row to match the mockup path bar.
        self.path_label = QLabel()
        self.path_label.setFont(DesignManager.get_font("small"))
        self.path_label.setWordWrap(False)
        self.path_label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.path_label.setMinimumHeight(0)
        self.path_label.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.path_label.setObjectName("ExplorerPath")
        self.path_label.setContentsMargins(0, 0, 0, 0)
        
        layout.addWidget(header_widget)

        # Create path bar with navigation toolbar
        path_bar_widget = QWidget()
        path_bar_widget.setObjectName("ExplorerPathBar")
        nav_layout = QHBoxLayout(path_bar_widget)
        nav_layout.setContentsMargins(16, 8, 16, 12)
        nav_layout.setSpacing(2)

        # Back button
        self.back_button = QToolButton()
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.BACK)
        self.back_button.setText(text)
        if icon:
            self.back_button.setIcon(icon)
        self.back_button.setToolTip("이전 경로")
        self.back_button.setEnabled(False)
        self.back_button.setFixedSize(20, 20)
        self.back_button.setAutoRaise(True)
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
        self.forward_button.setFixedSize(20, 20)
        self.forward_button.setAutoRaise(True)
        self.forward_button.clicked.connect(self.go_forward)
        nav_layout.addWidget(self.forward_button)

        # Up button
        self.up_button = QToolButton()
        icon, text = DesignManager.get_icon_data(DesignManager.Icons.UP)
        self.up_button.setText(text)
        if icon:
            self.up_button.setIcon(icon)
        self.up_button.setToolTip("상위 디렉토리")
        self.up_button.setFixedSize(20, 20)
        self.up_button.setAutoRaise(True)
        self.up_button.clicked.connect(self.go_up)
        nav_layout.addWidget(self.up_button)

        nav_layout.addSpacing(6)
        nav_layout.addWidget(self.path_label, 1)

        layout.addWidget(path_bar_widget)

        sort_bar_widget = QWidget()
        sort_bar_widget.setObjectName("ExplorerSortBar")
        sort_layout = QHBoxLayout(sort_bar_widget)
        sort_layout.setContentsMargins(8, 0, 8, 0)
        sort_layout.setSpacing(0)
        sort_layout.addStretch()

        self.sort_button = QToolButton()
        self.sort_button.setObjectName("ExplorerSortButton")
        self.sort_button.setText("↕")
        self.sort_button.setToolTip("정렬")
        self.sort_button.setFixedSize(24, 24)
        self.sort_button.setAutoRaise(True)
        self.sort_menu = QMenu(self.sort_button)
        self.sort_menu.addAction("Name", lambda: self.sort_by("name"))
        self.sort_menu.addAction("Date", lambda: self.sort_by("date"))
        self.sort_button.setMenu(self.sort_menu)
        self.sort_button.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        sort_layout.addWidget(self.sort_button)

        layout.addWidget(sort_bar_widget)

        # Create file system model
        self.model = QFileSystemModel()
        self.model.setRootPath("")

        # Set name filters for markdown and text files
        self.model.setNameFilters(["*.md", "*.markdown", "*.txt"])
        self.model.setNameFilterDisables(False)  # Hide non-matching files

        # Create tree view
        self.tree = QTreeView()
        self.tree.setModel(self.model)
        self.item_delegate = FileTreeItemDelegate(self.model, self.tree)
        self.tree.setItemDelegate(self.item_delegate)

        # Set Pretendard font for Korean file names
        self.tree.setFont(DesignManager.get_font("body"))

        # Configure tree view appearance
        self.tree.setAnimated(True)
        self.tree.setIndentation(0)
        self.tree.setRootIsDecorated(False)
        self.tree.setSortingEnabled(True)
        self.tree.sortByColumn(0, Qt.SortOrder.AscendingOrder)

        # Hide size, type, and date columns - only show name
        self.tree.setColumnHidden(1, True)  # Size
        self.tree.setColumnHidden(2, True)  # Type
        self.tree.setColumnHidden(3, True)  # Date Modified

        # Set column width
        self.tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.tree.header().hide()
        # self.tree.setColumnWidth(0, 250) # Removed fixed width

        # Connect double-click signal
        self.tree.doubleClicked.connect(self._on_double_click)

        # Add tree to layout
        layout.addWidget(self.tree)

        # Set main widget
        self.setWidget(main_widget)
        
        # Enable drag & drop on file explorer
        self.setAcceptDrops(True)

        # Set default root to user's home directory
        self.set_root_path(str(Path.home()))

    def _create_header_button(self, icon_value, tooltip: str) -> QToolButton:
        button = QToolButton()
        button.setObjectName("ExplorerActionButton")
        icon, text = DesignManager.get_icon_data(icon_value)
        button.setText(text)
        if icon:
            button.setIcon(icon)
        button.setToolTip(tooltip)
        button.setFixedSize(24, 24)
        button.setAutoRaise(True)
        return button

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
        self.path_label.setText(display_path)

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

            self.item_delegate.set_current_file(str(Path(file_path).resolve()))
            self.tree.viewport().update()

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
        self.tree.viewport().update()

    def sort_by(self, field: str):
        """Sort the tree by file name or modified date."""
        if field == "date":
            self.tree.sortByColumn(3, Qt.SortOrder.DescendingOrder)
        else:
            self.tree.sortByColumn(0, Qt.SortOrder.AscendingOrder)

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
        for button, icon_value in (
            (self.new_file_button, DesignManager.Icons.NEW_FILE),
            (self.new_folder_button, DesignManager.Icons.NEW_FOLDER),
            (self.refresh_button, DesignManager.Icons.REFRESH),
        ):
            icon, _ = DesignManager.get_icon_data(icon_value, color)
            if icon:
                button.setIcon(icon)
        
        # Navigation buttons
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.BACK, color)
        if icon: self.back_button.setIcon(icon)
        
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.FORWARD, color)
        if icon: self.forward_button.setIcon(icon)
        
        icon, _ = DesignManager.get_icon_data(DesignManager.Icons.UP, color)
        if icon: self.up_button.setIcon(icon)

    def set_dirty_files(self, dirty_files: set[str]):
        """Update file paths with unsaved changes."""
        self.item_delegate.set_dirty_files(dirty_files)
        self.tree.viewport().update()

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

    # ==================== Drag & Drop Handlers ====================
    
    def _create_drag_overlay(self):
        """Create overlay for drag visual feedback (same style as MainWindow)"""
        if hasattr(self, '_drag_overlay') and self._drag_overlay:
            return self._drag_overlay
        
        from PyQt6.QtWidgets import QFrame
        self._drag_overlay = QFrame(self)
        self._drag_overlay.setObjectName("DragOverlay")
        self._drag_overlay.setStyleSheet("""
            QFrame#DragOverlay {
                background-color: rgba(136, 192, 208, 0.15);
                border: 4px dashed #88C0D0;
                border-radius: 0px;
            }
        """)
        self._drag_overlay.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents, True)
        self._drag_overlay.hide()
        return self._drag_overlay
    
    def _show_drag_overlay(self):
        """Show drag overlay over file explorer"""
        overlay = self._create_drag_overlay()
        # Cover entire dock widget
        overlay.setGeometry(0, 0, self.width(), self.height())
        overlay.raise_()
        overlay.show()
    
    def _hide_drag_overlay(self):
        """Hide drag overlay"""
        if hasattr(self, '_drag_overlay') and self._drag_overlay:
            self._drag_overlay.hide()
    
    def dragEnterEvent(self, event):
        """Accept drag events for supported file types"""
        if event.mimeData().hasUrls():
            for url in event.mimeData().urls():
                file_path = url.toLocalFile().lower()
                if file_path.endswith(('.md', '.markdown', '.txt', '.pdf')):
                    event.acceptProposedAction()
                    self._show_drag_overlay()
                    return
        event.ignore()
    
    def dragMoveEvent(self, event):
        """Keep accepting while over widget"""
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            event.ignore()
    
    def dragLeaveEvent(self, event):
        """Handle drag leave"""
        self._hide_drag_overlay()
        event.accept()
    
    def dropEvent(self, event):
        """Handle file drop - emit appropriate signal"""
        self._hide_drag_overlay()
        
        if event.mimeData().hasUrls():
            for url in event.mimeData().urls():
                file_path = url.toLocalFile()
                lower_path = file_path.lower()
                
                if lower_path.endswith(('.md', '.markdown', '.txt')):
                    self.file_dropped.emit(file_path)
                    print(f"[OK] File Explorer: dropped {file_path}")
                    
                elif lower_path.endswith('.pdf'):
                    self.pdf_dropped.emit(file_path)
                    print(f"[OK] File Explorer: dropped PDF {file_path}")
                    
        event.acceptProposedAction()
