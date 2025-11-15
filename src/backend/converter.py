"""
Document Converter Module
Handles conversion between different document formats (MD, PDF, DOCX, HTML)
"""

import os
import tempfile
from pathlib import Path
from typing import Tuple, Optional

from utils.logger import get_logger

logger = get_logger()


class DocumentConverter:
    """Converts documents between various formats"""

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / 'saekim_temp'
        self.temp_dir.mkdir(exist_ok=True)

    def markdown_to_pdf(self, markdown_content: str, output_path: str,
                        title: str = "Document") -> Tuple[bool, str]:
        """
        Convert Markdown to PDF

        Args:
            markdown_content: Markdown text
            output_path: Path to save PDF
            title: Document title

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Lazy import to avoid GTK3 dependency at startup
            from weasyprint import HTML, CSS

            # Convert markdown to HTML first
            html_content = self._markdown_to_html(markdown_content, title)

            # Create PDF from HTML
            HTML(string=html_content).write_pdf(
                output_path,
                stylesheets=[CSS(string=self._get_pdf_css())]
            )

            logger.info(f"PDF created successfully: {output_path}")
            return True, ""

        except ImportError as e:
            error_msg = "WeasyPrint requires GTK3. Please install GTK3 runtime for Windows: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"PDF conversion failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def html_to_pdf(self, rendered_html: str, output_path: str,
                    title: str = "Document") -> Tuple[bool, str]:
        """
        Convert rendered HTML to PDF
        This method preserves all formatting including Mermaid diagrams and KaTeX equations

        Args:
            rendered_html: Fully rendered HTML from frontend
            output_path: Path to save PDF
            title: Document title

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Lazy import to avoid GTK3 dependency at startup
            from weasyprint import HTML, CSS

            # Wrap the rendered HTML in a complete HTML document
            full_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        /* Import KaTeX styles for math rendering */
        @import url('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css');
    </style>
</head>
<body>
    <div class="content">
        {rendered_html}
    </div>
</body>
</html>
"""

            # Create PDF from HTML
            HTML(string=full_html).write_pdf(
                output_path,
                stylesheets=[CSS(string=self._get_pdf_css())]
            )

            logger.info(f"PDF created from HTML successfully: {output_path}")
            return True, ""

        except ImportError as e:
            error_msg = "WeasyPrint requires GTK3. Please install GTK3 runtime for Windows: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"PDF conversion from HTML failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def _markdown_to_html(self, markdown: str, title: str) -> str:
        """
        Convert Markdown to HTML for PDF generation
        Uses marked.js-like conversion (simplified server-side version)
        """
        # For now, use a simple conversion
        # In production, you'd use markdown library or call JS from Python
        try:
            import markdown as md_lib
            html_body = md_lib.markdown(
                markdown,
                extensions=['extra', 'codehilite', 'tables', 'fenced_code']
            )
        except ImportError:
            # Fallback: basic conversion
            html_body = self._basic_markdown_to_html(markdown)

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
</head>
<body>
    {html_body}
</body>
</html>
"""
        return html

    def _basic_markdown_to_html(self, markdown: str) -> str:
        """
        Basic markdown to HTML conversion (fallback)
        """
        import re

        html = markdown

        # Headings
        html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)

        # Bold
        html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)

        # Italic
        html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)

        # Code
        html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)

        # Links
        html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)

        # Paragraphs
        html = re.sub(r'\n\n', '</p><p>', html)
        html = f'<p>{html}</p>'

        # Line breaks
        html = html.replace('\n', '<br>')

        return html

    def _get_pdf_css(self) -> str:
        """
        CSS styling for PDF output
        Enhanced to support Mermaid diagrams and KaTeX equations
        """
        return """
@page {
    size: A4;
    margin: 2.5cm;
    @top-center {
        content: "";
    }
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10pt;
        color: #666;
    }
}

body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
}

.content {
    max-width: 100%;
}

h1 {
    font-size: 24pt;
    margin-top: 0;
    margin-bottom: 12pt;
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 6pt;
}

h2 {
    font-size: 18pt;
    margin-top: 18pt;
    margin-bottom: 9pt;
    color: #34495e;
    border-bottom: 1px solid #bdc3c7;
    padding-bottom: 3pt;
}

h3 {
    font-size: 14pt;
    margin-top: 12pt;
    margin-bottom: 6pt;
    color: #34495e;
}

p {
    margin: 6pt 0;
    text-align: justify;
}

code {
    font-family: 'Courier New', 'Consolas', monospace;
    background: #f4f4f4;
    padding: 2pt 4pt;
    border-radius: 3pt;
    font-size: 9pt;
}

pre {
    background: #f8f8f8;
    border: 1px solid #ddd;
    border-radius: 4pt;
    padding: 12pt;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.4;
    page-break-inside: avoid;
}

pre code {
    background: transparent;
    padding: 0;
}

ul, ol {
    margin: 6pt 0;
    padding-left: 24pt;
}

li {
    margin: 3pt 0;
}

blockquote {
    margin: 12pt 0;
    padding: 6pt 12pt;
    border-left: 4px solid #3498db;
    background: #ecf0f1;
    font-style: italic;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
}

table th, table td {
    border: 1px solid #bdc3c7;
    padding: 6pt 9pt;
    text-align: left;
}

table th {
    background: #34495e;
    color: white;
    font-weight: bold;
}

table tr:nth-child(even) {
    background: #ecf0f1;
}

a {
    color: #3498db;
    text-decoration: none;
}

img {
    max-width: 14cm;
    max-height: 20cm;
    height: auto;
    display: block;
    margin: 6pt auto;
    page-break-inside: avoid;
}

hr {
    border: none;
    border-top: 2px solid #bdc3c7;
    margin: 18pt 0;
}

/* Mermaid diagram styling */
.mermaid-container {
    margin: 18pt 0;
    padding: 12pt;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 4pt;
    text-align: center;
    page-break-inside: avoid;
    overflow: hidden;
}

/* Mermaid as PNG images */
.mermaid-container img {
    max-width: 14cm !important;
    max-height: 20cm !important;
    width: auto !important;
    height: auto !important;
    display: block;
    margin: 0 auto;
    page-break-inside: avoid;
}

/* Fallback for SVG if not converted */
.mermaid-container svg {
    max-width: 15cm !important;
    max-height: 20cm !important;
    width: auto !important;
    height: auto !important;
    display: inline-block;
}

/* Force SVG text to use system fonts */
.mermaid-container svg text,
.mermaid-container svg tspan {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Segoe UI', Arial, sans-serif !important;
    font-size: 14px !important;
}

.mermaid-error {
    color: #c00;
    background: #fee;
    padding: 12pt;
    border-radius: 4pt;
    border: 1px solid #fcc;
}

/* KaTeX math equation styling */
.katex {
    font-size: 1.1em;
}

.katex-display {
    margin: 12pt 0;
    text-align: center;
    page-break-inside: avoid;
}

.math-display {
    margin: 18pt 0;
    padding: 12pt;
    text-align: center;
    page-break-inside: avoid;
}

.math-inline {
    display: inline;
    vertical-align: baseline;
}

/* Code copy button - hide in PDF */
.code-copy-btn {
    display: none;
}

/* Ensure diagrams don't get cut off */
svg {
    max-width: 15cm !important;
    max-height: 20cm !important;
    page-break-inside: avoid;
}

/* Fix SVG text rendering */
svg text,
svg tspan {
    font-family: 'Malgun Gothic', '맑은 고딕', 'Segoe UI', Arial, sans-serif !important;
}
"""

    def pdf_to_markdown(self, pdf_path: str) -> Tuple[bool, str, str]:
        """
        Convert PDF to Markdown (best effort)

        Args:
            pdf_path: Path to PDF file

        Returns:
            Tuple of (success, markdown_content, error_message)
        """
        try:
            # Lazy import
            import pdfplumber

            markdown_lines = []

            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    # Extract text from page
                    text = page.extract_text()

                    if text:
                        markdown_lines.append(f"\n## Page {page_num}\n")
                        markdown_lines.append(text)

            markdown_content = '\n'.join(markdown_lines)
            logger.info(f"PDF converted to markdown: {pdf_path}")

            return True, markdown_content, ""

        except ImportError as e:
            error_msg = "pdfplumber is not installed"
            logger.error(error_msg)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"PDF to Markdown conversion failed: {str(e)}"
            logger.error(error_msg)
            return False, "", error_msg

    def markdown_to_docx(self, markdown_content: str, output_path: str) -> Tuple[bool, str]:
        """
        Convert Markdown to DOCX (requires python-docx)

        Args:
            markdown_content: Markdown text
            output_path: Path to save DOCX

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Lazy import
            from docx import Document

            doc = Document()

            # Basic conversion (can be enhanced)
            lines = markdown_content.split('\n')

            for line in lines:
                line = line.strip()

                if line.startswith('# '):
                    doc.add_heading(line[2:], level=1)
                elif line.startswith('## '):
                    doc.add_heading(line[3:], level=2)
                elif line.startswith('### '):
                    doc.add_heading(line[4:], level=3)
                elif line:
                    doc.add_paragraph(line)

            doc.save(output_path)
            logger.info(f"DOCX created: {output_path}")

            return True, ""

        except ImportError as e:
            error_msg = "python-docx is not installed"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"DOCX conversion failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def markdown_to_html(self, markdown_content: str, output_path: str,
                         title: str = "Document") -> Tuple[bool, str]:
        """
        Convert Markdown to standalone HTML file

        Args:
            markdown_content: Markdown text
            output_path: Path to save HTML
            title: Document title

        Returns:
            Tuple of (success, error_message)
        """
        try:
            html_content = self._markdown_to_html(markdown_content, title)

            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)

            logger.info(f"HTML created: {output_path}")
            return True, ""

        except Exception as e:
            error_msg = f"HTML conversion failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
