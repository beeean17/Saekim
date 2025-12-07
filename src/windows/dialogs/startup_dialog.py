"""
시작 다이얼로그 (Startup Dialog)

프로그램 시작 시 사용자에게 3가지 옵션 제공:
1. 새 마크다운 파일 만들기
2. 기존 마크다운 파일 열기
3. PDF 파일을 선택해서 MD 파일로 변환

추가 기능:
- 드래그 & 드롭으로 MD/PDF 파일 열기
- 시스템 테마 / 저장된 테마 적용
"""

from pathlib import Path
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QPushButton,
    QLabel, QFileDialog, QMessageBox, QFrame,
    QGraphicsDropShadowEffect, QApplication
)
from PyQt6.QtCore import Qt, QSize, QSettings, QMimeData
from PyQt6.QtGui import QFont, QColor, QDragEnterEvent, QDropEvent, QPalette

from backend.converter import DocumentConverter
from utils.logger import get_logger
from utils.design_manager import DesignManager

logger = get_logger()


class StartupDialog(QDialog):
    """시작 다이얼로그 - 파일 작업 선택"""

    # 다이얼로그 결과 상수
    NEW_FILE = 1
    OPEN_FILE = 2
    CONVERT_PDF = 3

    # 테마 상수
    THEME_LIGHT = 'light'
    THEME_DARK = 'dark'

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("새김 - 마크다운 에디터")
        self.setFixedSize(500, 480)
        self.setWindowFlags(
            Qt.WindowType.Dialog |
            Qt.WindowType.WindowCloseButtonHint
        )

        # 드래그 & 드롭 활성화
        self.setAcceptDrops(True)

        # 결과 저장 변수
        self.selected_action = None
        self.file_path = None
        self.markdown_content = None

        # 드롭 상태
        self.is_dragging = False

        # 테마 로드 및 적용
        self.current_theme = self.load_theme()

        self.setup_ui()
        self.apply_theme(self.current_theme)

    def load_theme(self) -> str:
        """저장된 테마 또는 시스템 테마 로드"""
        settings = QSettings("Saekim", "SaekimEditor")
        saved_theme = settings.value("theme", None)

        if saved_theme:
            logger.info(f"저장된 테마 로드: {saved_theme}")
            return saved_theme

        # 시스템 테마 감지
        if self.is_system_dark_mode():
            logger.info("시스템 다크 모드 감지")
            return self.THEME_DARK
        else:
            logger.info("시스템 라이트 모드 감지")
            return self.THEME_LIGHT

    def is_system_dark_mode(self) -> bool:
        """시스템이 다크 모드인지 확인"""
        app = QApplication.instance()
        if app:
            palette = app.palette()
            # 배경색이 어두우면 다크 모드로 판단
            bg_color = palette.color(QPalette.ColorRole.Window)
            # 밝기 계산 (0-255, 낮을수록 어두움)
            brightness = (bg_color.red() * 299 + bg_color.green() * 587 + bg_color.blue() * 114) / 1000
            return brightness < 128
        return False

    def apply_theme(self, theme: str):
        """테마 적용"""
        self.current_theme = theme

        if theme == self.THEME_DARK:
            self.setStyleSheet(self._get_dark_theme_style())
        else:
            self.setStyleSheet(self._get_light_theme_style())

    def _get_light_theme_style(self) -> str:
        """라이트 테마 스타일"""
        return """
            QDialog {
                background-color: #ffffff;
            }
            QLabel {
                color: #333333;
            }
            QLabel#subtitle {
                color: #666666;
            }
            QLabel#dropHint {
                color: #888888;
            }
            QFrame#separator {
                background-color: #dddddd;
            }
            QFrame#dropZone {
                background-color: #f8f9fa;
                border: 2px dashed #cccccc;
                border-radius: 12px;
            }
            QFrame#dropZone[dragging="true"] {
                background-color: #e3f2fd;
                border: 2px dashed #2196f3;
            }
            QPushButton {
                text-align: left;
                padding: 15px 20px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                background-color: #fafafa;
                color: #333333;
            }
            QPushButton:hover {
                background-color: #f0f7ff;
                border-color: #3498db;
            }
            QPushButton:pressed {
                background-color: #e3f2fd;
            }
            QLabel.btn-title {
                color: #333333;
                border: none;
                background: transparent;
            }
            QLabel.btn-desc {
                color: #888888;
                border: none;
                background: transparent;
            }
        """

    def _get_dark_theme_style(self) -> str:
        """다크 테마 스타일"""
        return """
            QDialog {
                background-color: #1e1e1e;
            }
            QLabel {
                color: #e0e0e0;
            }
            QLabel#subtitle {
                color: #aaaaaa;
            }
            QLabel#dropHint {
                color: #888888;
            }
            QFrame#separator {
                background-color: #444444;
            }
            QFrame#dropZone {
                background-color: #2d2d2d;
                border: 2px dashed #555555;
                border-radius: 12px;
            }
            QFrame#dropZone[dragging="true"] {
                background-color: #1a3a5c;
                border: 2px dashed #4fc3f7;
            }
            QPushButton {
                text-align: left;
                padding: 15px 20px;
                border: 1px solid #444444;
                border-radius: 8px;
                background-color: #2d2d2d;
                color: #e0e0e0;
            }
            QPushButton:hover {
                background-color: #3d3d3d;
                border-color: #4fc3f7;
            }
            QPushButton:pressed {
                background-color: #1a3a5c;
            }
            QLabel.btn-title {
                color: #e0e0e0;
                border: none;
                background: transparent;
            }
            QLabel.btn-desc {
                color: #888888;
                border: none;
                background: transparent;
            }
        """

    def setup_ui(self):
        """UI 구성"""
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        layout.setContentsMargins(40, 30, 40, 30)

        # 타이틀
        title_label = QLabel("새김")
        title_font = DesignManager.get_font("header")
        title_font.setPointSize(28)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title_label)

        # 서브타이틀
        subtitle_label = QLabel("마크다운 에디터")
        subtitle_label.setObjectName("subtitle")
        subtitle_font = DesignManager.get_font("body")
        subtitle_font.setPointSize(12)
        subtitle_label.setFont(subtitle_font)
        subtitle_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(subtitle_label)

        layout.addSpacing(10)

        # 드래그 & 드롭 영역
        self.drop_zone = QFrame()
        self.drop_zone.setObjectName("dropZone")
        self.drop_zone.setMinimumHeight(80)
        drop_layout = QVBoxLayout(self.drop_zone)
        drop_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.drop_icon_label = QLabel("📁")
        self.drop_icon_label.setFont(QFont("Segoe UI Emoji", 24))
        self.drop_icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        drop_layout.addWidget(self.drop_icon_label)

        self.drop_text_label = QLabel("MD 또는 PDF 파일을 여기에 드래그하세요")
        self.drop_text_label.setObjectName("dropHint")
        drop_text_font = DesignManager.get_font("body")
        drop_text_font.setPointSize(10)
        self.drop_text_label.setFont(drop_text_font)
        self.drop_text_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        drop_layout.addWidget(self.drop_text_label)

        layout.addWidget(self.drop_zone)

        layout.addSpacing(5)

        # 구분선
        line = QFrame()
        line.setObjectName("separator")
        line.setFrameShape(QFrame.Shape.HLine)
        line.setFixedHeight(1)
        layout.addWidget(line)

        layout.addSpacing(5)

        # 버튼 영역
        buttons_layout = QVBoxLayout()
        buttons_layout.setSpacing(15)

        # 1. 새 파일 만들기 버튼
        self.new_file_btn = self._create_action_button(
            "새 마크다운 파일 만들기",
            "빈 문서로 새로 시작합니다",
            self.on_new_file
        )
        buttons_layout.addWidget(self.new_file_btn)

        # 2. 기존 파일 열기 버튼
        self.open_file_btn = self._create_action_button(
            "마크다운 파일 열기",
            "기존 .md 또는 .txt 파일을 엽니다",
            self.on_open_file
        )
        buttons_layout.addWidget(self.open_file_btn)

        # 3. PDF 변환 버튼
        self.convert_pdf_btn = self._create_action_button(
            "PDF를 마크다운으로 변환",
            "PDF 파일을 선택하여 MD 파일로 변환합니다",
            self.on_convert_pdf
        )
        buttons_layout.addWidget(self.convert_pdf_btn)

        layout.addLayout(buttons_layout)

        layout.addStretch()

    def _create_action_button(self, title: str, description: str, callback) -> QPushButton:
        """액션 버튼 생성"""
        btn = QPushButton()
        btn.setMinimumHeight(55)
        btn.setMaximumHeight(55)
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.clicked.connect(callback)

        # 버튼 내부에 레이아웃 사용
        btn_layout = QVBoxLayout(btn)
        btn_layout.setContentsMargins(10, 8, 10, 8)
        btn_layout.setSpacing(2)

        # 제목
        title_label = QLabel(title)
        title_label.setProperty("class", "btn-title")
        title_font = DesignManager.get_font("body")
        title_font.setPointSize(10)
        title_font.setBold(True)
        title_label.setFont(title_font)
        title_label.setStyleSheet("border: none; background: transparent;")
        btn_layout.addWidget(title_label)

        # 설명
        desc_label = QLabel(description)
        desc_label.setProperty("class", "btn-desc")
        desc_font = DesignManager.get_font("small")
        desc_font.setPointSize(9)
        desc_label.setFont(desc_font)
        desc_label.setStyleSheet("border: none; background: transparent;")
        btn_layout.addWidget(desc_label)

        return btn

    # ==================== 드래그 & 드롭 이벤트 ====================

    def dragEnterEvent(self, event: QDragEnterEvent):
        """드래그 진입 이벤트"""
        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            for url in urls:
                file_path = url.toLocalFile()
                if file_path.lower().endswith(('.md', '.markdown', '.txt', '.pdf')):
                    event.acceptProposedAction()
                    self.set_drag_state(True)
                    return
        event.ignore()

    def dragLeaveEvent(self, event):
        """드래그 이탈 이벤트"""
        self.set_drag_state(False)

    def dropEvent(self, event: QDropEvent):
        """드롭 이벤트"""
        self.set_drag_state(False)

        if event.mimeData().hasUrls():
            urls = event.mimeData().urls()
            for url in urls:
                file_path = url.toLocalFile()

                if file_path.lower().endswith(('.md', '.markdown', '.txt')):
                    # 마크다운 파일 열기
                    self.open_markdown_file(file_path)
                    event.acceptProposedAction()
                    return

                elif file_path.lower().endswith('.pdf'):
                    # PDF 파일 변환
                    self.convert_pdf_file(file_path)
                    event.acceptProposedAction()
                    return

        event.ignore()

    def set_drag_state(self, is_dragging: bool):
        """드래그 상태 설정 및 UI 업데이트"""
        self.is_dragging = is_dragging
        self.drop_zone.setProperty("dragging", "true" if is_dragging else "false")

        if is_dragging:
            self.drop_icon_label.setText("📥")
            self.drop_text_label.setText("파일을 놓으세요!")
        else:
            self.drop_icon_label.setText("📁")
            self.drop_text_label.setText("MD 또는 PDF 파일을 여기에 드래그하세요")

        # 스타일 새로고침
        self.drop_zone.style().unpolish(self.drop_zone)
        self.drop_zone.style().polish(self.drop_zone)
        self.drop_zone.update()

    # ==================== 파일 작업 메서드 ====================

    def open_markdown_file(self, file_path: str):
        """마크다운 파일 열기 (드래그 & 드롭용)"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            logger.info(f"드래그 & 드롭으로 파일 열기: {file_path}")
            self.selected_action = self.OPEN_FILE
            self.file_path = file_path
            self.markdown_content = content
            self.accept()

        except Exception as e:
            logger.error(f"파일 열기 실패: {e}")
            QMessageBox.critical(
                self,
                "오류",
                f"파일을 열 수 없습니다:\n{str(e)}"
            )

    def convert_pdf_file(self, pdf_path: str):
        """PDF 파일 변환 (드래그 & 드롭용)"""
        # 저장할 마크다운 파일 경로 지정
        pdf_name = Path(pdf_path).stem
        suggested_name = f"{pdf_name}.md"

        save_path, _ = QFileDialog.getSaveFileName(
            self,
            "변환된 마크다운 파일 저장 위치 선택",
            str(Path(pdf_path).parent / suggested_name),
            "마크다운 파일 (*.md)"
        )

        if not save_path:
            return

        # 확장자 확인
        if not save_path.endswith('.md'):
            save_path += '.md'

        # 변환 진행
        try:
            converter = DocumentConverter()
            success, markdown_content, error_msg = converter.pdf_to_markdown(
                pdf_path,
                output_dir=str(Path(save_path).parent)
            )

            if success:
                # 변환된 내용을 파일로 저장
                with open(save_path, 'w', encoding='utf-8') as f:
                    f.write(markdown_content)

                logger.info(f"드래그 & 드롭 PDF 변환 성공: {pdf_path} -> {save_path}")

                self.selected_action = self.CONVERT_PDF
                self.file_path = save_path
                self.markdown_content = markdown_content
                self.accept()

            else:
                logger.error(f"PDF 변환 실패: {error_msg}")
                QMessageBox.critical(
                    self,
                    "변환 오류",
                    f"PDF를 마크다운으로 변환할 수 없습니다:\n{error_msg}"
                )

        except Exception as e:
            logger.error(f"PDF 변환 중 예외 발생: {e}")
            QMessageBox.critical(
                self,
                "오류",
                f"변환 중 오류가 발생했습니다:\n{str(e)}"
            )

    def on_new_file(self):
        """새 파일 만들기 - 저장 위치 선택 후 빈 파일 생성"""
        # 저장할 파일 경로 지정
        save_path, _ = QFileDialog.getSaveFileName(
            self,
            "새 마크다운 파일 저장 위치 선택",
            str(Path.home() / "newMarkdown.md"),
            "마크다운 파일 (*.md)"
        )

        if not save_path:
            return  # 사용자가 취소함

        # 확장자 확인
        if not save_path.endswith('.md'):
            save_path += '.md'

        try:
            # 빈 파일 생성
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write("")

            logger.info(f"새 파일 생성: {save_path}")
            self.selected_action = self.NEW_FILE
            self.file_path = save_path
            self.markdown_content = ""
            self.accept()

        except Exception as e:
            logger.error(f"파일 생성 실패: {e}")
            QMessageBox.critical(
                self,
                "오류",
                f"파일을 생성할 수 없습니다:\n{str(e)}"
            )

    def on_open_file(self):
        """기존 파일 열기"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "마크다운 파일 열기",
            str(Path.home()),
            "마크다운 파일 (*.md *.markdown *.txt);;모든 파일 (*.*)"
        )

        if file_path:
            self.open_markdown_file(file_path)

    def on_convert_pdf(self):
        """PDF 파일을 마크다운으로 변환"""
        # 1. PDF 파일 선택
        pdf_path, _ = QFileDialog.getOpenFileName(
            self,
            "PDF 파일 선택",
            str(Path.home()),
            "PDF 파일 (*.pdf)"
        )

        if pdf_path:
            self.convert_pdf_file(pdf_path)

    def get_result(self):
        """다이얼로그 결과 반환"""
        return {
            'action': self.selected_action,
            'file_path': self.file_path,
            'content': self.markdown_content
        }
