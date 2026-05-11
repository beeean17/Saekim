# Third-Party Licenses and Attributions

This document lists all open-source software (OSS) used in the Saekim project, along with their respective licenses and attributions.

---

## Project License

**Saekim (새김) - Markdown Editor**
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0)
- **Reason**: This project uses PyMuPDF (fitz), which is licensed under AGPL-3.0.
- **Copyright**: © 2025 윤성빈 (Yoon Seongbin)

---

## Python Dependencies

### Desktop Framework

#### 1. PyQt6
- **Version**: ≥6.6.0
- **License**: GNU General Public License v3.0 (GPL-3.0)
- **Homepage**: https://www.riverbankcomputing.com/software/pyqt/
- **Copyright**: © Riverbank Computing Limited
- **Usage**: Desktop application framework and GUI widgets

#### 2. PyQt6-WebEngine
- **Version**: ≥6.6.0
- **License**: GNU General Public License v3.0 (GPL-3.0)
- **Homepage**: https://www.riverbankcomputing.com/software/pyqt/
- **Copyright**: © Riverbank Computing Limited
- **Usage**: Chromium-based web engine for rendering markdown preview and PDF export

---

### PDF Processing

#### 3. PyMuPDF (fitz)
- **Version**: ≥1.24.0
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0)
- **Homepage**: https://pymupdf.readthedocs.io/
- **Repository**: https://github.com/pymupdf/PyMuPDF
- **Copyright**: © Artifex Software, Inc.
- **Usage**: PDF → Markdown conversion, text extraction
- **Note**: This is the primary reason the project uses AGPL-3.0 license

#### 4. pdfplumber
- **Version**: ≥0.11.0
- **License**: MIT License
- **Homepage**: https://github.com/jsvine/pdfplumber
- **Copyright**: © Jeremy Singer-Vine
- **Usage**: Extracting tables from PDF files

---

### Markdown Processing

#### 5. Markdown
- **Version**: ≥3.5.0
- **License**: BSD 3-Clause License
- **Homepage**: https://python-markdown.github.io/
- **Repository**: https://github.com/Python-Markdown/markdown
- **Copyright**: © 2007-2024 The Python Markdown Project
- **Usage**: Server-side Markdown to HTML conversion

---

## JavaScript Dependencies (CDN)

These JavaScript libraries are loaded via CDN in the web-based editor interface:

### Markdown & Rendering

#### 6. Marked.js
- **Version**: 11.1.0
- **License**: MIT License
- **Homepage**: https://marked.js.org/
- **Repository**: https://github.com/markedjs/marked
- **Copyright**: © 2011-2024 Christopher Jeffrey and contributors
- **Usage**: Client-side Markdown parser and compiler

#### 7. Highlight.js
- **Version**: 11.9.0
- **License**: BSD 3-Clause License
- **Homepage**: https://highlightjs.org/
- **Repository**: https://github.com/highlightjs/highlight.js
- **Copyright**: © 2006 Ivan Sagalaev and contributors
- **Usage**: Syntax highlighting for code blocks

#### 8. Mermaid.js
- **Version**: 10.6.1
- **License**: MIT License
- **Homepage**: https://mermaid.js.org/
- **Repository**: https://github.com/mermaid-js/mermaid
- **Copyright**: © 2014-2024 Knut Sveidqvist and contributors
- **Usage**: Diagram and flowchart generation

#### 9. KaTeX
- **Version**: 0.16.9
- **License**: MIT License
- **Homepage**: https://katex.org/
- **Repository**: https://github.com/KaTeX/KaTeX
- **Copyright**: © 2013-2020 Khan Academy and other contributors
- **Usage**: Fast math typesetting for LaTeX equations

#### 10. DOMPurify
- **Version**: 3.0.6
- **License**: Apache License 2.0 / Mozilla Public License 2.0 (Dual License)
- **Homepage**: https://github.com/cure53/DOMPurify
- **Copyright**: © 2015-2024 Mario Heiderich and contributors
- **Usage**: XSS sanitizer for HTML content

---

## Fonts

### 11. Pretendard
- **Version**: 1.3.9
- **License**: SIL Open Font License 1.1 (OFL-1.1)
- **Homepage**: https://cactus.tistory.com/306
- **Repository**: https://github.com/orioncactus/pretendard
- **Copyright**: © 2021 Kil Hyung-jin
- **Usage**: Primary font family for UI and text rendering
- **Font Files**: Variable font (PretendardVariable.ttf) bundled in `src/resources/fonts/`

**License Summary:**
- The font can be used, studied, modified and redistributed freely
- Cannot be sold by itself, but can be bundled with software
- Derivatives must remain under OFL-1.1 license
- Reserved Font Name: "Pretendard"

**Full License**: See `src/resources/fonts/Pretendard-1.3.9/LICENSE.txt`

---

## License Compatibility

This project is licensed under AGPL-3.0 due to PyMuPDF's license requirements. All dependencies are compatible:

| License | Status |
|---------|--------|
| AGPL-3.0 | Primary (PyMuPDF) |
| GPL-3.0 | Compatible (PyQt6) |
| MIT | Compatible |
| BSD-3-Clause | Compatible |
| Apache-2.0 | Compatible |
| OFL-1.1 | Compatible (Pretendard Font) |

---

## Full License Texts

### GNU Affero General Public License v3.0
https://www.gnu.org/licenses/agpl-3.0.html

### GNU General Public License v3.0
https://www.gnu.org/licenses/gpl-3.0.html

### MIT License
```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

### BSD 3-Clause License
```
Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met...
```

### Apache License 2.0
https://www.apache.org/licenses/LICENSE-2.0

### SIL Open Font License 1.1
```
Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard),
with Reserved Font Name Pretendard.

This Font Software is licensed under the SIL Open Font License, Version 1.1.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder.

4) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license.
```

Full license text: https://scripts.sil.org/OFL

---

## Contact

- Project Repository: https://github.com/beeean17/Saekim
- Issues: https://github.com/beeean17/Saekim/issues

---

**Last Updated**: December 23, 2025
