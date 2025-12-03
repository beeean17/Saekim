"""
Toolbar component for formatting actions
"""

from PyQt6.QtWidgets import QToolBar
from PyQt6.QtGui import QAction
from PyQt6.QtCore import Qt


class ToolBar(QToolBar):
    """Toolbar with formatting buttons"""

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.setMovable(False)
        self.setFloatable(False)
        self.create_actions()

    def create_actions(self):
        """Create toolbar actions"""
        # File explorer toggle
        explorer_action = QAction("파일 탐색기", self)
        explorer_action.setCheckable(True)
        explorer_action.setChecked(True)
        explorer_action.setShortcut("F9")
        explorer_action.setStatusTip("파일 탐색기 표시/숨기기")
        explorer_action.triggered.connect(self.toggle_file_explorer)
        self.addAction(explorer_action)

        self.addSeparator()

        # Bold
        bold_action = QAction("굵게 (B)", self)
        bold_action.setShortcut("Ctrl+B")
        bold_action.setStatusTip("선택한 텍스트를 굵게")
        bold_action.triggered.connect(lambda: self.format_text('bold'))
        self.addAction(bold_action)

        # Italic
        italic_action = QAction("기울임 (I)", self)
        italic_action.setShortcut("Ctrl+I")
        italic_action.setStatusTip("선택한 텍스트를 기울임체로")
        italic_action.triggered.connect(lambda: self.format_text('italic'))
        self.addAction(italic_action)

        # Strikethrough
        strike_action = QAction("취소선 (S)", self)
        strike_action.setStatusTip("선택한 텍스트에 취소선")
        strike_action.triggered.connect(lambda: self.format_text('strikethrough'))
        self.addAction(strike_action)

        self.addSeparator()

        # Heading 1
        h1_action = QAction("H1", self)
        h1_action.setStatusTip("제목 1 (가장 큰 제목)")
        h1_action.triggered.connect(lambda: self.insert_heading(1))
        self.addAction(h1_action)

        # Heading 2
        h2_action = QAction("H2", self)
        h2_action.setStatusTip("제목 2")
        h2_action.triggered.connect(lambda: self.insert_heading(2))
        self.addAction(h2_action)

        # Heading 3
        h3_action = QAction("H3", self)
        h3_action.setStatusTip("제목 3")
        h3_action.triggered.connect(lambda: self.insert_heading(3))
        self.addAction(h3_action)

        self.addSeparator()

        # Bullet list
        bullet_action = QAction("• 목록", self)
        bullet_action.setStatusTip("글머리 기호 목록")
        bullet_action.triggered.connect(lambda: self.format_text('bulletList'))
        self.addAction(bullet_action)

        # Numbered list
        number_action = QAction("1. 목록", self)
        number_action.setStatusTip("번호 매기기 목록")
        number_action.triggered.connect(lambda: self.format_text('numberedList'))
        self.addAction(number_action)

        self.addSeparator()

        # Code
        code_action = QAction("코드 (`)", self)
        code_action.setShortcut("Ctrl+`")
        code_action.setStatusTip("인라인 코드")
        code_action.triggered.connect(lambda: self.format_text('code'))
        self.addAction(code_action)

        # Code block
        code_block_action = QAction("코드 블록", self)
        code_block_action.setStatusTip("코드 블록 삽입")
        code_block_action.triggered.connect(lambda: self.format_text('codeBlock'))
        self.addAction(code_block_action)

        # Quote
        quote_action = QAction("인용 (>)", self)
        quote_action.setStatusTip("인용문")
        quote_action.triggered.connect(lambda: self.format_text('quote'))
        self.addAction(quote_action)

        self.addSeparator()

        # Link
        link_action = QAction("링크", self)
        link_action.setShortcut("Ctrl+K")
        link_action.setStatusTip("하이퍼링크 삽입")
        link_action.triggered.connect(lambda: self.format_text('link'))
        self.addAction(link_action)

        # Image
        image_action = QAction("이미지", self)
        image_action.setStatusTip("이미지 삽입")
        image_action.triggered.connect(lambda: self.format_text('image'))
        self.addAction(image_action)

        # Table
        table_action = QAction("표", self)
        table_action.setStatusTip("표 삽입")
        table_action.triggered.connect(lambda: self.insert_table())
        self.addAction(table_action)

    def get_active_webview(self):
        """Get the active tab's webview"""
        active_tab = self.parent.tab_manager.get_active_tab()
        if not active_tab:
            return None
        return self.parent.webview_cache.get(active_tab.tab_id)

    def toggle_file_explorer(self):
        """Toggle file explorer visibility"""
        if self.parent.file_explorer.isVisible():
            self.parent.file_explorer.hide()
        else:
            self.parent.file_explorer.show()

    def format_text(self, format_type):
        """Apply formatting to selected text"""
        js_code = f"if (typeof ToolbarModule !== 'undefined') {{ ToolbarModule.{format_type}(); }}"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def insert_heading(self, level):
        """Insert heading"""
        js_code = f"if (typeof ToolbarModule !== 'undefined') {{ ToolbarModule.heading({level}); }}"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def insert_table(self):
        """Insert table"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.insertTable(3, 3); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)
