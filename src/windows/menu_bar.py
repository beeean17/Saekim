"""
Menu bar component for the main window
"""

from PyQt6.QtWidgets import QMenuBar
from PyQt6.QtGui import QAction, QKeySequence


class MenuBar(QMenuBar):
    """Menu bar with File, Edit, View, and Help menus"""

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.create_menus()

    def create_menus(self):
        """Create all menus"""
        self.create_file_menu()
        self.create_edit_menu()
        self.create_insert_menu()
        self.create_view_menu()
        self.create_help_menu()

    def create_file_menu(self):
        """Create File menu"""
        file_menu = self.addMenu("파일(&F)")

        # New file
        new_action = QAction("새 문서(&N)", self)
        new_action.setShortcut(QKeySequence.StandardKey.New)
        new_action.setStatusTip("새 문서 만들기")
        new_action.triggered.connect(self.new_file)
        file_menu.addAction(new_action)

        # Open file
        open_action = QAction("열기(&O)...", self)
        open_action.setShortcut(QKeySequence.StandardKey.Open)
        open_action.setStatusTip("마크다운 파일 열기")
        open_action.triggered.connect(self.open_file)
        file_menu.addAction(open_action)

        file_menu.addSeparator()

        # Save file
        save_action = QAction("저장(&S)", self)
        save_action.setShortcut(QKeySequence.StandardKey.Save)
        save_action.setStatusTip("현재 문서 저장")
        save_action.triggered.connect(self.save_file)
        file_menu.addAction(save_action)

        # Save as
        save_as_action = QAction("다른 이름으로 저장(&A)...", self)
        save_as_action.setShortcut(QKeySequence.StandardKey.SaveAs)
        save_as_action.setStatusTip("다른 이름으로 저장")
        save_as_action.triggered.connect(self.save_file_as)
        file_menu.addAction(save_as_action)

        file_menu.addSeparator()

        # Import submenu
        import_menu = file_menu.addMenu("가져오기(&I)")

        # Import from PDF
        import_pdf_action = QAction("PDF에서 가져오기...", self)
        import_pdf_action.setStatusTip("PDF 파일을 마크다운으로 변환하여 가져오기")
        import_pdf_action.triggered.connect(self.import_from_pdf)
        import_menu.addAction(import_pdf_action)

        # Export submenu
        export_menu = file_menu.addMenu("내보내기(&E)")

        # PDF export (Playwright)
        export_pdf_action = QAction("PDF로 내보내기...", self)
        export_pdf_action.setShortcut("Ctrl+P")
        export_pdf_action.setStatusTip("PDF로 내보내기")
        export_pdf_action.triggered.connect(self.export_pdf)
        export_menu.addAction(export_pdf_action)

        # TODO: DOCX/HTML 내보내기 기능 개선 후 활성화
        # export_menu.addSeparator()
        #
        # export_docx_action = QAction("DOCX로 내보내기...", self)
        # export_docx_action.setStatusTip("문서를 DOCX로 내보내기")
        # export_docx_action.triggered.connect(self.export_docx)
        # export_menu.addAction(export_docx_action)
        #
        # export_html_action = QAction("HTML로 내보내기...", self)
        # export_html_action.setStatusTip("문서를 HTML로 내보내기")
        # export_html_action.triggered.connect(self.export_html)
        # export_menu.addAction(export_html_action)

        file_menu.addSeparator()

        # Exit
        exit_action = QAction("종료(&X)", self)
        exit_action.setShortcut(QKeySequence.StandardKey.Quit)
        exit_action.setStatusTip("애플리케이션 종료")
        exit_action.triggered.connect(self.exit_app)
        file_menu.addAction(exit_action)

    def create_edit_menu(self):
        """Create Edit menu"""
        edit_menu = self.addMenu("편집(&E)")

        # Undo
        undo_action = QAction("실행 취소(&U)", self)
        undo_action.setShortcut(QKeySequence.StandardKey.Undo)
        undo_action.setStatusTip("마지막 작업 취소")
        undo_action.triggered.connect(self.undo)
        edit_menu.addAction(undo_action)

        # Redo
        redo_action = QAction("다시 실행(&R)", self)
        redo_action.setShortcut(QKeySequence.StandardKey.Redo)
        redo_action.setStatusTip("취소한 작업 다시 실행")
        redo_action.triggered.connect(self.redo)
        edit_menu.addAction(redo_action)

        edit_menu.addSeparator()

        # Cut
        cut_action = QAction("잘라내기(&T)", self)
        cut_action.setShortcut(QKeySequence.StandardKey.Cut)
        cut_action.setStatusTip("선택 영역 잘라내기")
        cut_action.triggered.connect(self.cut)
        edit_menu.addAction(cut_action)

        # Copy
        copy_action = QAction("복사(&C)", self)
        copy_action.setShortcut(QKeySequence.StandardKey.Copy)
        copy_action.setStatusTip("선택 영역 복사")
        copy_action.triggered.connect(self.copy)
        edit_menu.addAction(copy_action)

        # Paste
        paste_action = QAction("붙여넣기(&P)", self)
        paste_action.setShortcut(QKeySequence.StandardKey.Paste)
        paste_action.setStatusTip("클립보드 내용 붙여넣기")
        paste_action.triggered.connect(self.paste)
        edit_menu.addAction(paste_action)

        edit_menu.addSeparator()

        # Find
        find_action = QAction("찾기(&F)...", self)
        find_action.setShortcut(QKeySequence.StandardKey.Find)
        find_action.setStatusTip("텍스트 찾기")
        find_action.triggered.connect(self.find)
        edit_menu.addAction(find_action)

        # Replace
        replace_action = QAction("바꾸기(&H)...", self)
        replace_action.setShortcut(QKeySequence.StandardKey.Replace)
        replace_action.setStatusTip("텍스트 찾아 바꾸기")
        replace_action.triggered.connect(self.replace)
        edit_menu.addAction(replace_action)

    def create_insert_menu(self):
        """Create Insert menu"""
        insert_menu = self.addMenu("삽입(&I)")

        # Image
        image_action = QAction("이미지(&I)...", self)
        image_action.setShortcut("Ctrl+Shift+I")
        image_action.setStatusTip("이미지 삽입")
        image_action.triggered.connect(self.insert_image)
        insert_menu.addAction(image_action)

        # Link
        link_action = QAction("링크(&L)...", self)
        link_action.setShortcut("Ctrl+K")
        link_action.setStatusTip("하이퍼링크 삽입")
        link_action.triggered.connect(self.insert_link)
        insert_menu.addAction(link_action)

        insert_menu.addSeparator()

        # Table
        table_action = QAction("표(&T)...", self)
        table_action.setStatusTip("표 삽입")
        table_action.triggered.connect(self.insert_table)
        insert_menu.addAction(table_action)

        # Code block
        code_block_action = QAction("코드 블록(&C)", self)
        code_block_action.setStatusTip("코드 블록 삽입")
        code_block_action.triggered.connect(self.insert_code_block)
        insert_menu.addAction(code_block_action)

        # Horizontal rule
        hr_action = QAction("구분선(&H)", self)
        hr_action.setStatusTip("수평선 삽입")
        hr_action.triggered.connect(self.insert_horizontal_rule)
        insert_menu.addAction(hr_action)

    def create_view_menu(self):
        """Create View menu"""
        view_menu = self.addMenu("보기(&V)")

        # Theme submenu
        theme_menu = view_menu.addMenu("테마(&T)")

        light_theme_action = QAction("라이트 모드", self)
        light_theme_action.setStatusTip("라이트 테마 적용")
        light_theme_action.triggered.connect(lambda: self.set_theme('light'))
        theme_menu.addAction(light_theme_action)

        dark_theme_action = QAction("다크 모드", self)
        dark_theme_action.setStatusTip("다크 테마 적용")
        dark_theme_action.triggered.connect(lambda: self.set_theme('dark'))
        theme_menu.addAction(dark_theme_action)

        view_menu.addSeparator()

        # Fullscreen
        fullscreen_action = QAction("전체 화면(&F)", self)
        fullscreen_action.setShortcut(QKeySequence.StandardKey.FullScreen)
        fullscreen_action.setStatusTip("전체 화면 모드 전환")
        fullscreen_action.triggered.connect(self.toggle_fullscreen)
        view_menu.addAction(fullscreen_action)

    def create_help_menu(self):
        """Create Help menu"""
        help_menu = self.addMenu("도움말(&H)")

        # About
        about_action = QAction("새김 정보(&A)", self)
        about_action.setStatusTip("새김 정보 보기")
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)

    # Action handlers (placeholders for now)
    def new_file(self):
        """Create new file"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.newFile(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def open_file(self):
        """Open file"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.openFile(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def save_file(self):
        """Save file"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.saveFile(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def save_file_as(self):
        """Save file as"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.saveFileAs(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def export_pdf(self):
        """Export to PDF (Advanced - requires GTK3)"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToPDF(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def export_docx(self):
        """Export to DOCX"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToDOCX(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def export_html(self):
        """Export to HTML"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToHTML(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def exit_app(self):
        """Exit application"""
        self.parent.close()

    def undo(self):
        """Undo"""
        self.parent.webview.page().triggerAction(
            self.parent.webview.page().WebAction.Undo
        )

    def redo(self):
        """Redo"""
        self.parent.webview.page().triggerAction(
            self.parent.webview.page().WebAction.Redo
        )

    def cut(self):
        """Cut"""
        self.parent.webview.page().triggerAction(
            self.parent.webview.page().WebAction.Cut
        )

    def copy(self):
        """Copy"""
        self.parent.webview.page().triggerAction(
            self.parent.webview.page().WebAction.Copy
        )

    def paste(self):
        """Paste"""
        self.parent.webview.page().triggerAction(
            self.parent.webview.page().WebAction.Paste
        )

    def find(self):
        """Find text"""
        js_code = "if (typeof FindReplaceModule !== 'undefined') { FindReplaceModule.showFind(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def replace(self):
        """Replace text"""
        js_code = "if (typeof FindReplaceModule !== 'undefined') { FindReplaceModule.showReplace(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def set_theme(self, theme):
        """Set theme"""
        js_code = f"if (typeof ThemeModule !== 'undefined') {{ ThemeModule.setTheme('{theme}'); }}"
        self.parent.webview.page().runJavaScript(js_code)

    def toggle_fullscreen(self):
        """Toggle fullscreen"""
        if self.parent.isFullScreen():
            self.parent.showNormal()
        else:
            self.parent.showFullScreen()

    def show_about(self):
        """Show about dialog"""
        # TODO: Implement about dialog
        print("About dialog")

    def insert_image(self):
        """Insert image"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.image(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def insert_link(self):
        """Insert link"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.link(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def insert_table(self):
        """Insert table"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.insertTable(3, 3); }"
        self.parent.webview.page().runJavaScript(js_code)

    def insert_code_block(self):
        """Insert code block"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.codeBlock(''); }"
        self.parent.webview.page().runJavaScript(js_code)

    def insert_horizontal_rule(self):
        """Insert horizontal rule"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.horizontalRule(); }"
        self.parent.webview.page().runJavaScript(js_code)

    def import_from_pdf(self):
        """Import PDF and convert to markdown"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.importFromPDF(); }"
        self.parent.webview.page().runJavaScript(js_code)
