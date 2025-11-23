# Third-Party Licenses and Attributions

This document lists all open-source software (OSS) used in the Saekim project, along with their respective licenses and attributions.

**Important Notice**: This project complies with all license requirements of the dependencies listed below. Proper attribution is provided as required by each license.

---

## Project License

**Saekim (새김) - Markdown Editor**
- **License**: GNU General Public License v3.0 (GPL-3.0)
- **Reason**: This project uses PyQt6, which is licensed under GPL-3.0. Therefore, the entire project must also be GPL-3.0 licensed.
- **Copyright**: © 2024 Saekim Contributors

---

## Python Dependencies

### Desktop Framework

#### 1. PyQt6
- **Version**: ≥6.6.0
- **License**: GNU General Public License v3.0 (GPL-3.0)
- **Homepage**: https://www.riverbankcomputing.com/software/pyqt/
- **Repository**: https://github.com/Python-PyQt/PyQt6
- **Copyright**: © Riverbank Computing Limited
- **Usage**: Desktop application framework and GUI widgets

#### 2. PyQt6-WebEngine
- **Version**: ≥6.6.0
- **License**: GNU General Public License v3.0 (GPL-3.0)
- **Homepage**: https://www.riverbankcomputing.com/software/pyqt/
- **Repository**: https://github.com/Python-PyQt/PyQt6-WebEngine
- **Copyright**: © Riverbank Computing Limited
- **Usage**: Chromium-based web engine for rendering markdown preview

---

### PDF Processing

#### 3. Playwright
- **Version**: ≥1.40.0
- **License**: Apache License 2.0
- **Homepage**: https://playwright.dev/python/
- **Repository**: https://github.com/microsoft/playwright-python
- **Copyright**: © Microsoft Corporation
- **Usage**: Headless browser automation for PDF generation (Markdown → PDF export)

#### 4. pdfplumber
- **Version**: ≥0.11.0
- **License**: MIT License
- **Homepage**: https://github.com/jsvine/pdfplumber
- **Repository**: https://github.com/jsvine/pdfplumber
- **Copyright**: © Jeremy Singer-Vine
- **Usage**: Extracting text and data from PDF files (PDF → Markdown conversion)

#### 5. PyPDF2
- **Version**: ≥3.0.0
- **License**: BSD 3-Clause License
- **Homepage**: https://pypdf2.readthedocs.io/
- **Repository**: https://github.com/py-pdf/pypdf
- **Copyright**: © 2006-2008 Mathieu Fenniak, © 2022 Matthew Stamy and contributors
- **Usage**: PDF manipulation and metadata extraction

---

### DOCX Processing

#### 6. python-docx
- **Version**: ≥1.1.0
- **License**: MIT License
- **Homepage**: https://python-docx.readthedocs.io/
- **Repository**: https://github.com/python-openxml/python-docx
- **Copyright**: © 2013 Steve Canny
- **Usage**: Creating and updating Microsoft Word (.docx) files

---

### Image Processing

#### 7. Pillow
- **Version**: ≥10.2.0
- **License**: HPND License (Historical Permission Notice and Disclaimer)
- **Homepage**: https://python-pillow.org/
- **Repository**: https://github.com/python-pillow/Pillow
- **Copyright**: © 1997-2011 Secret Labs AB, © 1995-2011 Fredrik Lundh, © 2010-2024 Jeffrey A. Clark (Alex) and contributors
- **Usage**: Image file I/O and manipulation

---

### HTML Parsing

#### 8. beautifulsoup4
- **Version**: ≥4.12.0
- **License**: MIT License
- **Homepage**: https://www.crummy.com/software/BeautifulSoup/
- **Repository**: https://code.launchpad.net/beautifulsoup
- **Copyright**: © 2004-2024 Leonard Richardson
- **Usage**: HTML/XML parsing and sanitization

#### 9. lxml
- **Version**: ≥4.9.0
- **License**: BSD 3-Clause License
- **Homepage**: https://lxml.de/
- **Repository**: https://github.com/lxml/lxml
- **Copyright**: © 2004 Infrae, © 2024 lxml developers
- **Usage**: Fast XML and HTML parsing

---

### Utilities

#### 10. python-dateutil
- **Version**: ≥2.8.0
- **License**: Apache License 2.0 / BSD 3-Clause License (Dual License)
- **Homepage**: https://dateutil.readthedocs.io/
- **Repository**: https://github.com/dateutil/dateutil
- **Copyright**: © 2003-2011 Gustavo Niemeyer, © 2012-2014 Tomi Pieviläinen, © 2014-2024 Paul Ganssle and contributors
- **Usage**: Date and time utilities

---

## Development Dependencies

### Testing

#### 11. pytest
- **Version**: 7.4.3
- **License**: MIT License
- **Homepage**: https://pytest.org/
- **Repository**: https://github.com/pytest-dev/pytest
- **Copyright**: © 2004 Holger Krekel and contributors
- **Usage**: Testing framework

#### 12. pytest-cov
- **Version**: 4.1.0
- **License**: MIT License
- **Homepage**: https://github.com/pytest-dev/pytest-cov
- **Repository**: https://github.com/pytest-dev/pytest-cov
- **Copyright**: © 2010 Meme Dough
- **Usage**: Code coverage plugin for pytest

#### 13. pytest-qt
- **Version**: 4.2.0
- **License**: MIT License
- **Homepage**: https://github.com/pytest-dev/pytest-qt
- **Repository**: https://github.com/pytest-dev/pytest-qt
- **Copyright**: © 2014 Bruno Oliveira
- **Usage**: PyQt/PySide testing utilities

---

### Code Quality

#### 14. black
- **Version**: 23.12.0
- **License**: MIT License
- **Homepage**: https://black.readthedocs.io/
- **Repository**: https://github.com/psf/black
- **Copyright**: © 2018 Łukasz Langa
- **Usage**: Code formatter

#### 15. pylint
- **Version**: 3.0.3
- **License**: GNU General Public License v2.0 (GPL-2.0)
- **Homepage**: https://pylint.pycqa.org/
- **Repository**: https://github.com/PyCQA/pylint
- **Copyright**: © 2003-2024 LOGILAB S.A.
- **Usage**: Code linter and static analysis

#### 16. mypy
- **Version**: 1.7.1
- **License**: MIT License
- **Homepage**: http://www.mypy-lang.org/
- **Repository**: https://github.com/python/mypy
- **Copyright**: © 2015-2024 Dropbox, Inc.
- **Usage**: Static type checker

#### 17. flake8
- **Version**: 6.1.0
- **License**: MIT License
- **Homepage**: https://flake8.pycqa.org/
- **Repository**: https://github.com/PyCQA/flake8
- **Copyright**: © 2011-2013 Tarek Ziade, © 2012-2016 Ian Cordasco
- **Usage**: Style guide enforcement

---

### Documentation

#### 18. sphinx
- **Version**: 7.2.6
- **License**: BSD 2-Clause License
- **Homepage**: https://www.sphinx-doc.org/
- **Repository**: https://github.com/sphinx-doc/sphinx
- **Copyright**: © 2007-2024 the Sphinx team
- **Usage**: Documentation generator

---

## JavaScript Dependencies

These JavaScript libraries are used in the web-based editor interface:

### Editor and Rendering

#### 19. CodeMirror 6
- **Version**: 6.x
- **License**: MIT License
- **Homepage**: https://codemirror.net/
- **Repository**: https://github.com/codemirror/dev
- **Copyright**: © 2018-2024 Marijn Haverbeke and contributors
- **Usage**: Code editor component for markdown editing

#### 20. Marked.js
- **Version**: 11.x
- **License**: MIT License
- **Homepage**: https://marked.js.org/
- **Repository**: https://github.com/markedjs/marked
- **Copyright**: © 2011-2024 Christopher Jeffrey and contributors
- **Usage**: Markdown parser and compiler

#### 21. Highlight.js
- **Version**: 11.x
- **License**: BSD 3-Clause License
- **Homepage**: https://highlightjs.org/
- **Repository**: https://github.com/highlightjs/highlight.js
- **Copyright**: © 2006 Ivan Sagalaev and contributors
- **Usage**: Syntax highlighting for code blocks

#### 22. Mermaid.js
- **Version**: 10.x
- **License**: MIT License
- **Homepage**: https://mermaid.js.org/
- **Repository**: https://github.com/mermaid-js/mermaid
- **Copyright**: © 2014-2024 Knut Sveidqvist and contributors
- **Usage**: Diagram and flowchart generation

#### 23. KaTeX
- **Version**: 0.16.x
- **License**: MIT License
- **Homepage**: https://katex.org/
- **Repository**: https://github.com/KaTeX/KaTeX
- **Copyright**: © 2013-2020 Khan Academy and other contributors
- **Usage**: Fast math typesetting for LaTeX equations

#### 24. DOMPurify
- **Version**: 3.x
- **License**: Apache License 2.0 / Mozilla Public License 2.0 (Dual License)
- **Homepage**: https://github.com/cure53/DOMPurify
- **Repository**: https://github.com/cure53/DOMPurify
- **Copyright**: © 2015-2024 Mario Heiderich and contributors
- **Usage**: XSS sanitizer for HTML content

---

## License Compatibility

### GPL-3.0 Compatibility
This project is licensed under GPL-3.0 due to PyQt6's license requirements. All dependencies listed above are compatible with GPL-3.0:

- **GPL-3.0/GPL-2.0**: Compatible (PyQt6, PyQt6-WebEngine, pylint)
- **MIT License**: Compatible (most dependencies)
- **BSD Licenses**: Compatible (PyPDF2, lxml, sphinx, Highlight.js)
- **Apache 2.0**: Compatible (Playwright, python-dateutil, DOMPurify)
- **HPND**: Compatible (Pillow)
- **MPL 2.0**: Compatible (DOMPurify)

### Commercial Use Note
While this project is GPL-3.0 licensed (due to PyQt6), for commercial/proprietary use, consider:
1. Using **PySide6** (Qt for Python) instead of PyQt6 - it's LGPL-3.0 licensed
2. Obtaining a commercial Qt license from The Qt Company

---

## How to Comply with Licenses

### For GPL-3.0 (PyQt6, PyQt6-WebEngine)
1. This entire project is GPL-3.0 licensed
2. Source code is publicly available at the repository URL
3. LICENSE file includes full GPL-3.0 text
4. This LICENSES.md file provides proper attribution

### For MIT/BSD/Apache Libraries
1. Original copyright notices are preserved (see above)
2. License texts are included in this document
3. No warranty disclaimers are acknowledged

### For JavaScript Libraries
All JavaScript libraries will be included via CDN or bundled with proper:
1. Copyright headers preserved in source files
2. LICENSE files included in distribution
3. Attribution in application's About dialog

---

## Full License Texts

### GNU General Public License v3.0
The full text of GPL-3.0 is available at:
- https://www.gnu.org/licenses/gpl-3.0.html
- In the project's LICENSE file

### MIT License
Copyright (c) [year] [copyright holder]

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
SOFTWARE.

### BSD 3-Clause License
Copyright (c) [year] [copyright holder]

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### Apache License 2.0
Copyright [yyyy] [name of copyright owner]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-11-08 | 1.0.0 | Initial license documentation with all current dependencies |
| 2025-11-23 | 1.1.0 | WeasyPrint → Playwright 변경, DOMPurify 추가 |

---

## Contact

For questions about licensing or attribution:
- Project Repository: https://github.com/beeean17/Saekim
- Issues: https://github.com/beeean17/Saekim/issues

---

**Last Updated**: 2025-11-23
