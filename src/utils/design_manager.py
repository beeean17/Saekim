"""
Design Manager
Centralizes management of icons and fonts for the application.
"""

from PyQt6.QtGui import QFont

class DesignManager:
    # Font Families
    FONT_FAMILY = "Pretendard, 'Segoe UI', 'Roboto', sans-serif"
    CODE_FONT_FAMILY = "'Consolas', 'Monaco', monospace"

    class Icons:
        # Window Controls
        MINIMIZE = "─"
        MAXIMIZE = "□"
        RESTORE = "❐"
        CLOSE = "✕"
        HAMBURGER = "☰"

        # File Explorer
        NEW_FILE = "+ New"
        OPEN_FOLDER = "📂"
        IMPORT_EXPORT = "⬇️"
        BACK = "←"
        FORWARD = "→"
        UP = "↑"
        SETTINGS = "⚙️"

        # Tab Bar
        # Default SVGs from QSS
        TAB_CLOSE = 'data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,4 L 12,12 M 4,12 L 12,4" stroke="%23969696" stroke-width="2" stroke-linecap="round"/></svg>'
        TAB_CLOSE_HOVER = 'data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,4 L 12,12 M 4,12 L 12,4" stroke="%23E81123" stroke-width="2" stroke-linecap="round"/></svg>'

        # Web Toolbar
        UNDO = "↩️"
        REDO = "↪️"
        BOLD = "<b>B</b>"
        ITALIC = "<i>I</i>"
        HEADING = "H1"
        LINK = "🔗"
        IMAGE = "🖼️"
        TABLE = "📋"
        CODE_BLOCK = "}"
        
        # Web Helpers
        MARKDOWN = '<span class="helper-icon">MD</span>'
        KATEX = '<span class="helper-icon">fx</span>'
        MERMAID = '<span class="helper-icon">◇</span>'
        FONT_DEC = "A-"
        FONT_INC = "A+"
        WORD_COUNT = "0 단어" # Initial text, not really an icon but part of the bar

        # Web Preview
        SYNC_SCROLL = "🔗"

    @staticmethod
    def get_font(style="body"):
        """Get QFont for specific style"""
        font = QFont()
        if style == "code":
            font.setFamily("Consolas") # Fallback to system mono
        else:
            font.setFamily("Pretendard") # Fallback to system sans
            
        if style == "header":
            font.setPointSize(12)
            font.setBold(True)
        elif style == "body":
            font.setPointSize(10)
        elif style == "small":
            font.setPointSize(9)
            
        return font

    @classmethod
    def get_icon_data(cls, icon_value):
        """
        Get icon data for PyQt widgets.
        Returns tuple (QIcon, text).
        If icon_value is a file path, returns (QIcon(path), "").
        If icon_value is text/emoji, returns (None, text).
        """
        from PyQt6.QtGui import QIcon
        from pathlib import Path
        
        # Check if it's a file path or resource
        is_file = False
        if isinstance(icon_value, str):
            lower_val = icon_value.lower()
            if lower_val.startswith(":/"):
                is_file = True
            elif lower_val.endswith(('.png', '.svg', '.jpg', '.jpeg', '.ico')):
                path = Path(icon_value)
                # Check relative to resources if not absolute
                if not path.is_absolute():
                    # Try resolving relative to src/resources/icons or just src
                    # Assuming basic relative path for now
                    if path.exists():
                        is_file = True
                    else:
                        # Try look in resources/icons
                        res_path = Path(__file__).parent.parent / 'resources' / 'icons' / icon_value
                        if res_path.exists():
                            icon_value = str(res_path)
                            is_file = True

        if is_file:
            return QIcon(icon_value), ""
        else:
            return None, icon_value

    @staticmethod
    def get_web_icons():
        """Return dictionary of icons for Web UI injection"""
        web_icons = {}
        for key, value in {
            "btn-undo": DesignManager.Icons.UNDO,
            "btn-redo": DesignManager.Icons.REDO,
            "btn-bold": DesignManager.Icons.BOLD,
            "btn-italic": DesignManager.Icons.ITALIC,
            "btn-heading": DesignManager.Icons.HEADING,
            "btn-link": DesignManager.Icons.LINK,
            "btn-insert-image": DesignManager.Icons.IMAGE,
            "btn-insert-table": DesignManager.Icons.TABLE,
            "btn-code-block": DesignManager.Icons.CODE_BLOCK,
            "btn-markdown-helper": DesignManager.Icons.MARKDOWN,
            "btn-katex-helper": DesignManager.Icons.KATEX,
            "btn-mermaid-helper": DesignManager.Icons.MERMAID,
            "btn-font-decrease": DesignManager.Icons.FONT_DEC,
            "btn-font-increase": DesignManager.Icons.FONT_INC,
            "btn-sync-scroll": DesignManager.Icons.SYNC_SCROLL
        }.items():
            # If it looks like an image, wrap in img tag
            lower_val = value.lower()
            if lower_val.endswith(('.png', '.svg', '.jpg', '.jpeg')):
                # Convert to file URI or relative path
                # For web, we need proper path handling. 
                # Assuming the JS side can handle relative paths or we convert to absolute file://
                import os
                if os.path.exists(value):
                    from pathlib import Path
                    abs_path = Path(value).resolve().as_uri()
                    web_icons[key] = f'<img src="{abs_path}" class="toolbar-icon" style="width: 16px; height: 16px;">'
                else:
                    # Try resource path
                    res_path = Path(__file__).parent.parent / 'resources' / 'icons' / value
                    if res_path.exists():
                         abs_path = res_path.resolve().as_uri()
                         web_icons[key] = f'<img src="{abs_path}" class="toolbar-icon" style="width: 16px; height: 16px;">'
                    else:
                        web_icons[key] = value # Fallback
            else:
                web_icons[key] = value
                
        return web_icons
