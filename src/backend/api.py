"""
Backend API Module
Provides QWebChannel API for JavaScript ↔ Python communication
"""

import json
import shutil
from pathlib import Path
from PyQt6.QtCore import QObject, pyqtSlot, pyqtSignal
from PyQt6.QtWidgets import QFileDialog, QMessageBox

from backend.file_manager import FileManager
from backend.converter import DocumentConverter
from utils.logger import get_logger

logger = get_logger()


class BackendAPI(QObject):
    """
    Backend API exposed to JavaScript via QWebChannel
    All methods decorated with @pyqtSlot can be called from JavaScript
    """

    # Signals to send data from Python to JavaScript
    file_opened = pyqtSignal(str, str)  # (filename, content)
    file_saved = pyqtSignal(str)  # (filepath)
    error_occurred = pyqtSignal(str)  # (error_message)

    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.file_manager = FileManager()
        self.converter = DocumentConverter()
        logger.info("Backend API initialized")

    @pyqtSlot(result=str)
    def open_file_dialog(self) -> str:
        """
        Open file dialog and return the selected file path
        Called from JavaScript when user clicks File > Open

        Returns:
            JSON string with {success, filepath, content, error}
        """
        try:
            file_path, _ = QFileDialog.getOpenFileName(
                self.main_window,
                "파일 열기",
                "",
                "Markdown Files (*.md *.markdown);;Text Files (*.txt);;All Files (*.*)"
            )

            if not file_path:
                # User cancelled
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "content": "",
                    "error": "Cancelled"
                })

            success, content, error = self.file_manager.open_file(file_path)

            if success:
                logger.info(f"File opened: {file_path}")
                self.file_opened.emit(file_path, content)
                self.main_window.setWindowTitle(
                    f"새김 - {self.file_manager.get_current_file_name()}"
                )

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "content": content,
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in open_file_dialog: {e}")
            return json.dumps({
                "success": False,
                "filepath": "",
                "content": "",
                "error": str(e)
            })

    @pyqtSlot(str, result=str)
    def save_file(self, content: str) -> str:
        """
        Save content to the current file

        Args:
            content: Markdown content to save

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            if not self.file_manager.current_file:
                # No current file, trigger Save As
                return self.save_file_as_dialog(content)

            success, error = self.file_manager.save_file(content)

            if success:
                filepath = self.file_manager.get_current_file_path()
                logger.info(f"File saved: {filepath}")
                self.file_saved.emit(filepath)
                self.main_window.setWindowTitle(
                    f"새김 - {self.file_manager.get_current_file_name()}"
                )

            return json.dumps({
                "success": success,
                "filepath": self.file_manager.get_current_file_path(),
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in save_file: {e}")
            return json.dumps({
                "success": False,
                "filepath": "",
                "error": str(e)
            })

    @pyqtSlot(str, result=str)
    def save_file_as_dialog(self, content: str) -> str:
        """
        Open Save As dialog and save to selected location

        Args:
            content: Markdown content to save

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "다른 이름으로 저장",
                "untitled.md",
                "Markdown Files (*.md);;Text Files (*.txt);;All Files (*.*)"
            )

            if not file_path:
                # User cancelled
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "error": "Cancelled"
                })

            success, error = self.file_manager.save_file(content, file_path)

            if success:
                logger.info(f"File saved as: {file_path}")
                self.file_saved.emit(file_path)
                self.main_window.setWindowTitle(
                    f"새김 - {self.file_manager.get_current_file_name()}"
                )

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in save_file_as_dialog: {e}")
            return json.dumps({
                "success": False,
                "filepath": "",
                "error": str(e)
            })

    @pyqtSlot()
    def new_file(self):
        """Create a new file (clear editor)"""
        try:
            # Check if current file has unsaved changes
            if self.file_manager.is_file_modified():
                reply = QMessageBox.question(
                    self.main_window,
                    "저장하지 않은 변경사항",
                    "현재 문서에 저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                )

                if reply == QMessageBox.StandardButton.No:
                    return

            self.file_manager.new_file()
            self.main_window.setWindowTitle("새김 - Untitled")
            logger.info("New file created")

        except Exception as e:
            logger.error(f"Error in new_file: {e}")

    @pyqtSlot(str)
    def mark_modified(self, is_modified: str):
        """
        Mark document as modified (called from JS when content changes)

        Args:
            is_modified: "true" or "false" string
        """
        modified = is_modified.lower() == "true"
        self.file_manager.mark_modified(modified)

        # Update window title with asterisk if modified
        title = f"새김 - {self.file_manager.get_current_file_name()}"
        if modified:
            title += " *"
        self.main_window.setWindowTitle(title)

    @pyqtSlot(result=str)
    def get_file_info(self) -> str:
        """
        Get current file information

        Returns:
            JSON string with file info
        """
        try:
            info = self.file_manager.get_file_info()
            return json.dumps(info)
        except Exception as e:
            logger.error(f"Error in get_file_info: {e}")
            return json.dumps({"error": str(e)})

    @pyqtSlot(str)
    def log_message(self, message: str):
        """
        Log a message from JavaScript (for debugging)

        Args:
            message: Message to log
        """
        logger.info(f"[JS] {message}")

    @pyqtSlot(str)
    def show_error(self, message: str):
        """
        Show error dialog

        Args:
            message: Error message to display
        """
        QMessageBox.critical(self.main_window, "오류", message)
        logger.error(f"Error shown to user: {message}")

    @pyqtSlot(str)
    def show_info(self, message: str):
        """
        Show info dialog

        Args:
            message: Info message to display
        """
        QMessageBox.information(self.main_window, "알림", message)
        logger.info(f"Info shown to user: {message}")

    @pyqtSlot(int, int, int, int)
    def update_status_bar(self, line: int, column: int, word_count: int, char_count: int):
        """
        Update status bar with cursor position and counts

        Args:
            line: Current line number
            column: Current column number
            word_count: Word count
            char_count: Character count
        """
        if hasattr(self.main_window, 'status_bar'):
            self.main_window.status_bar.update_position(line, column)
            self.main_window.status_bar.update_word_count(word_count, char_count)

    @pyqtSlot(str, result=str)
    def export_to_pdf(self, markdown_content: str) -> str:
        """
        Export markdown content to PDF

        Args:
            markdown_content: Markdown text to convert

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "PDF로 내보내기",
                "document.pdf",
                "PDF Files (*.pdf)"
            )

            if not file_path:
                return json.dumps({"success": False, "filepath": "", "error": "Cancelled"})

            # Get document title from first line or use filename
            title = "Document"
            lines = markdown_content.strip().split('\n')
            if lines and lines[0].startswith('#'):
                title = lines[0].lstrip('#').strip()

            success, error = self.converter.markdown_to_pdf(markdown_content, file_path, title)

            if success:
                logger.info(f"PDF exported: {file_path}")

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in export_to_pdf: {e}")
            return json.dumps({"success": False, "filepath": "", "error": str(e)})

    @pyqtSlot(result=str)
    def get_pdf_save_path(self) -> str:
        """
        Show file save dialog and return the selected path
        This is called first, before showing progress dialog

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "PDF로 내보내기",
                "document.pdf",
                "PDF Files (*.pdf)"
            )

            if not file_path:
                return json.dumps({"success": False, "filepath": "", "error": "Cancelled"})

            logger.info(f"PDF save path selected: {file_path}")

            return json.dumps({
                "success": True,
                "filepath": file_path,
                "error": ""
            })

        except Exception as e:
            logger.error(f"Error in get_pdf_save_path: {e}")
            return json.dumps({"success": False, "filepath": "", "error": str(e)})

    @pyqtSlot(str, str, str, result=str)
    def generate_pdf_from_html(self, rendered_html: str, title: str, file_path: str) -> str:
        """
        Generate PDF from rendered HTML to the specified path
        This is called after the user selects the save location

        Args:
            rendered_html: Fully rendered HTML from preview pane
            title: Document title
            file_path: Path to save the PDF

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            success, error = self.converter.html_to_pdf(rendered_html, file_path, title)

            if success:
                logger.info(f"PDF exported from HTML: {file_path}")

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in generate_pdf_from_html: {e}")
            return json.dumps({"success": False, "filepath": "", "error": str(e)})

    @pyqtSlot(str, str, result=str)
    def export_to_pdf_html(self, rendered_html: str, title: str) -> str:
        """
        Export rendered HTML content to PDF (legacy method - kept for compatibility)
        This preserves Mermaid diagrams and KaTeX equations

        Args:
            rendered_html: Fully rendered HTML from preview pane
            title: Document title

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "PDF로 내보내기",
                "document.pdf",
                "PDF Files (*.pdf)"
            )

            if not file_path:
                return json.dumps({"success": False, "filepath": "", "error": "Cancelled"})

            success, error = self.converter.html_to_pdf(rendered_html, file_path, title)

            if success:
                logger.info(f"PDF exported from HTML: {file_path}")

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in export_to_pdf_html: {e}")
            return json.dumps({"success": False, "filepath": "", "error": str(e)})

    @pyqtSlot(result=str)
    def import_from_pdf(self) -> str:
        """
        Import PDF and convert to markdown with enhanced extraction

        Features:
        - Text extraction with heading/formatting detection
        - Table extraction
        - Image extraction (saved to {pdf_name}_images folder)

        Returns:
            JSON string with {success, content, filepath, images_dir, error}
        """
        try:
            file_path, _ = QFileDialog.getOpenFileName(
                self.main_window,
                "PDF 가져오기",
                "",
                "PDF Files (*.pdf)"
            )

            if not file_path:
                return json.dumps({
                    "success": False,
                    "content": "",
                    "filepath": "",
                    "images_dir": "",
                    "error": "Cancelled"
                })

            # Determine images output directory
            pdf_path = Path(file_path)
            images_dir = pdf_path.parent / f"{pdf_path.stem}_images"

            success, content, error = self.converter.pdf_to_markdown(
                file_path,
                output_dir=str(images_dir)
            )

            if success:
                logger.info(f"PDF imported: {file_path}")
                if images_dir.exists():
                    logger.info(f"Images extracted to: {images_dir}")

            return json.dumps({
                "success": success,
                "content": content,
                "filepath": file_path,
                "images_dir": str(images_dir) if images_dir.exists() else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in import_from_pdf: {e}")
            return json.dumps({
                "success": False,
                "content": "",
                "filepath": "",
                "images_dir": "",
                "error": str(e)
            })

    @pyqtSlot(str, result=str)
    def export_to_docx(self, markdown_content: str) -> str:
        """
        Export markdown content to DOCX

        Args:
            markdown_content: Markdown text to convert

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "DOCX로 내보내기",
                "document.docx",
                "Word Documents (*.docx)"
            )

            if not file_path:
                return json.dumps({"success": False, "filepath": "", "error": "Cancelled"})

            success, error = self.converter.markdown_to_docx(markdown_content, file_path)

            if success:
                logger.info(f"DOCX exported: {file_path}")

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in export_to_docx: {e}")
            return json.dumps({"success": False, "filepath": "", "error": str(e)})

    @pyqtSlot(str, result=str)
    def export_to_html(self, markdown_content: str) -> str:
        """
        Export markdown content to HTML

        Args:
            markdown_content: Markdown text to convert

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "HTML로 내보내기",
                "document.html",
                "HTML Files (*.html)"
            )

            if not file_path:
                return json.dumps({"success": False, "filepath": "", "error": "Cancelled"})

            # Get title
            title = "Document"
            lines = markdown_content.strip().split('\n')
            if lines and lines[0].startswith('#'):
                title = lines[0].lstrip('#').strip()

            success, error = self.converter.markdown_to_html(markdown_content, file_path, title)

            if success:
                logger.info(f"HTML exported: {file_path}")

            return json.dumps({
                "success": success,
                "filepath": file_path if success else "",
                "error": error
            })

        except Exception as e:
            logger.error(f"Error in export_to_html: {e}")
            return json.dumps({"success": False, "filepath": "", "error": str(e)})

    @pyqtSlot(result=str)
    def select_and_insert_image(self) -> str:
        """
        Open file dialog to select an image, copy it to appropriate location,
        and return the relative path for markdown insertion

        Strategy:
        - If current file is saved: copy to {md_filename}_images/ folder
        - If current file is unsaved: copy to data/temp/images/ folder
          (will be moved when file is saved)

        Returns:
            JSON string with {success, filepath, relative_path, error}
        """
        try:
            file_path, _ = QFileDialog.getOpenFileName(
                self.main_window,
                "이미지 선택",
                "",
                "Image Files (*.png *.jpg *.jpeg *.gif *.bmp *.svg *.webp);;All Files (*.*)"
            )

            if not file_path:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "relative_path": "",
                    "error": "Cancelled"
                })

            source_path = Path(file_path)

            if not source_path.exists():
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "relative_path": "",
                    "error": "File not found"
                })

            project_root = Path(__file__).parent.parent.parent

            # Determine destination based on whether file is saved
            if self.file_manager.current_file:
                # Saved file: copy to {md_filename}_images/ folder
                md_path = self.file_manager.current_file
                images_dir = md_path.parent / f"{md_path.stem}_images"
                images_dir.mkdir(exist_ok=True)

                dest_filename = source_path.name
                dest_path = images_dir / dest_filename

                # Handle duplicate filenames
                counter = 1
                while dest_path.exists():
                    stem = source_path.stem
                    suffix = source_path.suffix
                    dest_filename = f"{stem}_{counter}{suffix}"
                    dest_path = images_dir / dest_filename
                    counter += 1

                # Copy image
                shutil.copy2(source_path, dest_path)

                # Use relative path from md file
                relative_path_str = f"./{images_dir.name}/{dest_filename}"

            else:
                # Unsaved file: copy to data/temp/images/
                temp_images_dir = project_root / 'data' / 'temp' / 'images'
                temp_images_dir.mkdir(parents=True, exist_ok=True)

                dest_filename = source_path.name
                dest_path = temp_images_dir / dest_filename

                # Handle duplicate filenames
                counter = 1
                while dest_path.exists():
                    stem = source_path.stem
                    suffix = source_path.suffix
                    dest_filename = f"{stem}_{counter}{suffix}"
                    dest_path = temp_images_dir / dest_filename
                    counter += 1

                # Copy image
                shutil.copy2(source_path, dest_path)

                # Use project-relative path (will be updated on save)
                relative_path = dest_path.relative_to(project_root)
                relative_path_str = str(relative_path).replace('\\', '/')

            # Convert absolute path to file:// URL for QWebEngineView
            absolute_path = dest_path.resolve()
            file_url = absolute_path.as_uri()

            logger.info(f"Image copied: {source_path} -> {dest_path}")
            logger.info(f"Relative path: {relative_path_str}")
            logger.info(f"File URL: {file_url}")

            return json.dumps({
                "success": True,
                "filepath": str(dest_path),
                "relative_path": relative_path_str,
                "file_url": file_url,  # For preview rendering
                "error": ""
            })

        except Exception as e:
            logger.error(f"Error in select_and_insert_image: {e}")
            return json.dumps({
                "success": False,
                "filepath": "",
                "relative_path": "",
                "error": str(e)
            })

    @pyqtSlot(result=str)
    def get_project_root(self) -> str:
        """
        Get the project root directory path
        Used by frontend to resolve relative image paths

        Returns:
            JSON string with {success, path, error}
        """
        try:
            # Get project root (where main.py is located, then go up one level)
            project_root = Path(__file__).parent.parent.parent.resolve()

            return json.dumps({
                "success": True,
                "path": str(project_root),
                "error": ""
            })
        except Exception as e:
            logger.error(f"Error getting project root: {e}")
            return json.dumps({
                "success": False,
                "path": "",
                "error": str(e)
            })
