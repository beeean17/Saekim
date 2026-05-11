"""
License Data Module
Contains license information for Saekim and its dependencies
"""

LICENSE_GPL_3 = """GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
Everyone is permitted to copy and distribute verbatim copies
of this license document, but changing it is not allowed.

(Full license text should be here. For brevity in this window, please refer to the LICENSE file included with the distribution or visit https://www.gnu.org/licenses/gpl-3.0.html)
"""

LICENSE_MIT = """MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""

LICENSE_APACHE_2 = """Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

(Full license text should be here. For brevity, please visit http://www.apache.org/licenses/LICENSE-2.0)"""

LICENSE_AGPL_3 = """GNU AFFERO GENERAL PUBLIC LICENSE
Version 3, 19 November 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
Everyone is permitted to copy and distribute verbatim copies
of this license document, but changing it is not allowed.

(Full license text should be here. For brevity, please visit https://www.gnu.org/licenses/agpl-3.0.html)"""

PROJECT_INFO = {
    "name": "Saekim (새김)",
    "version": "1.2.0",
    "description": "Code and diagram focused local Markdown Editor",
    "copyright": "Copyright © 2025 Saekim Team",
    "license": "AGPL-3.0",
    "source_url": "https://github.com/beeean17/Saekim"
}

DEPENDENCIES = [
    {
        "name": "PyQt6",
        "license": "GPL-3.0",
        "description": "GUI Framework",
        "copyright": "Copyright (c) Riverbank Computing Limited",
        "url": "https://www.riverbankcomputing.com/software/pyqt/",
        "license_text": LICENSE_GPL_3
    },
    {
        "name": "PyQt6-WebEngine",
        "license": "GPL-3.0",
        "description": "Web Engine for PyQt6",
        "copyright": "Copyright (c) Riverbank Computing Limited",
        "url": "https://pypi.org/project/PyQt6-WebEngine/",
        "license_text": LICENSE_GPL_3
    },
    {
        "name": "PyMuPDF (fitz)",
        "license": "AGPL-3.0",
        "description": "PDF processing library",
        "copyright": "Copyright (c) Artifex Software, Inc.",
        "url": "https://pymupdf.readthedocs.io/",
        "license_text": LICENSE_AGPL_3
    },
    {
        "name": "pdfplumber",
        "license": "MIT",
        "description": "Plumb a PDF for detailed information",
        "copyright": "Copyright (c) Jeremy Singer-Vine",
        "url": "https://github.com/jsvine/pdfplumber",
        "license_text": LICENSE_MIT
    },

    {
        "name": "Markdown",
        "license": "BSD-3-Clause",
        "description": "Python Markdown parser",
        "copyright": "Copyright (c) Waylan Limberg",
        "url": "https://python-markdown.github.io/",
        "license_text": "BSD 3-Clause License (See project URL for details)"
    },
    {
        "name": "Highlight.js",
        "license": "BSD-3-Clause",
        "description": "Syntax highlighting for the Web",
        "copyright": "Copyright (c) 2006, Ivan Sagalaev",
        "url": "https://highlightjs.org/",
        "license_text": "BSD 3-Clause License (See project URL for details)"
    },
    {
        "name": "Mermaid.js",
        "license": "MIT",
        "description": "Diagramming and charting tool",
        "copyright": "Copyright (c) Knut Sveidqvist",
        "url": "https://mermaid.js.org/",
        "license_text": LICENSE_MIT
    },
     {
        "name": "DOMPurify",
        "license": "Apache-2.0 / MPL-2.0",
        "description": "DOM-only, super-fast, uber-tolerant XSS sanitizer",
        "copyright": "Copyright (c) Dr.-Ing. Mario Heiderich, Cure53",
        "url": "https://github.com/cure53/DOMPurify",
        "license_text": LICENSE_APACHE_2
    }
]
