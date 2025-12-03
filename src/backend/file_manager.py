"""
File Manager Module
Stateless utility class for file I/O operations on markdown files
"""

import json
import re
import shutil
from pathlib import Path
from typing import Optional, Tuple, List
from datetime import datetime


class FileManager:
    """Stateless utility class for file operations"""

    ENCODING = 'utf-8'
    ALLOWED_EXTENSIONS = ['.md', '.txt', '.markdown']

    @staticmethod
    def open_file(file_path: str) -> Tuple[bool, str, str]:
        """
        Open a markdown file

        Args:
            file_path: Path to the file to open

        Returns:
            Tuple of (success, content, error_message)
        """
        try:
            path = Path(file_path)

            if not path.exists():
                return False, "", f"File not found: {file_path}"

            if not path.is_file():
                return False, "", f"Not a file: {file_path}"

            # Check file extension
            if path.suffix.lower() not in FileManager.ALLOWED_EXTENSIONS:
                return False, "", f"Unsupported file type: {path.suffix}"

            # Read file content
            with open(path, 'r', encoding=FileManager.ENCODING) as f:
                content = f.read()

            return True, content, ""

        except UnicodeDecodeError as e:
            return False, "", f"Encoding error: {str(e)}. Try UTF-8 encoding."
        except PermissionError:
            return False, "", f"Permission denied: {file_path}"
        except Exception as e:
            return False, "", f"Error opening file: {str(e)}"

    @staticmethod
    def save_file(content: str, file_path: str, old_file_path: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Save content to a file

        Args:
            content: The markdown content to save
            file_path: Path to save to
            old_file_path: Previous file path (for detecting "Save As" to move images)

        Returns:
            Tuple of (success, final_content, error_message)
        """
        try:
            path = Path(file_path)

            # Ensure parent directory exists
            path.parent.mkdir(parents=True, exist_ok=True)

            # Add .md extension if no extension provided
            if not path.suffix:
                path = path.with_suffix('.md')

            # Move temporary images if this is a new file or "Save As"
            is_new_location = (not old_file_path) or (Path(file_path) != Path(old_file_path))
            if is_new_location:
                content = FileManager._move_temp_images_to_file_location(content, path)

            # Write content
            with open(path, 'w', encoding=FileManager.ENCODING) as f:
                f.write(content)

            return True, content, ""

        except PermissionError:
            return False, content, f"Permission denied: {path}"
        except Exception as e:
            return False, content, f"Error saving file: {str(e)}"

    @staticmethod
    def get_file_name(file_path: Optional[str]) -> str:
        """
        Get file name from path

        Args:
            file_path: Path to file

        Returns:
            File name or "Untitled" if no path
        """
        if file_path:
            return Path(file_path).name
        return "Untitled"

    @staticmethod
    def get_file_info(file_path: str) -> dict:
        """
        Get information about a file

        Args:
            file_path: Path to file

        Returns:
            Dictionary with file information
        """
        path = Path(file_path)

        if not path.exists():
            return {
                "name": "Untitled",
                "path": "",
                "size": 0,
                "exists": False
            }

        stat = path.stat()

        return {
            "name": path.name,
            "path": str(path.absolute()),
            "size": stat.st_size,
            "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "exists": True
        }

    @staticmethod
    def _extract_temp_image_paths(content: str) -> List[str]:
        """
        Extract temporary image paths from markdown content

        Args:
            content: Markdown content

        Returns:
            List of temporary image paths (data/temp/images/...)
        """
        # Pattern: ![...](data/temp/images/filename.ext) or ![...](data/images/filename.ext)
        pattern = r'!\[.*?\]\((data/(?:temp/)?images/[^)]+)\)'
        return re.findall(pattern, content)

    @staticmethod
    def _move_temp_images_to_file_location(content: str, md_path: Path) -> str:
        """
        Move temporary images to markdown file location and update paths

        Args:
            content: Markdown content with temporary image paths
            md_path: Path where markdown file will be saved

        Returns:
            Updated markdown content with new image paths
        """
        # Extract temporary image paths
        temp_images = FileManager._extract_temp_image_paths(content)

        if not temp_images:
            # No temporary images to move
            return content

        # Get project root (assuming this file is in src/backend/)
        project_root = Path(__file__).parent.parent.parent

        # Create images folder: {md_filename}_images/
        images_dir = md_path.parent / f"{md_path.stem}_images"

        # Only create folder if there are actually images to move
        moved_count = 0

        for temp_path in temp_images:
            src = project_root / temp_path

            if src.exists():
                # Create images folder only when first image is moved
                if moved_count == 0:
                    images_dir.mkdir(exist_ok=True)

                # Move image to new location
                dest = images_dir / src.name

                # Handle duplicate filenames
                counter = 1
                while dest.exists():
                    stem = src.stem
                    suffix = src.suffix
                    dest = images_dir / f"{stem}_{counter}{suffix}"
                    counter += 1

                shutil.move(str(src), str(dest))
                moved_count += 1

                # Update markdown content with new relative path
                new_relative_path = f"./{images_dir.name}/{dest.name}"
                content = content.replace(temp_path, new_relative_path)

        return content
