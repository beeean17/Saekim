"""
Session Manager Module
Handles saving and restoring tab sessions
"""

import json
from pathlib import Path
from typing import Optional
from utils.logger import get_logger

logger = get_logger()


class SessionManager:
    """Manages editor session persistence"""

    def __init__(self, session_file: Path):
        """
        Initialize session manager

        Args:
            session_file: Path to session JSON file
        """
        self.session_file = session_file

        # Ensure session directory exists
        self.session_file.parent.mkdir(parents=True, exist_ok=True)

    def save_session(self, tab_manager) -> bool:
        """
        Save current tab session to JSON file

        Args:
            tab_manager: TabManager instance

        Returns:
            True if saved successfully
        """
        try:
            session_data = {
                "version": "1.0",
                "active_tab_id": tab_manager.active_tab_id,
                "tabs": []
            }

            # Save tab metadata (not content - that's in files)
            for tab_id in tab_manager.tab_order:
                tab = tab_manager.get_tab(tab_id)
                if tab:
                    tab_data = {
                        "tab_id": tab_id,
                        "file_path": str(tab.file_path) if tab.file_path else None,
                        "is_modified": tab.is_modified,
                        "created_at": tab.created_at.isoformat()
                    }
                    session_data["tabs"].append(tab_data)

            # Write to file
            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, indent=2)

            logger.info(f"Session saved: {len(session_data['tabs'])} tabs")
            return True

        except Exception as e:
            logger.error(f"Failed to save session: {e}")
            return False

    def load_session(self) -> Optional[dict]:
        """
        Load saved session from JSON file

        Returns:
            Session data dict or None if not found/failed
        """
        try:
            if not self.session_file.exists():
                logger.info("No session file found")
                return None

            with open(self.session_file, 'r', encoding='utf-8') as f:
                session_data = json.load(f)

            logger.info(f"Session loaded: {len(session_data.get('tabs', []))} tabs")
            return session_data

        except Exception as e:
            logger.error(f"Failed to load session: {e}")
            return None

    def clear_session(self) -> bool:
        """
        Delete session file

        Returns:
            True if deleted successfully
        """
        try:
            if self.session_file.exists():
                self.session_file.unlink()
                logger.info("Session file cleared")
            return True

        except Exception as e:
            logger.error(f"Failed to clear session: {e}")
            return False
