import json
from pathlib import Path
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QFile, QTextStream

class ThemeManager:
    """Manages application themes (QSS and CSS)"""

    THEMES = {
        'nord': {
            'name': 'Nord',
            'qss': 'nord.qss',
            'css': 'nord.css',
            'is_dark': True
        },
        'catppuccin': {
            'name': 'Catppuccin Mocha',
            'qss': 'catppuccin.qss',
            'css': 'catppuccin.css',
            'is_dark': True
        },
        'paper': {
            'name': 'White',
            'qss': 'paper.qss',
            'css': 'paper.css',
            'is_dark': False
        },
        'github_primer': {
            'name': 'Black',
            'qss': 'github_primer.qss',
            'css': 'github_primer.css',
            'is_dark': True
        },
        'dark': {
            'name': 'Dark',
            'qss': 'dark.qss',
            'css': 'dark.css',
            'is_dark': True
        }
    }

    def __init__(self, session_file: Path):
        self.session_file = session_file
        self.current_theme = 'nord' # Default to Nord
        self._load_preference()

    def _load_preference(self):
        """Load theme preference from session file"""
        if self.session_file.exists():
            try:
                with open(self.session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.current_theme = data.get('theme', 'nord')
            except Exception as e:
                print(f"[WARN] Failed to load theme preference: {e}")

    def save_preference(self):
        """Save theme preference to session file"""
        try:
            data = {}
            if self.session_file.exists():
                with open(self.session_file, 'r', encoding='utf-8') as f:
                    try:
                        data = json.load(f)
                    except json.JSONDecodeError:
                        pass # Start fresh if corrupt
            
            data['theme'] = self.current_theme
            
            # Ensure directory exists
            self.session_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.session_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
                print(f"[OK] Saved theme preference: {self.current_theme}")
        except Exception as e:
            print(f"[ERROR] Failed to save theme preference: {e}")

    def apply_theme(self, theme_name: str):
        """Apply the selected theme"""
        if theme_name not in self.THEMES:
            print(f"[WARN] Unknown theme: {theme_name}")
            return

        self.current_theme = theme_name
        theme_data = self.THEMES[theme_name]

        # Apply QSS
        if theme_data['qss']:
            qss_path = Path(__file__).parent.parent / 'resources' / 'themes' / theme_data['qss']
            if qss_path.exists():
                file = QFile(str(qss_path))
                if file.open(QFile.OpenModeFlag.ReadOnly | QFile.OpenModeFlag.Text):
                    stream = QTextStream(file)
                    qss_content = stream.readAll()
                    file.close()
                    
                    # Inject dynamic icons from DesignManager
                    from utils.design_manager import DesignManager
                    import re
                    
                    def format_icon_url(icon_value):
                        if icon_value.startswith("data:") or icon_value.startswith(":/"):
                            return f"url({icon_value})"
                        elif icon_value.startswith("url("):
                            return icon_value
                        else:
                            # Verify file existence and convert to absolute path
                            import os
                            if os.path.exists(icon_value):
                                from pathlib import Path
                                abs_path = Path(icon_value).resolve().as_uri()
                                return f"url({abs_path})"
                            # Try resource path
                            res_path = Path(__file__).parent.parent / 'resources' / 'icons' / icon_value
                            if res_path.exists():
                                 abs_path = res_path.resolve().as_uri()
                                 return f"url({abs_path})"
                            return f"url({icon_value})"

                    # Safer Regex Approach for Close Button
                    # 1. Normal State
                    close_url = format_icon_url(DesignManager.Icons.TAB_CLOSE)
                    # 1. Normal State
                    qss_content = re.sub(
                        r'(QTabBar::close-button\s*\{[^}]*image:\s*)url\([^)]+\)([^}]*\})',
                        f'\\1{close_url}\\2',
                        qss_content
                    )
                    
                    # 2. Hover State
                    # We need to target the close-button:hover selector specifically
                    close_hover_url = format_icon_url(DesignManager.Icons.TAB_CLOSE_HOVER)
                    qss_content = re.sub(
                        r'(QTabBar::close-button:hover\s*\{[^}]*image:\s*)url\([^)]+\)([^}]*\})',
                        f'\\1{close_hover_url}\\2',
                        qss_content
                    )

                    QApplication.instance().setStyleSheet(qss_content)
                    print(f"[OK] Applied QSS for theme: {theme_name} with dynamic icons")
            else:
                print(f"[WARN] QSS file not found: {qss_path}")
        else:
            # Reset to default style
            QApplication.instance().setStyleSheet("")
            print(f"[OK] Reset to default style for theme: {theme_name}")

        return theme_data

    def get_current_theme_data(self):
        return self.THEMES.get(self.current_theme, self.THEMES['catppuccin'])
