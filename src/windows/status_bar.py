"""
Status bar component for displaying information
"""

from PyQt6.QtWidgets import QStatusBar, QLabel
from PyQt6.QtCore import Qt


class StatusBar(QStatusBar):
    """Status bar showing save state, file metadata, cursor position, and counts."""

    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.setup_widgets()

    def setup_widgets(self):
        """Setup status bar widgets"""
        self.setFixedHeight(26)

        self.file_label = QLabel("새 문서")
        self.file_label.setObjectName("StatusFilePath")
        self.file_label.setAlignment(Qt.AlignmentFlag.AlignLeft)
        self.file_label.setMinimumWidth(160)
        self.addWidget(self.file_label)

        self.addPermanentWidget(QLabel(""), 1)

        self.saved_label = self._create_item("● 저장됨", "saved", 86)
        self.language_label = self._create_item("Markdown", "meta", 78)
        self.encoding_label = self._create_item("UTF-8", "meta", 64)
        self.eol_label = self._create_item("LF", "meta", 38)
        self.position_label = self._create_item("Ln 1, Col 1", "meta", 96)
        self.word_count_label = self._create_item("0 단어", "meta", 74)
        self.char_count_label = self._create_item("0 자", "meta", 64)
        self.reading_time_label = self._create_item("~1분 읽기", "meta", 88, separator=False)

        for item in (
            self.saved_label,
            self.language_label,
            self.encoding_label,
            self.eol_label,
            self.position_label,
            self.word_count_label,
            self.char_count_label,
            self.reading_time_label,
        ):
            self.addPermanentWidget(item)

    def _create_item(self, text, role, minimum_width, separator=True):
        label = QLabel(text)
        label.setProperty("role", role)
        label.setProperty("separator", "true" if separator else "false")
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        label.setMinimumWidth(minimum_width)
        return label

    def update_save_status(self, is_dirty: bool, is_saved: bool = True):
        """Update save state display."""
        if is_dirty or not is_saved:
            self.saved_label.setText("● 저장 안 됨")
            self.saved_label.setProperty("state", "dirty")
        else:
            self.saved_label.setText("● 저장됨")
            self.saved_label.setProperty("state", "saved")

        self.saved_label.style().unpolish(self.saved_label)
        self.saved_label.style().polish(self.saved_label)

    def update_file_meta(self, language: str = "Markdown", encoding: str = "UTF-8", eol: str = "LF"):
        """Update language, encoding, and line ending display."""
        self.language_label.setText(language or "Plain Text")
        self.encoding_label.setText(encoding or "UTF-8")
        self.eol_label.setText(eol or "LF")

    def update_file_path(self, file_path):
        """Update file path display."""
        self.file_label.setText(file_path if file_path else "새 문서")

    def update_position(self, line, column):
        """Update cursor position display."""
        self.position_label.setText(f"Ln {line}, Col {column}")

    def update_word_count(self, word_count, char_count):
        """Update word, character, and reading-time counts."""
        self.word_count_label.setText(f"{word_count} 단어")
        self.char_count_label.setText(f"{char_count} 자")
        reading_minutes = max(1, (char_count + 499) // 500)
        self.reading_time_label.setText(f"~{reading_minutes}분 읽기")

    def reset_for_empty_document(self):
        """Reset status for the welcome/empty state."""
        self.update_file_path("")
        self.update_save_status(False, True)
        self.update_file_meta("Markdown", "UTF-8", "LF")
        self.update_position(1, 1)
        self.update_word_count(0, 0)

    def show_message(self, message, timeout=3000):
        """Show temporary message."""
        self.showMessage(message, timeout)
