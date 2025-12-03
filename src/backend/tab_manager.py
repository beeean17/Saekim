"""
Tab Manager Module
Manages tab state, file associations, and content caching for the editor
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class TabInfo:
    """Information about a single tab"""
    tab_id: str
    file_path: Optional[Path]
    content: str
    is_modified: bool
    scroll_position: int = 0
    cursor_position: Tuple[int, int] = (0, 0)
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)

    def get_display_name(self) -> str:
        """Get display name for tab title"""
        if self.file_path:
            return self.file_path.name
        return "Untitled"


class TabManager:
    """Manages multiple editor tabs and their state"""

    def __init__(self):
        self.tabs: Dict[str, TabInfo] = {}
        self.active_tab_id: Optional[str] = None
        self.tab_order: List[str] = []  # Maintain tab order

    def create_tab(self, file_path: Optional[str] = None, content: str = "") -> str:
        """
        Create a new tab

        Args:
            file_path: Optional file path for the tab
            content: Initial content for the tab

        Returns:
            Tab ID (UUID string)
        """
        tab_id = str(uuid.uuid4())

        # Convert file_path to Path if provided
        path = Path(file_path) if file_path else None

        tab_info = TabInfo(
            tab_id=tab_id,
            file_path=path,
            content=content,
            is_modified=False
        )

        self.tabs[tab_id] = tab_info
        self.tab_order.append(tab_id)
        self.active_tab_id = tab_id

        return tab_id

    def close_tab(self, tab_id: str) -> bool:
        """
        Close a tab

        Args:
            tab_id: ID of tab to close

        Returns:
            True if closed successfully
        """
        if tab_id not in self.tabs:
            return False

        del self.tabs[tab_id]

        if tab_id in self.tab_order:
            self.tab_order.remove(tab_id)

        # If closing active tab, switch to next tab
        if self.active_tab_id == tab_id:
            if self.tab_order:
                self.active_tab_id = self.tab_order[0]
            else:
                self.active_tab_id = None

        return True

    def get_tab(self, tab_id: str) -> Optional[TabInfo]:
        """
        Get tab info by ID

        Args:
            tab_id: Tab ID

        Returns:
            TabInfo or None if not found
        """
        return self.tabs.get(tab_id)

    def get_active_tab(self) -> Optional[TabInfo]:
        """
        Get currently active tab

        Returns:
            Active TabInfo or None
        """
        if self.active_tab_id:
            return self.tabs.get(self.active_tab_id)
        return None

    def switch_tab(self, tab_id: str):
        """
        Switch to a different tab

        Args:
            tab_id: ID of tab to switch to
        """
        if tab_id in self.tabs:
            self.active_tab_id = tab_id
            self.tabs[tab_id].last_accessed = datetime.now()

    def update_tab_content(self, tab_id: str, content: str):
        """
        Update tab content

        Args:
            tab_id: Tab ID
            content: New content
        """
        if tab_id in self.tabs:
            self.tabs[tab_id].content = content

    def update_tab_modified(self, tab_id: str, is_modified: bool):
        """
        Update tab modified state

        Args:
            tab_id: Tab ID
            is_modified: Modified state
        """
        if tab_id in self.tabs:
            self.tabs[tab_id].is_modified = is_modified

    def update_tab_scroll(self, tab_id: str, scroll_position: int):
        """
        Update tab scroll position

        Args:
            tab_id: Tab ID
            scroll_position: Scroll position in pixels
        """
        if tab_id in self.tabs:
            self.tabs[tab_id].scroll_position = scroll_position

    def update_tab_cursor(self, tab_id: str, line: int, column: int):
        """
        Update tab cursor position

        Args:
            tab_id: Tab ID
            line: Line number
            column: Column number
        """
        if tab_id in self.tabs:
            self.tabs[tab_id].cursor_position = (line, column)

    def find_tab_by_path(self, file_path: str) -> Optional[str]:
        """
        Find tab by file path (to prevent opening same file twice)

        Args:
            file_path: File path to search for

        Returns:
            Tab ID if found, None otherwise
        """
        search_path = Path(file_path).resolve()

        for tab_id, tab_info in self.tabs.items():
            if tab_info.file_path:
                if tab_info.file_path.resolve() == search_path:
                    return tab_id

        return None

    def get_modified_tabs(self) -> List[TabInfo]:
        """
        Get all tabs with unsaved changes

        Returns:
            List of TabInfo for modified tabs
        """
        return [tab for tab in self.tabs.values() if tab.is_modified]

    def get_least_recently_used(self) -> Optional[str]:
        """
        Get least recently used tab (for LRU cache eviction)

        Returns:
            Tab ID of LRU tab (excluding active tab), or None
        """
        # Don't evict active tab
        candidate_tabs = [
            (tab_id, tab.last_accessed)
            for tab_id, tab in self.tabs.items()
            if tab_id != self.active_tab_id
        ]

        if not candidate_tabs:
            return None

        # Sort by last_accessed (oldest first)
        candidate_tabs.sort(key=lambda x: x[1])

        return candidate_tabs[0][0]

    def get_tab_count(self) -> int:
        """Get total number of tabs"""
        return len(self.tabs)

    def update_tab_file_path(self, tab_id: str, file_path: str):
        """
        Update tab file path (used after Save As)

        Args:
            tab_id: Tab ID
            file_path: New file path
        """
        if tab_id in self.tabs:
            self.tabs[tab_id].file_path = Path(file_path)
