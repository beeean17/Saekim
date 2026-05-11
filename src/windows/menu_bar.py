"""
Menu bar component for the main window
"""

import sys

from PyQt6.QtWidgets import QMenuBar
from PyQt6.QtGui import QAction, QActionGroup, QKeySequence
from utils.design_manager import DesignManager


class MenuBar(QMenuBar):
    """Menu bar with File, Edit, View, and Help menus"""

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent

        if sys.platform == "darwin":
            self.setNativeMenuBar(True)

        # Set Pretendard font for Korean text
        self.setFont(DesignManager.get_font("body"))

        self.create_menus()

    def create_menus(self):
        """Create all menus"""
        if sys.platform == "darwin":
            self.create_app_menu()
        self.create_file_menu()
        self.create_edit_menu()
        self.create_view_menu()
        self.create_help_menu()

    def create_app_menu(self):
        """Create macOS application menu entries."""
        app_menu = self.addMenu("Saekim")

        preferences_action = QAction("설정...", self)
        if hasattr(QKeySequence.StandardKey, "Preferences"):
            preferences_action.setShortcut(QKeySequence.StandardKey.Preferences)
        else:
            preferences_action.setShortcut(QKeySequence("Meta+,"))
        preferences_action.setMenuRole(QAction.MenuRole.PreferencesRole)
        preferences_action.setStatusTip("설정 열기")
        preferences_action.triggered.connect(self.show_settings)
        app_menu.addAction(preferences_action)

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

        # Open folder
        open_folder_action = QAction("폴더 열기...", self)
        open_folder_action.setStatusTip("파일 탐색기 루트 폴더 열기")
        open_folder_action.triggered.connect(self.open_folder)
        file_menu.addAction(open_folder_action)

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

        # PDF export
        export_pdf_action = QAction("PDF로 내보내기...", self)
        export_pdf_action.setShortcut(QKeySequence.StandardKey.Print)
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

        # Close tab
        close_tab_action = QAction("탭 닫기(&W)", self)
        close_tab_action.setShortcut(QKeySequence.StandardKey.Close)
        close_tab_action.setStatusTip("현재 탭 닫기")
        close_tab_action.triggered.connect(self.close_current_tab)
        file_menu.addAction(close_tab_action)

        # Close all tabs
        close_all_action = QAction("모든 탭 닫기", self)
        close_all_action.setShortcut(self.platform_shortcut("Shift+W"))
        close_all_action.setStatusTip("모든 탭 닫기")
        close_all_action.triggered.connect(self.close_all_tabs)
        file_menu.addAction(close_all_action)

        file_menu.addSeparator()

        # Exit
        exit_action = QAction("종료(&X)", self)
        exit_action.setShortcut(QKeySequence.StandardKey.Quit)
        exit_action.setMenuRole(QAction.MenuRole.QuitRole)
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

    def create_view_menu(self):
        """Create View menu"""
        view_menu = self.addMenu("보기(&V)")

        mode_group = QActionGroup(self)
        mode_group.setExclusive(True)

        edit_mode_action = QAction("편집 모드", self)
        edit_mode_action.setCheckable(True)
        edit_mode_action.triggered.connect(lambda: self.set_view_mode("edit"))
        mode_group.addAction(edit_mode_action)
        view_menu.addAction(edit_mode_action)

        split_mode_action = QAction("분할 모드", self)
        split_mode_action.setCheckable(True)
        split_mode_action.setChecked(True)
        split_mode_action.triggered.connect(lambda: self.set_view_mode("split"))
        mode_group.addAction(split_mode_action)
        view_menu.addAction(split_mode_action)

        preview_mode_action = QAction("미리보기 모드", self)
        preview_mode_action.setCheckable(True)
        preview_mode_action.triggered.connect(lambda: self.set_view_mode("preview"))
        mode_group.addAction(preview_mode_action)
        view_menu.addAction(preview_mode_action)

        view_menu.addSeparator()

        sidebar_action = QAction("파일 탐색기 보기", self)
        sidebar_action.setShortcut(QKeySequence("F9"))
        sidebar_action.setStatusTip("파일 탐색기 보이기/숨기기")
        sidebar_action.triggered.connect(self.toggle_file_explorer)
        view_menu.addAction(sidebar_action)

        refresh_action = QAction("새로고침", self)
        refresh_action.setShortcut(self.platform_shortcut("R") if sys.platform == "darwin" else QKeySequence("F5"))
        refresh_action.setStatusTip("현재 파일 새로고침")
        refresh_action.triggered.connect(self.refresh_current_file)
        view_menu.addAction(refresh_action)

        view_menu.addSeparator()

        # Theme submenu
        theme_menu = view_menu.addMenu("테마(&T)")

        # Get available themes from ThemeManager
        themes = self.parent.theme_manager.THEMES
        
        for theme_key, theme_data in themes.items():
            action = QAction(theme_data['name'], self)
            action.setStatusTip(f"{theme_data['name']} 테마 적용")
            # Use default argument to capture loop variable
            action.triggered.connect(lambda checked, t=theme_key: self.set_theme(t))
            theme_menu.addAction(action)

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
        about_action.setMenuRole(QAction.MenuRole.AboutRole)
        about_action.setStatusTip("새김 정보 보기")
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)

    # Helper methods
    def get_active_webview(self):
        """Get the active tab's webview"""
        active_tab = self.parent.tab_manager.get_active_tab()
        if not active_tab:
            return None
        return self.parent.webview_cache.get(active_tab.tab_id)

    def platform_shortcut(self, key_sequence: str) -> QKeySequence:
        """Return a platform-appropriate app shortcut."""
        modifier = "Meta" if sys.platform == "darwin" else "Ctrl"
        return QKeySequence(f"{modifier}+{key_sequence}")

    # Action handlers
    def new_file(self):
        """Create new file in new tab"""
        self.parent.backend.new_file()

    def open_file(self):
        """Open file in new tab"""
        # Call backend directly to avoid webview dependency
        self.parent.backend.open_file_dialog()

    def open_folder(self):
        """Open folder in the file explorer"""
        self.parent.open_folder_dialog()

    def save_file(self):
        """Save active tab's file"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.saveFile(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def save_file_as(self):
        """Save active tab's file as"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.saveFileAs(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def export_pdf(self):
        """Export to PDF"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToPDF(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def export_docx(self):
        """Export to DOCX"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToDOCX(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def export_html(self):
        """Export to HTML"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.exportToHTML(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def close_current_tab(self):
        """Close the current tab"""
        current_index = self.parent.tab_widget.currentIndex()
        if current_index >= 0:
            self.parent.on_tab_close_requested(current_index)

    def close_all_tabs(self):
        """Close all tabs"""
        while self.parent.tab_widget.count() > 0:
            self.parent.on_tab_close_requested(0)

    def exit_app(self):
        """Exit application"""
        self.parent.close()

    def undo(self):
        """Undo"""
        webview = self.get_active_webview()
        if webview:
            webview.page().triggerAction(webview.page().WebAction.Undo)

    def redo(self):
        """Redo"""
        webview = self.get_active_webview()
        if webview:
            webview.page().triggerAction(webview.page().WebAction.Redo)

    def cut(self):
        """Cut"""
        webview = self.get_active_webview()
        if webview:
            webview.page().triggerAction(webview.page().WebAction.Cut)

    def copy(self):
        """Copy"""
        webview = self.get_active_webview()
        if webview:
            webview.page().triggerAction(webview.page().WebAction.Copy)

    def paste(self):
        """Paste"""
        webview = self.get_active_webview()
        if webview:
            webview.page().triggerAction(webview.page().WebAction.Paste)

    def find(self):
        """Find text"""
        js_code = "if (typeof FindReplaceModule !== 'undefined') { FindReplaceModule.showFind(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def set_theme(self, theme):
        """Set theme"""
        self.parent.apply_theme(theme)
        
        # Update file explorer styling if needed (handled by global QSS mostly now)
        # But we might want to trigger a refresh or specific logic if needed
        pass

    def set_view_mode(self, mode):
        """Set editor/preview layout mode"""
        self.parent.set_view_mode(mode)

    def toggle_fullscreen(self):
        """Toggle fullscreen"""
        if self.parent.isFullScreen():
            self.parent.showNormal()
        else:
            self.parent.showFullScreen()

    def toggle_file_explorer(self):
        """Toggle file explorer visibility"""
        if self.parent.file_explorer.isVisible():
            self.parent.file_explorer.hide()
        else:
            self.parent.file_explorer.show()

    def refresh_current_file(self):
        """Reload the active file from disk"""
        self.parent.reload_current_file()

    def show_settings(self):
        """Show settings dialog"""
        self.parent.show_settings()

    def show_about(self):
        """Show about dialog"""
        self.parent.show_about()

    def insert_image(self):
        """Insert image"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.image(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def insert_link(self):
        """Insert link"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.link(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def insert_table(self):
        """Insert table"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.insertTable(3, 3); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def insert_code_block(self):
        """Insert code block"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.codeBlock(''); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def insert_horizontal_rule(self):
        """Insert horizontal rule"""
        js_code = "if (typeof ToolbarModule !== 'undefined') { ToolbarModule.horizontalRule(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)

    def import_from_pdf(self):
        """Import PDF and convert to markdown"""
        js_code = "if (typeof FileModule !== 'undefined') { FileModule.importFromPDF(); }"
        webview = self.get_active_webview()
        if webview:
            webview.page().runJavaScript(js_code)
