"""
Document Converter Module
Handles conversion between different document formats (MD, PDF, DOCX, HTML)
"""

import os
import asyncio
import tempfile
from pathlib import Path
from typing import Tuple, Optional

from utils.logger import get_logger

logger = get_logger()


def _run_async(coro):
    """Run async coroutine in sync context"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running (e.g., in Qt), create a new one
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


class DocumentConverter:
    """Converts documents between various formats"""

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / 'saekim_temp'
        self.temp_dir.mkdir(exist_ok=True)

    def markdown_to_pdf(self, markdown_content: str, output_path: str,
                        title: str = "Document") -> Tuple[bool, str]:
        """
        Convert Markdown to PDF using Playwright

        Args:
            markdown_content: Markdown text
            output_path: Path to save PDF
            title: Document title

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Convert markdown to HTML first
            html_content = self._markdown_to_html(markdown_content, title)

            # Use Playwright to generate PDF
            return self._generate_pdf_with_playwright(html_content, output_path)

        except Exception as e:
            error_msg = f"PDF conversion failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def html_to_pdf(self, rendered_html: str, output_path: str,
                    title: str = "Document") -> Tuple[bool, str]:
        """
        Convert rendered HTML to PDF using Playwright
        This method preserves all formatting including Mermaid diagrams and KaTeX equations

        Args:
            rendered_html: Fully rendered HTML from frontend
            output_path: Path to save PDF
            title: Document title

        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Wrap the rendered HTML in a complete HTML document with all dependencies
            full_html = self._create_full_html_for_pdf(rendered_html, title)

            # Use Playwright to generate PDF
            return self._generate_pdf_with_playwright(full_html, output_path)

        except Exception as e:
            error_msg = f"PDF conversion from HTML failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def _create_full_html_for_pdf(self, rendered_html: str, title: str) -> str:
        """Create a complete HTML document for PDF generation with all necessary styles"""
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <style>
        {self._get_pdf_css()}
    </style>
</head>
<body>
    <div class="content">
        {rendered_html}
    </div>
</body>
</html>"""

    def _generate_pdf_with_playwright(self, html_content: str, output_path: str) -> Tuple[bool, str]:
        """Generate PDF from HTML using Playwright"""
        return _run_async(self._async_generate_pdf(html_content, output_path))

    async def _async_generate_pdf(self, html_content: str, output_path: str) -> Tuple[bool, str]:
        """Async implementation of PDF generation using Playwright"""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            error_msg = (
                "Playwright가 설치되지 않았습니다.\n\n"
                "다음 명령어로 설치해주세요:\n"
                "pip install playwright\n"
                "playwright install chromium"
            )
            logger.error("Playwright not installed")
            return False, error_msg

        temp_html_path = None
        try:
            # Save HTML to temp file (Playwright needs a file or URL)
            temp_html_path = self.temp_dir / f"temp_pdf_{os.getpid()}.html"
            with open(temp_html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)

            async with async_playwright() as p:
                # Launch browser in headless mode
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()

                # Load the HTML file
                await page.goto(f'file:///{temp_html_path.as_posix()}', wait_until='networkidle')

                # Wait for any dynamic content (KaTeX, Mermaid) to render
                await page.wait_for_timeout(500)

                # Generate PDF with A4 format
                await page.pdf(
                    path=output_path,
                    format='A4',
                    margin={
                        'top': '2.5cm',
                        'bottom': '2.5cm',
                        'left': '2.5cm',
                        'right': '2.5cm'
                    },
                    print_background=True,
                    display_header_footer=True,
                    header_template='<div></div>',
                    footer_template='''
                        <div style="font-size: 10px; text-align: center; width: 100%; color: #666;">
                            <span class="pageNumber"></span> / <span class="totalPages"></span>
                        </div>
                    '''
                )

                await browser.close()

            logger.info(f"PDF created successfully with Playwright: {output_path}")
            return True, ""

        except Exception as e:
            error_msg = f"Playwright PDF generation failed: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

        finally:
            # Clean up temp file
            if temp_html_path and temp_html_path.exists():
                try:
                    temp_html_path.unlink()
                except:
                    pass

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

/* Code language label - hide in PDF */
.code-language-label {
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

/* Highlight.js syntax highlighting - GitHub Dark theme */
.hljs {
    display: block;
    overflow-x: auto;
    padding: 0.5em;
    color: #FFFFFF;
    background: #0d1117;
}

.hljs-doctag,
.hljs-keyword,
.hljs-meta .hljs-keyword,
.hljs-template-tag,
.hljs-template-variable,
.hljs-type,
.hljs-variable.language_ {
    color: #ff7b72;
}

.hljs-title,
.hljs-title.class_,
.hljs-title.class_.inherited__,
.hljs-title.function_ {
    color: #d2a8ff;
}

.hljs-attr,
.hljs-attribute,
.hljs-literal,
.hljs-meta,
.hljs-number,
.hljs-operator,
.hljs-selector-attr,
.hljs-selector-class,
.hljs-selector-id,
.hljs-variable {
    color: #79c0ff;
}

.hljs-meta .hljs-string,
.hljs-regexp,
.hljs-string {
    color: #a5d6ff;
}

.hljs-built_in,
.hljs-symbol {
    color: #ffa657;
}

.hljs-code,
.hljs-comment,
.hljs-formula {
    color: #8b949e;
    font-style: italic;
}

.hljs-name,
.hljs-quote,
.hljs-selector-pseudo,
.hljs-selector-tag {
    color: #7ee787;
}

.hljs-subst {
    color: #FFFFFF;
}

.hljs-section {
    color: #1f6feb;
    font-weight: bold;
}

.hljs-bullet {
    color: #f2cc60;
}

.hljs-emphasis {
    color: #FFFFFF;
    font-style: italic;
}

.hljs-strong {
    color: #FFFFFF;
    font-weight: bold;
}

.hljs-addition {
    color: #aff5b4;
    background-color: #033a16;
}

.hljs-deletion {
    color: #ffdcd7;
    background-color: #67060c;
}
"""

    def pdf_to_markdown(self, pdf_path: str, output_dir: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Convert PDF to Markdown with enhanced structure detection

        Features:
        - Heading detection based on font size
        - Table extraction
        - Image extraction
        - List detection
        - Bold/Italic text detection

        Args:
            pdf_path: Path to PDF file
            output_dir: Directory to save extracted images (optional)

        Returns:
            Tuple of (success, markdown_content, error_message)
        """
        try:
            # Try PyMuPDF first for better extraction
            return self._pdf_to_markdown_pymupdf(pdf_path, output_dir)
        except ImportError:
            # Fallback to pdfplumber
            return self._pdf_to_markdown_pdfplumber(pdf_path)
        except Exception as e:
            error_msg = f"PDF to Markdown conversion failed: {str(e)}"
            logger.error(error_msg)
            return False, "", error_msg

    def _pdf_to_markdown_pymupdf(self, pdf_path: str, output_dir: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Convert PDF to Markdown using PyMuPDF (fitz)
        Uses BBox-based header/footer filtering and cross-page code block detection.
        """
        import fitz  # PyMuPDF

        pdf_path = Path(pdf_path)

        # Setup image output directory
        if output_dir:
            images_dir = Path(output_dir)
        else:
            images_dir = pdf_path.parent / f"{pdf_path.stem}_images"

        markdown_lines = []
        extracted_images = []

        doc = fitz.open(pdf_path)

        # Collect all fonts used in the document for debugging
        all_fonts = set()

        # State for cross-page code block detection
        in_code_block = False
        code_buffer = []

        # Track processed image xrefs to avoid duplicates (logos, watermarks, etc.)
        processed_image_xrefs = set()

        try:
            total_pages = len(doc)

            for page_num, page in enumerate(doc, 1):
                page_rect = page.rect
                page_height = page_rect.height

                # Define header/footer regions - only for multi-page documents
                # Single page PDFs often don't have headers/footers
                use_filtering = total_pages > 2
                if use_filtering:
                    # Use conservative thresholds (top 5%, bottom 5%)
                    header_threshold = page_height * 0.05
                    footer_threshold = page_height * 0.95
                else:
                    # No filtering for short documents
                    header_threshold = 0
                    footer_threshold = page_height

                # Extract text blocks with font information
                blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

                # Log fonts on first page for debugging
                if page_num == 1:
                    for block in blocks:
                        if block["type"] == 0:  # Text block
                            for line in block.get("lines", []):
                                for span in line.get("spans", []):
                                    font_name = span.get("font", "")
                                    if font_name:
                                        all_fonts.add(font_name)

                    if all_fonts:
                        logger.info(f"PDF fonts detected: {sorted(all_fonts)}")
                    logger.info(f"PDF pages: {total_pages}, using header/footer filtering: {use_filtering}")

                for block in blocks:
                    # Get block's vertical position (y0 = top, y1 = bottom)
                    block_y0 = block.get("bbox", [0, 0, 0, 0])[1]
                    block_y1 = block.get("bbox", [0, 0, 0, 0])[3]

                    # Skip header/footer regions based on BBox (only if filtering is enabled)
                    if use_filtering:
                        if block_y0 < header_threshold:
                            # Header region - skip unless we're in a code block
                            if not in_code_block:
                                continue
                        if block_y1 > footer_threshold:
                            # Footer region - skip unless we're in a code block
                            if not in_code_block:
                                continue

                    if block["type"] == 0:  # Text block
                        # Process block with code detection
                        block_result = self._process_text_block_with_state(
                            block, in_code_block, code_buffer
                        )

                        in_code_block = block_result['in_code_block']
                        code_buffer = block_result['code_buffer']

                        if block_result['output']:
                            markdown_lines.append(block_result['output'])

                    elif block["type"] == 1:  # Image block
                        # Get image xref to check for duplicates
                        img_xref = block.get("xref", 0)

                        # Skip duplicate images (logos, watermarks that appear on every page)
                        if img_xref != 0 and img_xref in processed_image_xrefs:
                            logger.debug(f"Skipping duplicate image xref: {img_xref}")
                            continue

                        # Mark this xref as processed
                        if img_xref != 0:
                            processed_image_xrefs.add(img_xref)

                        # Flush code buffer before image
                        if in_code_block and code_buffer:
                            markdown_lines.append(self._format_code_block(code_buffer))
                            code_buffer = []
                            in_code_block = False

                        # Extract image
                        img_result = self._extract_image_from_block(
                            page, block, page_num, len(extracted_images) + 1,
                            images_dir, pdf_path.stem
                        )
                        if img_result:
                            extracted_images.append(img_result)
                            markdown_lines.append(f"\n![Image {len(extracted_images)}]({img_result})\n")

                # Extract tables using pdfplumber for better table detection
                page_tables = self._extract_tables_from_page(pdf_path, page_num - 1)
                if page_tables:
                    # Flush code buffer before tables
                    if in_code_block and code_buffer:
                        markdown_lines.append(self._format_code_block(code_buffer))
                        code_buffer = []
                        in_code_block = False

                    for table_md in page_tables:
                        markdown_lines.append(f"\n{table_md}\n")

                # Add page separator (but not if we're in a code block that continues)
                if page_num < total_pages and not in_code_block:
                    markdown_lines.append("\n---\n")

            # Flush remaining code buffer at end of document
            if code_buffer:
                markdown_lines.append(self._format_code_block(code_buffer))

            markdown_content = '\n'.join(markdown_lines)

            # Clean up excessive newlines
            import re
            markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content)

            logger.info(f"PDF converted to markdown with PyMuPDF: {pdf_path}")
            if extracted_images:
                logger.info(f"Extracted {len(extracted_images)} images")

            return True, markdown_content.strip(), ""

        finally:
            doc.close()

    def _process_text_block_with_state(self, block: dict, in_code_block: bool,
                                        code_buffer: list) -> dict:
        """
        Process a text block with stateful code block detection.
        Maintains code block state across blocks and pages.

        Returns:
            dict with 'output', 'in_code_block', 'code_buffer'
        """
        output_lines = []
        current_in_code = in_code_block
        current_buffer = code_buffer.copy()

        for line in block.get("lines", []):
            line_text = ""
            is_monospace = False
            max_font_size = 0
            is_bold = False
            is_italic = False

            for span in line.get("spans", []):
                text = span.get("text", "")
                font_size = span.get("size", 12)
                font_name = span.get("font", "").lower()

                max_font_size = max(max_font_size, font_size)

                # Detect monospace font
                if self._is_monospace_font(font_name):
                    is_monospace = True

                # Detect bold/italic
                if "bold" in font_name or "black" in font_name:
                    is_bold = True
                if "italic" in font_name or "oblique" in font_name:
                    is_italic = True

                line_text += text

            line_text_stripped = line_text.strip()
            if not line_text_stripped:
                if current_in_code:
                    current_buffer.append("")
                continue

            # Also check content pattern if font detection fails
            if not is_monospace:
                is_monospace = self._looks_like_code(line_text)

            # State machine for code blocks
            if is_monospace:
                if not current_in_code:
                    # Starting new code block
                    current_in_code = True
                # Add to code buffer (preserve indentation)
                current_buffer.append(line_text.rstrip())
            else:
                # Not monospace - end code block if we were in one
                if current_in_code and current_buffer:
                    output_lines.append(self._format_code_block(current_buffer))
                    current_buffer = []
                    current_in_code = False

                # Format as regular text
                formatted_line = line_text_stripped

                # Apply heading formatting based on font size
                if max_font_size >= 24:
                    formatted_line = f"# {formatted_line}"
                elif max_font_size >= 18:
                    formatted_line = f"## {formatted_line}"
                elif max_font_size >= 14:
                    formatted_line = f"### {formatted_line}"
                else:
                    # Apply bold/italic
                    if is_bold and is_italic:
                        formatted_line = f"***{formatted_line}***"
                    elif is_bold:
                        formatted_line = f"**{formatted_line}**"
                    elif is_italic:
                        formatted_line = f"*{formatted_line}*"

                    # Detect list items
                    formatted_line = self._detect_list_item(formatted_line)

                output_lines.append(formatted_line)

        return {
            'output': '\n'.join(output_lines) if output_lines else "",
            'in_code_block': current_in_code,
            'code_buffer': current_buffer
        }

    def _process_text_block(self, block: dict) -> str:
        """
        Process a text block and convert to markdown with formatting

        Detects:
        - Headings based on font size
        - Bold text
        - Italic text
        - Lists
        - Code blocks (monospace fonts)
        """
        lines = []
        code_lines = []  # Buffer for consecutive code lines
        in_code_block = False

        for line in block.get("lines", []):
            line_text = ""
            max_font_size = 0
            is_bold = False
            is_italic = False
            is_code = False

            for span in line.get("spans", []):
                text = span.get("text", "")
                font_size = span.get("size", 12)
                font_name = span.get("font", "").lower()

                max_font_size = max(max_font_size, font_size)

                # Detect bold
                if "bold" in font_name or "black" in font_name:
                    is_bold = True

                # Detect italic
                if "italic" in font_name or "oblique" in font_name:
                    is_italic = True

                # Detect monospace/code fonts
                if self._is_monospace_font(font_name):
                    is_code = True

                line_text += text

            # Also detect code by content pattern if not detected by font
            if not is_code and self._looks_like_code(line_text):
                is_code = True

            line_text_stripped = line_text.strip()

            if not line_text_stripped:
                # Empty line - if we're in code block, add empty line to code
                if in_code_block:
                    code_lines.append("")
                continue

            # Handle code blocks
            if is_code:
                if not in_code_block:
                    # Starting a new code block - flush any previous content
                    in_code_block = True
                # Preserve original indentation for code
                code_lines.append(line_text.rstrip())
                continue
            else:
                # Not code - flush any accumulated code lines
                if in_code_block and code_lines:
                    lines.append(self._format_code_block(code_lines))
                    code_lines = []
                    in_code_block = False

            # Apply markdown formatting based on font size (typical heading sizes)
            if max_font_size >= 24:
                line_text_stripped = f"# {line_text_stripped}"
            elif max_font_size >= 18:
                line_text_stripped = f"## {line_text_stripped}"
            elif max_font_size >= 14:
                line_text_stripped = f"### {line_text_stripped}"
            else:
                # Apply bold/italic formatting
                if is_bold and is_italic:
                    line_text_stripped = f"***{line_text_stripped}***"
                elif is_bold:
                    line_text_stripped = f"**{line_text_stripped}**"
                elif is_italic:
                    line_text_stripped = f"*{line_text_stripped}*"

                # Detect list items
                line_text_stripped = self._detect_list_item(line_text_stripped)

            lines.append(line_text_stripped)

        # Flush remaining code lines at end of block
        if code_lines:
            lines.append(self._format_code_block(code_lines))

        return '\n'.join(lines)

    def _looks_like_code(self, text: str) -> bool:
        """
        Detect if text looks like code based on content patterns.
        This is a fallback when font detection doesn't work.
        """
        import re

        text_stripped = text.strip()
        if not text_stripped:
            return False

        # Strong indicators - if any match, it's very likely code
        strong_patterns = [
            # Python specific
            r'^def\s+\w+\s*\([^)]*\)\s*(->\s*\w+)?:',  # def func() -> Type:
            r'^class\s+\w+.*:',  # class Foo:
            r'^(from|import)\s+\w+',  # import/from
            r'^@\w+',  # @decorator
            r'^\s*if\s+.+:$',  # if condition:
            r'^\s*elif\s+.+:$',  # elif condition:
            r'^\s*else\s*:$',  # else:
            r'^\s*for\s+\w+\s+in\s+.+:',  # for x in ...:
            r'^\s*while\s+.+:',  # while ...:
            r'^\s*try\s*:',  # try:
            r'^\s*except.*:',  # except:
            r'^\s*finally\s*:',  # finally:
            r'^\s*with\s+.+:',  # with ...:
            r'^\s*return\s+',  # return
            r'^\s*yield\s+',  # yield
            r'^\s*raise\s+',  # raise
            r'^\s*pass\s*$',  # pass
            r'^\s*break\s*$',  # break
            r'^\s*continue\s*$',  # continue
            r'\w+\s*=\s*\[.*\]',  # list assignment
            r'\w+\s*=\s*\{.*\}',  # dict assignment
            r'\w+\s*=\s*\(.*\)',  # tuple assignment
            r'lambda\s+\w+\s*:',  # lambda
            r'map\s*\(.+\)',  # map()
            r'filter\s*\(.+\)',  # filter()
            r'list\s*\(.+\)',  # list()
            r'dict\s*\(.+\)',  # dict()
            r'range\s*\(.+\)',  # range()
            r'print\s*\(.+\)',  # print()
            r'input\s*\(.+\)',  # input()
            r'len\s*\(.+\)',  # len()
            r'\.split\s*\(',  # .split()
            r'\.join\s*\(',  # .join()
            r'\.append\s*\(',  # .append()
            r'int\s*\(.+\)',  # int()
            r'str\s*\(.+\)',  # str()
            r'float\s*\(.+\)',  # float()

            # JavaScript/TypeScript
            r'^(const|let|var)\s+\w+\s*=',
            r'^function\s+\w+\s*\(',
            r'^\s*=>\s*\{',
            r'console\.(log|error|warn)\s*\(',

            # Java/C#
            r'^(public|private|protected)\s+(static\s+)?(void|int|String|boolean)',
            r'^(public|private|protected)\s+class\s+\w+',

            # C/C++
            r'^#include\s*[<"]',
            r'^#define\s+\w+',
            r'^int\s+main\s*\(',
            r'printf\s*\(',
            r'cout\s*<<',

            # General
            r'^\s*//.*$',  # // comment
            r'^\s*#(?!#)\s*\w+',  # # comment (but not ## heading)
            r'^\s*/\*',  # /* comment
            r'^\s*\*/',  # */ end comment
        ]

        for pattern in strong_patterns:
            if re.search(pattern, text_stripped):
                logger.debug(f"Code pattern matched: {pattern} in '{text_stripped[:50]}...'")
                return True

        # Check for code-like characteristics
        code_indicators = 0

        # Has significant indentation (4+ spaces or tab at start)
        if re.match(r'^(\t|    +)', text):
            code_indicators += 3

        # Line ends with colon (Python)
        if text_stripped.endswith(':') and not text_stripped.startswith('#'):
            code_indicators += 2

        # Contains brackets/braces
        bracket_count = len(re.findall(r'[\{\}\[\]\(\)]', text_stripped))
        if bracket_count >= 2:
            code_indicators += 2
        elif bracket_count >= 1:
            code_indicators += 1

        # Contains operators common in code
        if re.search(r'[=!<>]=|&&|\|\||=>|->|\+\+|--|==|!=', text_stripped):
            code_indicators += 2

        # Contains semicolon at end (C-style)
        if text_stripped.endswith(';'):
            code_indicators += 2

        # Multiple assignment operators
        if text_stripped.count('=') >= 1 and re.search(r'\w+\s*=\s*\w+', text_stripped):
            code_indicators += 1

        # Contains common code symbols
        if re.search(r'[$@]\w+', text_stripped):  # $var, @decorator
            code_indicators += 2

        # Has snake_case identifiers (common in Python)
        if re.search(r'\b[a-z]+_[a-z_]+\b', text_stripped):
            code_indicators += 1

        # Contains string literals with quotes
        if re.search(r'["\'][^"\']+["\']', text_stripped):
            code_indicators += 1

        # Line is a comment (# followed by space and text)
        if re.match(r'^\s*#\s+\S', text_stripped):
            code_indicators += 2

        # Contains method/function call pattern
        if re.search(r'\w+\.\w+\(', text_stripped):
            code_indicators += 2

        # Threshold for considering it code
        if code_indicators >= 3:
            logger.debug(f"Code indicators: {code_indicators} for '{text_stripped[:50]}...'")
            return True

        return False

    def _is_monospace_font(self, font_name: str) -> bool:
        """Check if font is a monospace/code font"""
        monospace_fonts = [
            # Common code fonts
            'courier', 'consolas', 'monaco', 'menlo', 'inconsolata',
            'source code', 'sourcecodepro', 'fira code', 'firacode',
            'fira mono', 'firamono', 'dejavu mono', 'dejavumono',
            'liberation mono', 'liberationmono', 'droid mono', 'droidmono',
            'ubuntu mono', 'ubuntumono', 'roboto mono', 'robotomono',
            'jetbrains mono', 'jetbrainsmono', 'cascadia', 'hack',
            'mono', 'fixed', 'terminal', 'andale',
            # Korean fonts
            'd2coding', 'd2 coding', 'nanum gothic coding', 'nanumgothiccoding',
            '나눔고딕코딩', 'malgun gothic coding',
            # PDF embedded fonts often have weird names
            'cour', 'cmtt', 'cmsy', 'lmtt',  # TeX/LaTeX fonts
            'nixie', 'ocr', 'typewriter',
        ]
        font_lower = font_name.lower().replace(' ', '').replace('-', '').replace('_', '')

        # Log font for debugging
        logger.debug(f"Checking font: {font_name} -> {font_lower}")

        result = any(mono.replace(' ', '') in font_lower for mono in monospace_fonts)
        if result:
            logger.debug(f"  -> Detected as monospace!")
        return result

    def _format_code_block(self, code_lines: list) -> str:
        """Format accumulated code lines as a markdown code block"""
        if not code_lines:
            return ""

        # Try to detect language from content
        language = self._detect_code_language(code_lines)

        # Remove common leading whitespace (dedent)
        non_empty_lines = [line for line in code_lines if line.strip()]
        if non_empty_lines:
            min_indent = min(len(line) - len(line.lstrip()) for line in non_empty_lines)
            code_lines = [line[min_indent:] if len(line) >= min_indent else line for line in code_lines]

        # Remove trailing empty lines
        while code_lines and not code_lines[-1].strip():
            code_lines.pop()

        # Remove leading empty lines
        while code_lines and not code_lines[0].strip():
            code_lines.pop(0)

        code_content = '\n'.join(code_lines)
        return f"```{language}\n{code_content}\n```"

    def _detect_code_language(self, code_lines: list) -> str:
        """
        Detect programming language from code content using scoring system.
        Returns the language with highest confidence score.
        """
        import re

        code_text = '\n'.join(code_lines)
        code_lower = code_text.lower()

        # Score-based detection
        scores = {
            'python': 0,
            'javascript': 0,
            'typescript': 0,
            'java': 0,
            'c': 0,
            'cpp': 0,
            'csharp': 0,
            'go': 0,
            'rust': 0,
            'html': 0,
            'css': 0,
            'sql': 0,
            'bash': 0,
            'json': 0,
            'xml': 0,
            'yaml': 0,
            'markdown': 0,
        }

        # === Python (very specific patterns) ===
        if re.search(r'\bdef\s+\w+\s*\([^)]*\)\s*(->\s*\w+)?\s*:', code_text):
            scores['python'] += 10  # def func(): or def func() -> Type:
        if re.search(r'\bclass\s+\w+.*:', code_text):
            scores['python'] += 8
        if 'self.' in code_text or 'self,' in code_text:
            scores['python'] += 10  # Very Python-specific
        if '__init__' in code_text or '__name__' in code_text or '__main__' in code_text:
            scores['python'] += 10
        if re.search(r'^\s*@\w+', code_text, re.MULTILINE):  # Decorators
            scores['python'] += 5
        if re.search(r'\bif\s+.+:', code_text) or re.search(r'\bfor\s+\w+\s+in\s+', code_text):
            scores['python'] += 3  # Colon-based control flow
        if re.search(r'\belif\b', code_text):
            scores['python'] += 8  # elif is Python-only
        if re.search(r'\bexcept\s+\w+.*:', code_text):
            scores['python'] += 5
        if 'import ' in code_lower and ';' not in code_text:
            scores['python'] += 3
        if 'from ' in code_lower and ' import ' in code_lower:
            scores['python'] += 8  # from x import y
        if re.search(r'\bprint\s*\(', code_text):
            scores['python'] += 2
        if re.search(r'\bNone\b', code_text):
            scores['python'] += 3
        if re.search(r'\bTrue\b|\bFalse\b', code_text):
            scores['python'] += 2
        if re.search(r'\blambda\s+\w+\s*:', code_text):
            scores['python'] += 5

        # === JavaScript ===
        if re.search(r'\bconst\s+\w+\s*=', code_text):
            scores['javascript'] += 5
        if re.search(r'\blet\s+\w+\s*=', code_text):
            scores['javascript'] += 5
        if re.search(r'\bvar\s+\w+\s*=', code_text):
            scores['javascript'] += 3
        if re.search(r'\bfunction\s+\w+\s*\(', code_text):
            scores['javascript'] += 5
        if '=>' in code_text:
            scores['javascript'] += 5  # Arrow function
        if 'console.log' in code_text:
            scores['javascript'] += 8
        if re.search(r'\bdocument\.|window\.', code_text):
            scores['javascript'] += 8
        if re.search(r'require\s*\(', code_text):
            scores['javascript'] += 5
        if re.search(r'\bnull\b', code_text) and re.search(r'\bundefined\b', code_text):
            scores['javascript'] += 3
        if '===' in code_text or '!==' in code_text:
            scores['javascript'] += 5

        # === TypeScript ===
        if re.search(r':\s*(string|number|boolean|any|void)\b', code_text):
            scores['typescript'] += 8
        if re.search(r'\binterface\s+\w+\s*\{', code_text):
            scores['typescript'] += 10
        if re.search(r'\btype\s+\w+\s*=', code_text):
            scores['typescript'] += 8
        if '<T>' in code_text or '<T,' in code_text:
            scores['typescript'] += 3
        if scores['typescript'] > 0:
            scores['typescript'] += scores['javascript'] // 2  # TS inherits JS patterns

        # === Java ===
        if re.search(r'\bpublic\s+class\s+\w+', code_text):
            scores['java'] += 10
        if re.search(r'\bpublic\s+static\s+void\s+main', code_text):
            scores['java'] += 15
        if re.search(r'\bSystem\.out\.print', code_text):
            scores['java'] += 10
        if re.search(r'\bprivate\s+(static\s+)?(final\s+)?\w+\s+\w+', code_text):
            scores['java'] += 5
        if re.search(r'\bnew\s+\w+\s*\(', code_text) and ';' in code_text:
            scores['java'] += 3
        if re.search(r'@Override|@Autowired|@Component', code_text):
            scores['java'] += 8

        # === C ===
        if re.search(r'#include\s*<\w+\.h>', code_text):
            scores['c'] += 10
        if re.search(r'\bint\s+main\s*\(', code_text):
            scores['c'] += 8
        if re.search(r'\bprintf\s*\(', code_text):
            scores['c'] += 8
        if re.search(r'\bscanf\s*\(', code_text):
            scores['c'] += 8
        if re.search(r'\bmalloc\s*\(|\bfree\s*\(', code_text):
            scores['c'] += 5
        if re.search(r'\bstruct\s+\w+\s*\{', code_text):
            scores['c'] += 3

        # === C++ ===
        if re.search(r'#include\s*<\w+>', code_text) and not re.search(r'\.h>', code_text):
            scores['cpp'] += 5  # Modern C++ headers without .h
        if 'std::' in code_text:
            scores['cpp'] += 10
        if 'cout' in code_text or 'cin' in code_text:
            scores['cpp'] += 8
        if re.search(r'\bclass\s+\w+\s*\{', code_text) and ';' in code_text:
            scores['cpp'] += 5
        if '::' in code_text:
            scores['cpp'] += 3
        if re.search(r'\bnamespace\s+\w+', code_text):
            scores['cpp'] += 8
        if re.search(r'\btemplate\s*<', code_text):
            scores['cpp'] += 8
        scores['cpp'] += scores['c'] // 2  # C++ inherits C patterns

        # === C# ===
        if re.search(r'\busing\s+System', code_text):
            scores['csharp'] += 10
        if re.search(r'\bnamespace\s+\w+', code_text) and '{' in code_text:
            scores['csharp'] += 5
        if re.search(r'\bConsole\.(WriteLine|ReadLine)', code_text):
            scores['csharp'] += 10
        if re.search(r'\basync\s+Task', code_text):
            scores['csharp'] += 8
        if re.search(r'\bvar\s+\w+\s*=', code_text) and ';' in code_text:
            scores['csharp'] += 3

        # === Go ===
        if re.search(r'\bpackage\s+\w+', code_text):
            scores['go'] += 10
        if re.search(r'\bfunc\s+\w+\s*\(', code_text):
            scores['go'] += 8
        if re.search(r'\bfmt\.(Print|Println|Printf)', code_text):
            scores['go'] += 10
        if ':=' in code_text:
            scores['go'] += 8  # Go's short declaration
        if re.search(r'\bgo\s+\w+\(', code_text):
            scores['go'] += 5  # Goroutine
        if re.search(r'\bdefer\s+', code_text):
            scores['go'] += 8

        # === Rust ===
        if re.search(r'\bfn\s+\w+\s*\(', code_text):
            scores['rust'] += 8
        if re.search(r'\blet\s+mut\s+', code_text):
            scores['rust'] += 10  # Rust's mutable let
        if re.search(r'\bimpl\s+\w+', code_text):
            scores['rust'] += 10
        if re.search(r'\bpub\s+fn\s+', code_text):
            scores['rust'] += 8
        if 'println!' in code_text or 'vec!' in code_text:
            scores['rust'] += 10  # Rust macros
        if re.search(r'->\s*\w+', code_text) and '::' in code_text:
            scores['rust'] += 5

        # === HTML ===
        if re.search(r'<(!DOCTYPE|html|head|body|div|span|p|a|img)\b', code_text, re.IGNORECASE):
            scores['html'] += 10
        if re.search(r'</\w+>', code_text):
            scores['html'] += 5
        if re.search(r'<\w+\s+\w+="[^"]*"', code_text):
            scores['html'] += 3

        # === CSS ===
        if re.search(r'\{[^}]*:\s*[^;]+;[^}]*\}', code_text):
            scores['css'] += 5
        if re.search(r'\b(margin|padding|font-size|color|background|display)\s*:', code_text):
            scores['css'] += 8
        if re.search(r'\.([\w-]+)\s*\{', code_text):
            scores['css'] += 5  # Class selector
        if re.search(r'#[\w-]+\s*\{', code_text):
            scores['css'] += 5  # ID selector

        # === SQL ===
        if re.search(r'\bSELECT\s+.+\s+FROM\b', code_text, re.IGNORECASE):
            scores['sql'] += 15
        if re.search(r'\bINSERT\s+INTO\b', code_text, re.IGNORECASE):
            scores['sql'] += 10
        if re.search(r'\bCREATE\s+(TABLE|DATABASE|INDEX)\b', code_text, re.IGNORECASE):
            scores['sql'] += 10
        if re.search(r'\bWHERE\s+', code_text, re.IGNORECASE):
            scores['sql'] += 5
        if re.search(r'\bJOIN\s+', code_text, re.IGNORECASE):
            scores['sql'] += 5

        # === Bash/Shell ===
        if re.search(r'^#!/bin/(bash|sh|zsh)', code_text, re.MULTILINE):
            scores['bash'] += 15
        if re.search(r'^\$\s+\w+', code_text, re.MULTILINE):
            scores['bash'] += 5
        if re.search(r'\b(sudo|apt|yum|brew|npm|pip|git|docker|kubectl)\s+', code_text):
            scores['bash'] += 5
        if re.search(r'\becho\s+', code_text):
            scores['bash'] += 3
        if re.search(r'\bexport\s+\w+=', code_text):
            scores['bash'] += 5
        if re.search(r'\$\{\w+\}|\$\w+', code_text):
            scores['bash'] += 3

        # === JSON ===
        stripped = code_text.strip()
        if (stripped.startswith('{') and stripped.endswith('}')) or \
           (stripped.startswith('[') and stripped.endswith(']')):
            if re.search(r'"\w+"\s*:', code_text):
                scores['json'] += 15

        # === XML ===
        if re.search(r'<\?xml\s+version=', code_text):
            scores['xml'] += 15
        if re.search(r'<\w+[^>]*>[^<]*</\w+>', code_text) and '<html' not in code_lower:
            scores['xml'] += 5

        # === YAML ===
        if re.search(r'^\w+:\s*$', code_text, re.MULTILINE):
            scores['yaml'] += 5
        if re.search(r'^\s*-\s+\w+:', code_text, re.MULTILINE):
            scores['yaml'] += 8
        if re.search(r'^\w+:\s+\w+', code_text, re.MULTILINE) and '{' not in code_text:
            scores['yaml'] += 3

        # Find language with highest score
        max_score = max(scores.values())
        if max_score < 5:
            return ""  # Not confident enough

        best_lang = max(scores, key=scores.get)

        # Log for debugging
        top_scores = sorted(scores.items(), key=lambda x: -x[1])[:3]
        logger.debug(f"Language detection scores: {top_scores}")

        return best_lang

    def _detect_list_item(self, text: str) -> str:
        """Detect and convert list items to markdown format"""
        import re

        # Bullet points: •, -, *, ○, ●, ■, □
        bullet_pattern = r'^[\•\-\*\○\●\■\□]\s*(.+)$'
        match = re.match(bullet_pattern, text)
        if match:
            return f"- {match.group(1)}"

        # Numbered lists: 1., 1), (1), a., a)
        number_pattern = r'^(\d+[\.\)]\s*|\(\d+\)\s*|[a-zA-Z][\.\)]\s*)(.+)$'
        match = re.match(number_pattern, text)
        if match:
            return f"1. {match.group(2)}"  # Markdown will auto-number

        return text

    def _extract_image_from_block(self, page, block: dict, page_num: int,
                                   img_num: int, images_dir: Path,
                                   doc_name: str) -> Optional[str]:
        """Extract image from PDF block and save to file"""
        try:
            import fitz

            # Create images directory if needed
            images_dir.mkdir(parents=True, exist_ok=True)

            # Get image from page
            xref = block.get("xref", 0)
            if xref == 0:
                return None

            # Extract image
            base_image = page.parent.extract_image(xref)
            if not base_image:
                return None

            image_bytes = base_image["image"]
            image_ext = base_image.get("ext", "png")

            # Save image
            image_filename = f"{doc_name}_p{page_num}_img{img_num}.{image_ext}"
            image_path = images_dir / image_filename

            with open(image_path, "wb") as f:
                f.write(image_bytes)

            logger.info(f"Extracted image: {image_path}")

            # Return relative path for markdown
            return f"./{images_dir.name}/{image_filename}"

        except Exception as e:
            logger.warning(f"Failed to extract image: {e}")
            return None

    def _extract_tables_from_page(self, pdf_path: str, page_idx: int) -> list:
        """Extract tables from a specific page using pdfplumber"""
        try:
            import pdfplumber

            tables_md = []

            with pdfplumber.open(pdf_path) as pdf:
                if page_idx < len(pdf.pages):
                    page = pdf.pages[page_idx]
                    tables = page.extract_tables()

                    for table in tables:
                        if table and len(table) > 0:
                            md_table = self._table_to_markdown(table)
                            if md_table:
                                tables_md.append(md_table)

            return tables_md

        except ImportError:
            return []
        except Exception as e:
            logger.warning(f"Table extraction failed: {e}")
            return []

    def _table_to_markdown(self, table: list) -> str:
        """Convert table data to markdown table format"""
        if not table or len(table) < 1:
            return ""

        md_lines = []

        # Clean up cells
        cleaned_table = []
        for row in table:
            cleaned_row = []
            for cell in row:
                cell_text = str(cell) if cell else ""
                # Replace newlines and pipes in cells
                cell_text = cell_text.replace('\n', ' ').replace('|', '\\|').strip()
                cleaned_row.append(cell_text)
            cleaned_table.append(cleaned_row)

        if not cleaned_table:
            return ""

        # Header row
        header = cleaned_table[0]
        md_lines.append("| " + " | ".join(header) + " |")

        # Separator row
        separator = "| " + " | ".join(["---"] * len(header)) + " |"
        md_lines.append(separator)

        # Data rows
        for row in cleaned_table[1:]:
            # Pad row if needed
            while len(row) < len(header):
                row.append("")
            md_lines.append("| " + " | ".join(row[:len(header)]) + " |")

        return '\n'.join(md_lines)

    def _process_text_with_code_detection(self, lines: list) -> str:
        """
        Process text lines and detect code blocks based on content patterns.
        Groups consecutive code lines into code blocks.
        """
        import re

        result_lines = []
        code_buffer = []
        in_code_block = False

        for line in lines:
            # Skip empty lines but preserve them in code blocks
            if not line.strip():
                if in_code_block:
                    code_buffer.append("")
                else:
                    result_lines.append("")
                continue

            # Check if this line looks like code
            is_code = self._looks_like_code(line)

            if is_code:
                if not in_code_block:
                    in_code_block = True
                code_buffer.append(line)
            else:
                # Flush code buffer if we were in a code block
                if in_code_block and code_buffer:
                    formatted_code = self._format_code_block(code_buffer)
                    result_lines.append(formatted_code)
                    code_buffer = []
                    in_code_block = False

                # Add regular line (but don't treat # as heading if it's likely a code comment)
                result_lines.append(line)

        # Flush remaining code buffer
        if code_buffer:
            formatted_code = self._format_code_block(code_buffer)
            result_lines.append(formatted_code)

        return '\n'.join(result_lines)

    def _detect_repeated_headers_footers(self, pages_content: list) -> dict:
        """
        Detect repeated headers and footers across multiple pages.

        Args:
            pages_content: List of page contents, each being a list of lines

        Returns:
            dict with 'headers' and 'footers' sets of repeated text patterns
        """
        import re

        if len(pages_content) < 2:
            return {'headers': set(), 'footers': set(), 'page_numbers': set()}

        # Collect first N and last N lines from each page
        NUM_LINES_TO_CHECK = 3

        page_headers = []  # List of sets of header lines per page
        page_footers = []  # List of sets of footer lines per page

        for page_lines in pages_content:
            if not page_lines:
                page_headers.append(set())
                page_footers.append(set())
                continue

            # Get first few non-empty lines (potential headers)
            headers = set()
            count = 0
            for line in page_lines:
                if line.strip():
                    # Normalize the line (remove page numbers)
                    normalized = self._normalize_for_comparison(line)
                    if normalized:
                        headers.add(normalized)
                    count += 1
                    if count >= NUM_LINES_TO_CHECK:
                        break
            page_headers.append(headers)

            # Get last few non-empty lines (potential footers)
            footers = set()
            count = 0
            for line in reversed(page_lines):
                if line.strip():
                    normalized = self._normalize_for_comparison(line)
                    if normalized:
                        footers.add(normalized)
                    count += 1
                    if count >= NUM_LINES_TO_CHECK:
                        break
            page_footers.append(footers)

        # Find lines that appear in most pages (threshold: 50%+)
        threshold = len(pages_content) // 2

        # Count header occurrences
        header_counts = {}
        for headers in page_headers:
            for h in headers:
                header_counts[h] = header_counts.get(h, 0) + 1

        # Count footer occurrences
        footer_counts = {}
        for footers in page_footers:
            for f in footers:
                footer_counts[f] = footer_counts.get(f, 0) + 1

        repeated_headers = {h for h, count in header_counts.items() if count > threshold}
        repeated_footers = {f for f, count in footer_counts.items() if count > threshold}

        logger.debug(f"Detected repeated headers: {repeated_headers}")
        logger.debug(f"Detected repeated footers: {repeated_footers}")

        return {
            'headers': repeated_headers,
            'footers': repeated_footers
        }

    def _normalize_for_comparison(self, text: str) -> str:
        """
        Normalize text for comparison, removing page numbers and dates.
        Returns empty string if the line is just a page number.
        """
        import re

        text = text.strip()

        # Check if line is just a page number - remove entirely
        page_number_patterns = [
            r'^-?\s*\d+\s*-?$',  # Just number: "1", "- 1 -", "-1-"
            r'^page\s*\d+$',  # "Page 1"
            r'^\d+\s*/\s*\d+$',  # "1 / 10"
            r'^p\.?\s*\d+$',  # "p.1", "p 1"
            r'^\d+\s*페이지$',  # Korean: "1 페이지"
            r'^제?\s*\d+\s*쪽$',  # Korean: "제 1 쪽"
        ]

        for pattern in page_number_patterns:
            if re.match(pattern, text, re.IGNORECASE):
                return ""  # This is just a page number, ignore it

        # Remove page numbers from within text
        text = re.sub(r'\s*-?\s*\d+\s*-?\s*$', '', text)  # Trailing page number
        text = re.sub(r'^\s*-?\s*\d+\s*-?\s*', '', text)  # Leading page number
        text = re.sub(r'\s*page\s*\d+\s*', ' ', text, flags=re.IGNORECASE)
        text = re.sub(r'\s*\d+\s*/\s*\d+\s*', ' ', text)

        # Remove dates
        date_patterns = [
            r'\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}',  # 2024-01-01
            r'\d{1,2}[-/\.]\d{1,2}[-/\.]\d{4}',  # 01-01-2024
            r'\d{4}년\s*\d{1,2}월\s*\d{1,2}일',  # Korean date
        ]
        for pattern in date_patterns:
            text = re.sub(pattern, '', text)

        return text.strip()

    def _is_page_number_line(self, text: str) -> bool:
        """Check if a line is just a page number."""
        import re

        text = text.strip()
        if not text:
            return False

        page_number_patterns = [
            r'^-?\s*\d+\s*-?$',
            r'^page\s*\d+$',
            r'^\d+\s*/\s*\d+$',
            r'^p\.?\s*\d+$',
            r'^\d+\s*페이지$',
            r'^제?\s*\d+\s*쪽$',
        ]

        for pattern in page_number_patterns:
            if re.match(pattern, text, re.IGNORECASE):
                return True
        return False

    def _filter_repeated_content(self, pages_content: list) -> list:
        """
        Filter out repeated headers/footers from pages.
        Keeps first occurrence of repeated headers, removes all page numbers.

        Args:
            pages_content: List of page contents, each being a list of lines

        Returns:
            Filtered list of page contents
        """
        if len(pages_content) < 2:
            return pages_content

        # Detect repeated patterns
        repeated = self._detect_repeated_headers_footers(pages_content)
        repeated_headers = repeated['headers']
        repeated_footers = repeated['footers']

        # Track which repeated headers we've already included
        included_headers = set()

        filtered_pages = []

        for page_idx, page_lines in enumerate(pages_content):
            filtered_lines = []

            for line in page_lines:
                # Skip page number lines
                if self._is_page_number_line(line):
                    continue

                # Check if this is a repeated header/footer
                normalized = self._normalize_for_comparison(line)

                if normalized in repeated_headers:
                    if normalized not in included_headers:
                        # First occurrence - keep it
                        included_headers.add(normalized)
                        filtered_lines.append(line)
                    # else: skip duplicate header
                elif normalized in repeated_footers:
                    # Skip repeated footers (usually copyright, page info etc.)
                    continue
                else:
                    filtered_lines.append(line)

            filtered_pages.append(filtered_lines)

        return filtered_pages

    def _pdf_to_markdown_pdfplumber(self, pdf_path: str) -> Tuple[bool, str, str]:
        """
        Fallback: Convert PDF to Markdown using pdfplumber
        Uses BBox-based header/footer filtering and cross-page code block detection.
        """
        try:
            import pdfplumber

            markdown_lines = []

            # State for cross-page code block detection
            in_code_block = False
            code_buffer = []

            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)

                # Define header/footer regions - only for multi-page documents
                use_filtering = total_pages > 2

                for page_num, page in enumerate(pdf.pages, 1):
                    page_height = page.height

                    if use_filtering:
                        # Use conservative thresholds (top 5%, bottom 5%)
                        header_threshold = page_height * 0.05
                        footer_threshold = page_height * 0.95
                    else:
                        # No filtering for short documents
                        header_threshold = 0
                        footer_threshold = page_height

                    # Extract tables first (with BBox filtering)
                    tables = page.extract_tables()
                    for table in tables:
                        if table and len(table) > 0:
                            # Flush code buffer before table
                            if in_code_block and code_buffer:
                                markdown_lines.append(self._format_code_block(code_buffer))
                                code_buffer = []
                                in_code_block = False

                            md_table = self._table_to_markdown(table)
                            if md_table:
                                markdown_lines.append(f"\n{md_table}\n")

                    # Extract text with position info using chars
                    chars = page.chars
                    if chars:
                        # Group chars into lines by y-position
                        lines_by_y = {}
                        for char in chars:
                            y = round(char['top'], 1)  # Round to group nearby chars
                            if y not in lines_by_y:
                                lines_by_y[y] = []
                            lines_by_y[y].append(char)

                        # Sort by y position and process each line
                        for y in sorted(lines_by_y.keys()):
                            # Skip header/footer regions (only if filtering enabled)
                            if use_filtering and y < header_threshold and not in_code_block:
                                continue
                            if use_filtering and y > footer_threshold and not in_code_block:
                                continue

                            # Build line text from chars
                            line_chars = sorted(lines_by_y[y], key=lambda c: c['x0'])
                            line_text = ''.join(c['text'] for c in line_chars)

                            # Check if this line looks like code
                            is_code = self._looks_like_code(line_text)

                            # Check font (if available)
                            fonts = set(c.get('fontname', '') for c in line_chars)
                            for font in fonts:
                                if self._is_monospace_font(font.lower()):
                                    is_code = True
                                    break

                            if is_code:
                                if not in_code_block:
                                    in_code_block = True
                                code_buffer.append(line_text.rstrip())
                            else:
                                # Flush code buffer
                                if in_code_block and code_buffer:
                                    markdown_lines.append(self._format_code_block(code_buffer))
                                    code_buffer = []
                                    in_code_block = False

                                # Add regular line
                                if line_text.strip():
                                    markdown_lines.append(line_text.strip())

                    else:
                        # Fallback: extract_text without position info
                        text = page.extract_text()
                        if text:
                            for line in text.split('\n'):
                                is_code = self._looks_like_code(line)

                                if is_code:
                                    if not in_code_block:
                                        in_code_block = True
                                    code_buffer.append(line.rstrip())
                                else:
                                    if in_code_block and code_buffer:
                                        markdown_lines.append(self._format_code_block(code_buffer))
                                        code_buffer = []
                                        in_code_block = False

                                    if line.strip():
                                        markdown_lines.append(line.strip())

                    # Add page separator (but not if we're in a code block)
                    if page_num < total_pages and not in_code_block:
                        markdown_lines.append("\n---\n")

            # Flush remaining code buffer
            if code_buffer:
                markdown_lines.append(self._format_code_block(code_buffer))

            markdown_content = '\n'.join(markdown_lines)

            # Clean up excessive newlines
            import re
            markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content)

            logger.info(f"PDF converted to markdown with pdfplumber: {pdf_path}")

            return True, markdown_content.strip(), ""

        except ImportError as e:
            error_msg = "pdfplumber가 설치되지 않았습니다.\n\npip install pdfplumber"
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
