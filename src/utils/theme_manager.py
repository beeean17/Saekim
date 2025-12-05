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
                    QApplication.instance().setStyleSheet(stream.readAll())
                    file.close()
                    print(f"[OK] Applied QSS for theme: {theme_name}")
            else:
                print(f"[WARN] QSS file not found: {qss_path}")
        else:
            # Reset to default style
            QApplication.instance().setStyleSheet("")
            print(f"[OK] Reset to default style for theme: {theme_name}")

        return theme_data

    def get_current_theme_data(self):
        return self.THEMES.get(self.current_theme, self.THEMES['catppuccin'])
