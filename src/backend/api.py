"""
Backend API Module
Provides QWebChannel API for JavaScript ↔ Python communication
"""

import json
import shutil
from pathlib import Path
from PyQt6.QtCore import QObject, pyqtSlot, pyqtSignal, QSettings
from PyQt6.QtWidgets import QFileDialog, QMessageBox

from backend.file_manager import FileManager
from backend.converter import DocumentConverter
from utils.logger import get_logger

logger = get_logger()


class BackendAPI(QObject):
    """
    Backend API exposed to JavaScript via QWebChannel
    All methods decorated with @pyqtSlot can be called from JavaScript
    Tab-aware version - all operations work on the active tab
    """

    # Signals to send data from Python to JavaScript
    file_opened = pyqtSignal(str, str)  # (filename, content)
    file_saved = pyqtSignal(str)  # (filepath)
    error_occurred = pyqtSignal(str)  # (error_message)

    def __init__(self, main_window):
        super().__init__()
        self.main_window = main_window
        self.converter = DocumentConverter()
        logger.info("Backend API initialized")

    @property
    def tab_manager(self):
        """Get tab manager from main window"""
        return self.main_window.tab_manager

    @property
    def active_tab(self):
        """Get currently active tab"""
        return self.tab_manager.get_active_tab()

    @pyqtSlot(result=str)
    def open_file_dialog(self) -> str:
        """
        Open file dialog and create new tab with selected file
        Called from JavaScript when user clicks File > Open

        Returns:
            JSON string with {success, filepath, content, error}
        """
        try:
            # Use active tab's file directory as default path
            default_dir = ""
            if self.active_tab and self.active_tab.file_path:
                default_dir = str(self.active_tab.file_path.parent)

            file_path, _ = QFileDialog.getOpenFileName(
                self.main_window,
                "파일 열기",
                default_dir,
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

            # Open file in new tab
            self.main_window.open_file_in_new_tab(file_path)

            # Load file content for response
            success, content, error = FileManager.open_file(file_path)

            if success:
                logger.info(f"File opened in new tab: {file_path}")
                # Don't emit file_opened signal - new tab handles its own content loading

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
        Save content to the active tab's file

        Args:
            content: Markdown content to save

        Returns:
            JSON string with {success, filepath, error}
        """
        try:
            if not self.active_tab:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "error": "No active tab"
                })

            if not self.active_tab.file_path:
                # No file path, trigger Save As
                return self.save_file_as_dialog(content)

            # Save file
            old_file_path = str(self.active_tab.file_path) if self.active_tab.file_path else None
            success, final_content, error = FileManager.save_file(
                content,
                str(self.active_tab.file_path),
                old_file_path
            )

            if success:
                # Update tab manager
                self.tab_manager.update_tab_content(self.active_tab.tab_id, final_content)
                self.tab_manager.update_tab_modified(self.active_tab.tab_id, False)

                filepath = str(self.active_tab.file_path)
                logger.info(f"File saved: {filepath}")
                self.file_saved.emit(filepath)

                # Update window title
                title = FileManager.get_file_name(filepath)
                self.main_window.setWindowTitle(f"새김 - {title}")

            return json.dumps({
                "success": success,
                "filepath": str(self.active_tab.file_path) if success else "",
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
            if not self.active_tab:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "error": "No active tab"
                })

            # Use active tab's file path as default
            default_path = "untitled.md"
            if self.active_tab.file_path:
                default_path = str(self.active_tab.file_path)

            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "다른 이름으로 저장",
                default_path,
                "Markdown Files (*.md);;Text Files (*.txt);;All Files (*.*)"
            )

            if not file_path:
                # User cancelled
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "error": "Cancelled"
                })

            # Save file
            old_file_path = str(self.active_tab.file_path) if self.active_tab.file_path else None
            success, final_content, error = FileManager.save_file(content, file_path, old_file_path)

            if success:
                # Update tab manager
                self.tab_manager.update_tab_file_path(self.active_tab.tab_id, file_path)
                self.tab_manager.update_tab_content(self.active_tab.tab_id, final_content)
                self.tab_manager.update_tab_modified(self.active_tab.tab_id, False)

                logger.info(f"File saved as: {file_path}")
                self.file_saved.emit(file_path)

                # Update window title
                title = FileManager.get_file_name(file_path)
                self.main_window.setWindowTitle(f"새김 - {title}")

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
        """Create a new tab with empty content"""
        try:
            # Create new tab
            self.main_window.create_new_tab()
            logger.info("New file tab created")

        except Exception as e:
            logger.error(f"Error in new_file: {e}")

    @pyqtSlot(str)
    def mark_modified(self, is_modified: str):
        """
        Mark active tab as modified (called from JS when content changes)

        Args:
            is_modified: "true" or "false" string
        """
        if not self.active_tab:
            return

        modified = is_modified.lower() == "true"
        self.tab_manager.update_tab_modified(self.active_tab.tab_id, modified)

        # Update window title with asterisk if modified
        title = f"새김 - {self.active_tab.get_display_name()}"
        if modified:
            title = f"*{title}"
        self.main_window.setWindowTitle(title)

    @pyqtSlot(result=str)
    def get_file_info(self) -> str:
        """
        Get active tab's file information

        Returns:
            JSON string with file info
        """
        try:
            if not self.active_tab:
                return json.dumps({
                    "name": "Untitled",
                    "path": "",
                    "size": 0,
                    "exists": False
                })

            if self.active_tab.file_path:
                info = FileManager.get_file_info(str(self.active_tab.file_path))
                info["modified"] = self.active_tab.is_modified
            else:
                info = {
                    "name": "Untitled",
                    "path": "",
                    "size": 0,
                    "modified": self.active_tab.is_modified,
                    "exists": False
                }

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
            # Use active tab's file directory as default
            default_path = "document.pdf"
            if self.active_tab and self.active_tab.file_path:
                default_path = str(self.active_tab.file_path.with_suffix('.pdf'))

            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "PDF로 내보내기",
                default_path,
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
        Prompts user to save the markdown file and opens it in a new tab

        Features:
        - Text extraction with heading/formatting detection
        - Table extraction
        - Image extraction (saved to {pdf_name}_images folder)
        - Saves to user-selected location and opens in new tab

        Returns:
            JSON string with {success, filepath, images_dir, error}
        """
        try:
            # Step 1: Select PDF file to import
            # Use active tab's file directory as default
            default_dir = ""
            if self.active_tab and self.active_tab.file_path:
                default_dir = str(self.active_tab.file_path.parent)

            pdf_file_path, _ = QFileDialog.getOpenFileName(
                self.main_window,
                "PDF 가져오기",
                default_dir,
                "PDF Files (*.pdf)"
            )

            if not pdf_file_path:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "images_dir": "",
                    "error": "Cancelled"
                })

            # Step 2: Convert PDF to markdown
            pdf_path = Path(pdf_file_path)
            images_dir = pdf_path.parent / f"{pdf_path.stem}_images"

            success, content, error = self.converter.pdf_to_markdown(
                pdf_file_path,
                output_dir=str(images_dir)
            )

            if not success:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "images_dir": "",
                    "error": error
                })

            logger.info(f"PDF converted to markdown: {pdf_file_path}")
            if images_dir.exists():
                logger.info(f"Images extracted to: {images_dir}")

            # Step 3: Prompt user to save markdown file
            # Default path is PDF directory with .md extension
            default_save_path = str(pdf_path.with_suffix('.md'))

            md_file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "마크다운 파일 저장",
                default_save_path,
                "Markdown Files (*.md);;All Files (*.*)"
            )

            if not md_file_path:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "images_dir": "",
                    "error": "Save cancelled"
                })

            # Step 4: Save markdown file
            save_success, final_content, save_error = FileManager.save_file(
                content,
                md_file_path,
                None  # No old file path
            )

            if not save_success:
                return json.dumps({
                    "success": False,
                    "filepath": "",
                    "images_dir": "",
                    "error": f"Failed to save: {save_error}"
                })

            logger.info(f"Markdown file saved: {md_file_path}")

            # Step 5: Open saved file in new tab
            self.main_window.open_file_in_new_tab(md_file_path)

            return json.dumps({
                "success": True,
                "filepath": md_file_path,
                "images_dir": str(images_dir) if images_dir.exists() else "",
                "error": ""
            })

        except Exception as e:
            logger.error(f"Error in import_from_pdf: {e}")
            return json.dumps({
                "success": False,
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
            # Use active tab's file directory as default
            default_path = "document.docx"
            if self.active_tab and self.active_tab.file_path:
                default_path = str(self.active_tab.file_path.with_suffix('.docx'))

            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "DOCX로 내보내기",
                default_path,
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
            # Use active tab's file directory as default
            default_path = "document.html"
            if self.active_tab and self.active_tab.file_path:
                default_path = str(self.active_tab.file_path.with_suffix('.html'))

            file_path, _ = QFileDialog.getSaveFileName(
                self.main_window,
                "HTML로 내보내기",
                default_path,
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
            # Use active tab's file directory as default
            default_dir = ""
            if self.active_tab and self.active_tab.file_path:
                default_dir = str(self.active_tab.file_path.parent)

            file_path, _ = QFileDialog.getOpenFileName(
                self.main_window,
                "이미지 선택",
                default_dir,
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

            # Sanitize filename: replace spaces with underscores
            original_filename = source_path.name
            sanitized_filename = original_filename.replace(' ', '_')

            # Determine destination based on whether active tab has saved file
            if self.active_tab and self.active_tab.file_path:
                # Saved file: copy to {md_filename}_images/ folder
                md_path = self.active_tab.file_path
                images_dir = md_path.parent / f"{md_path.stem}_images"
                images_dir.mkdir(exist_ok=True)

                dest_filename = sanitized_filename
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

                dest_filename = sanitized_filename
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

    @pyqtSlot(str, result=str)
    def save_theme(self, theme: str) -> str:
        """
        Save theme preference to QSettings

        Args:
            theme: Theme name ('light' or 'dark')

        Returns:
            JSON string with {success, error}
        """
        try:
            settings = QSettings("Saekim", "SaekimEditor")
            settings.setValue("theme", theme)
            logger.info(f"Theme saved: {theme}")

            return json.dumps({
                "success": True,
                "error": ""
            })
        except Exception as e:
            logger.error(f"Error saving theme: {e}")
            return json.dumps({
                "success": False,
                "error": str(e)
            })

    @pyqtSlot(result=str)
    def load_theme(self) -> str:
        """
        Load saved theme preference from QSettings

        Returns:
            JSON string with {success, theme, error}
        """
        try:
            settings = QSettings("Saekim", "SaekimEditor")
            theme = settings.value("theme", "light")
            logger.info(f"Theme loaded: {theme}")

            return json.dumps({
                "success": True,
                "theme": theme,
                "error": ""
            })
        except Exception as e:
            logger.error(f"Error loading theme: {e}")
            return json.dumps({
                "success": False,
                "theme": "light",
                "error": str(e)
            })
