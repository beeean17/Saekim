"""
Design Manager
Centralizes management of icons and fonts for the application.
"""

from PyQt6.QtGui import QFont

class DesignManager:
    # Font Families
    FONT_FAMILY = "Pretendard, 'Segoe UI', 'Roboto', sans-serif"
    CODE_FONT_FAMILY = "'Consolas', 'Monaco', monospace"
    
    # App Icon
    APP_ICON = "app_icon.png"

    class Icons:
        # Window Controls (Minimalist Line Style)
        # Stroke width 1.5, rounded caps/joins
        # {color} placeholder will be replaced by ThemeManager
        MINIMIZE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="8" x2="12" y2="8" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        MAXIMIZE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="8" height="8" rx="1" stroke="{color}" stroke-width="1.5" fill="none"/></svg>'
        RESTORE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="7" height="7" rx="1" stroke="{color}" stroke-width="1.5" fill="none"/><path d="M 6,6 L 6,5 A 1,1 0 0 1 7,4 L 11,4 A 1,1 0 0 1 12,5 L 12,6" stroke="{color}" stroke-width="1.5" fill="none"/><path d="M 12,6 L 13,6 A 1,1 0 0 1 14,7 L 14,11 A 1,1 0 0 1 13,12 L 12,12" stroke="{color}" stroke-width="1.5" fill="none"/></svg>'
        CLOSE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,4 L 12,12 M 4,12 L 12,4" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        HAMBURGER = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="5" x2="13" y2="5" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="11" x2="13" y2="11" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'

        # File Explorer
        NEW_FILE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 9,2 L 11,4 L 11,13 A 1,1 0 0 1 10,14 L 4,14 A 1,1 0 0 1 3,13 L 3,3 A 1,1 0 0 1 4,2 Z" stroke="{color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="8" x2="9" y2="8" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        OPEN_FOLDER = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 2,4 A 1,1 0 0 1 3,3 L 6,3 L 7,4 L 13,4 A 1,1 0 0 1 14,5 L 14,12 A 1,1 0 0 1 13,13 L 3,13 A 1,1 0 0 1 2,12 Z" stroke="{color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>'
        OPEN_FILE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 3,3 L 3,13 A 1,1 0 0 0 4,14 L 12,14 A 1,1 0 0 0 13,13 L 13,5 L 11,3 Z" stroke="{color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M 11,3 L 11,5 L 13,5" stroke="{color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M 8,10 L 8,7 M 6,8 L 8,6 L 10,8" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        IMPORT = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 8,2 L 8,10 M 5,7 L 8,10 L 11,7 M 4,13 L 12,13" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        EXPORT = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 8,10 L 8,2 M 5,5 L 8,2 L 11,5 M 4,13 L 12,13" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        IMPORT_EXPORT = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 8,3 L 8,13 M 5,10 L 8,13 L 11,10" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        BACK = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 10,4 L 6,8 L 10,12" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
        FORWARD = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 6,4 L 10,8 L 6,12" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
        UP = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,10 L 8,6 L 12,10" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
        SETTINGS = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="3" stroke="{color}" stroke-width="1.5" fill="none"/><path d="M 8,2 L 8,3 M 8,13 L 8,14 M 14,8 L 13,8 M 3,8 L 2,8 M 12.2,3.8 L 11.5,4.5 M 4.5,11.5 L 3.8,12.2 M 12.2,12.2 L 11.5,11.5 M 4.5,4.5 L 3.8,3.8" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'

        # Tab Bar
        # Minimalist Line Style
        TAB_CLOSE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,4 L 12,12 M 4,12 L 12,4" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        TAB_CLOSE_HOVER = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,4 L 12,12 M 4,12 L 12,4" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'

        # Web Toolbar
        UNDO = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 5,8 A 4,4 0 0 1 9,4 A 4,4 0 0 1 13,8" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M 5,4 L 5,8 L 9,8" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        REDO = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 11,8 A 4,4 0 0 0 7,4 A 4,4 0 0 0 3,8" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M 11,4 L 11,8 L 7,8" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        BOLD = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,3 L 8,3 A 3,3 0 0 1 8,9 L 4,9 Z M 4,9 L 9,9 A 3,3 0 0 1 9,15 L 4,15 Z" stroke="{color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>'
        ITALIC = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="7" y1="3" x2="11" y2="3" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="13" x2="9" y2="13" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="3" x2="7" y2="13" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        HEADING = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 4,3 L 4,13 M 12,3 L 12,13 M 4,8 L 12,8" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        LINK = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 8,4 L 11,4 A 3,3 0 0 1 11,10 L 8,10 M 8,12 L 5,12 A 3,3 0 0 1 5,6 L 8,6" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
        IMAGE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="12" height="10" rx="1" stroke="{color}" stroke-width="1.5" fill="none"/><circle cx="5.5" cy="6.5" r="1.5" stroke="{color}" stroke-width="1.5" fill="none"/><path d="M 14,11 L 11,8 L 8,11 L 6,9 L 2,13" stroke="{color}" stroke-width="1.5" fill="none" stroke-linejoin="round"/></svg>'
        TABLE = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="12" height="10" rx="1" stroke="{color}" stroke-width="1.5" fill="none"/><line x1="2" y1="7" x2="14" y2="7" stroke="{color}" stroke-width="1.5"/><line x1="8" y1="3" x2="8" y2="13" stroke="{color}" stroke-width="1.5"/></svg>'
        CODE_BLOCK = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><polyline points="5 4 2 8 5 12" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><polyline points="11 4 14 8 11 12" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="3" x2="7" y2="13" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        
        # Web Helpers
        MARKDOWN = '<span class="helper-icon">MD</span>'
        KATEX = '<span class="helper-icon">fx</span>'
        MERMAID = '<span class="helper-icon">◇</span>'
        FONT_DEC = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 8,3 L 3,13 M 8,3 L 13,13 M 5,9 L 11,9" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="3" x2="14" y2="3" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        FONT_INC = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M 7,3 L 2,13 M 7,3 L 12,13 M 4,9 L 10,9" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="11" y1="5" x2="15" y2="5" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="3" x2="13" y2="7" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/></svg>'
        WORD_COUNT = "0 단어" # Initial text, not really an icon but part of the bar

        # Web Preview
        SYNC_SCROLL = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7" width="6" height="5" rx="1" stroke="{color}" stroke-width="1.5" fill="none"/><path d="M 5,7 L 5,5 A 3,3 0 0 1 11,5 L 11,7" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'

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
    def get_icon_data(cls, icon_value, color="#D0D0D0"):
        """
        Get icon data for PyQt widgets.
        Returns tuple (QIcon, text).
        If icon_value is a file path, returns (QIcon(path), "").
        If icon_value is text/emoji, returns (None, text).
        """
        from PyQt6.QtGui import QIcon, QPixmap
        from PyQt6.QtCore import QByteArray
        from pathlib import Path
        
        # Check if it's a file path or resource or raw SVG
        is_file = False
        is_svg_xml = False
        
        if isinstance(icon_value, str):
            lower_val = icon_value.lower()
            if lower_val.strip().startswith("<svg"):
                is_svg_xml = True
            elif lower_val.startswith(":/"):
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

        if is_svg_xml:
            # Replace color placeholder
            icon_value = icon_value.replace("{color}", color)
            # Load raw SVG XML
            pixmap = QPixmap()
            pixmap.loadFromData(QByteArray(icon_value.encode('utf-8')), "SVG")
            return QIcon(pixmap), ""
            
        elif is_file:
            return QIcon(icon_value), ""
        else:
            return None, icon_value

    @staticmethod
    def get_web_icons(color="#D0D0D0"):
        """Return dictionary of icons for Web UI injection"""
        from pathlib import Path
        import os
        import base64

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
            # If it looks like an image or SVG XML, wrap in img tag
            lower_val = value.lower()
            if lower_val.strip().startswith('<svg'):
                # Replace color placeholder
                value = value.replace("{color}", color)
                # Encode SVG XML to Base64 data URI
                b64 = base64.b64encode(value.encode('utf-8')).decode('ascii')
                data_uri = f"data:image/svg+xml;base64,{b64}"
                web_icons[key] = f'<img src="{data_uri}" class="toolbar-icon" style="width: 16px; height: 16px;">'
            elif lower_val.endswith(('.png', '.svg', '.jpg', '.jpeg')):
                # Convert to file URI or relative path
                if os.path.exists(value):
                    abs_path = Path(value).resolve().as_uri()
                    web_icons[key] = f'<img src="{abs_path}" class="toolbar-icon" style="width: 16px; height: 16px;">'
                else:
                    # Try resource path
                    # res_path = Path(__file__).parent.parent / 'resources' / 'icons' / value
                    # if res_path.exists():
                    #      abs_path = res_path.resolve().as_uri()
                    #      web_icons[key] = f'<img src="{abs_path}" class="toolbar-icon" style="width: 16px; height: 16px;">'
                    # else:
                    web_icons[key] = value # Fallback
            else:
                web_icons[key] = value
                
        return web_icons
