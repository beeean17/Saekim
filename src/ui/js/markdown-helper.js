/**
 * Markdown Helper Module
 * Provides searchable Markdown syntax reference with Korean/English keywords
 */

const MarkdownHelperModule = {
    isOpen: false,
    dialog: null,
    searchInput: null,
    resultsContainer: null,
    suggestionsContainer: null,

    /**
     * Markdown syntax database with Korean/English keywords
     * Each entry: { category, keywords, name, description, syntax, example }
     */
    database: [
        // === Headings ===
        {
            category: '제목',
            keywords: ['제목', 'heading', 'header', 'h1', 'h2', 'h3', '헤더', '헤딩'],
            name: '제목 1 (가장 큰 제목)',
            description: '최상위 제목',
            syntax: '# 제목',
            example: '# 제목 1'
        },
        {
            category: '제목',
            keywords: ['제목', 'heading', 'header', 'h2', '헤더', '부제목'],
            name: '제목 2',
            description: '두 번째 레벨 제목',
            syntax: '## 제목',
            example: '## 제목 2'
        },
        {
            category: '제목',
            keywords: ['제목', 'heading', 'header', 'h3', '헤더', '소제목'],
            name: '제목 3',
            description: '세 번째 레벨 제목',
            syntax: '### 제목',
            example: '### 제목 3'
        },
        {
            category: '제목',
            keywords: ['제목', 'heading', 'header', 'h4', '헤더'],
            name: '제목 4',
            description: '네 번째 레벨 제목',
            syntax: '#### 제목',
            example: '#### 제목 4'
        },
        {
            category: '제목',
            keywords: ['제목', 'heading', 'header', 'h5', '헤더'],
            name: '제목 5',
            description: '다섯 번째 레벨 제목',
            syntax: '##### 제목',
            example: '##### 제목 5'
        },
        {
            category: '제목',
            keywords: ['제목', 'heading', 'header', 'h6', '헤더'],
            name: '제목 6 (가장 작은 제목)',
            description: '여섯 번째 레벨 제목',
            syntax: '###### 제목',
            example: '###### 제목 6'
        },

        // === Text Formatting ===
        {
            category: '텍스트 서식',
            keywords: ['굵게', 'bold', '강조', '두껍게', 'strong', '볼드'],
            name: '굵게 (Bold)',
            description: '텍스트를 굵게 표시',
            syntax: '**텍스트**',
            example: '**굵은 텍스트**'
        },
        {
            category: '텍스트 서식',
            keywords: ['기울임', 'italic', '이탤릭', 'em', 'emphasis'],
            name: '기울임 (Italic)',
            description: '텍스트를 기울임체로 표시',
            syntax: '*텍스트*',
            example: '*기울임 텍스트*'
        },
        {
            category: '텍스트 서식',
            keywords: ['굵은기울임', 'bold italic', '굵게기울임'],
            name: '굵은 기울임',
            description: '텍스트를 굵고 기울임체로 표시',
            syntax: '***텍스트***',
            example: '***굵은 기울임 텍스트***'
        },
        {
            category: '텍스트 서식',
            keywords: ['취소선', 'strikethrough', '가로선', '삭제', 'strike', '줄긋기'],
            name: '취소선 (Strikethrough)',
            description: '텍스트에 취소선 표시',
            syntax: '~~텍스트~~',
            example: '~~취소된 텍스트~~'
        },
        {
            category: '텍스트 서식',
            keywords: ['밑줄', 'underline', '언더라인'],
            name: '밑줄 (HTML)',
            description: 'HTML 태그로 밑줄 표시',
            syntax: '<u>텍스트</u>',
            example: '<u>밑줄 텍스트</u>'
        },
        {
            category: '텍스트 서식',
            keywords: ['하이라이트', 'highlight', '형광펜', '강조', 'mark'],
            name: '하이라이트 (HTML)',
            description: 'HTML 태그로 배경색 강조',
            syntax: '<mark>텍스트</mark>',
            example: '<mark>강조된 텍스트</mark>'
        },
        {
            category: '텍스트 서식',
            keywords: ['위첨자', 'superscript', 'sup', '윗첨자', '제곱'],
            name: '위 첨자',
            description: '위 첨자 (제곱 등)',
            syntax: 'x<sup>2</sup>',
            example: 'x<sup>2</sup> + y<sup>2</sup>'
        },
        {
            category: '텍스트 서식',
            keywords: ['아래첨자', 'subscript', 'sub', '아랫첨자', '인덱스'],
            name: '아래 첨자',
            description: '아래 첨자 (인덱스 등)',
            syntax: 'H<sub>2</sub>O',
            example: 'H<sub>2</sub>O'
        },

        // === Code ===
        {
            category: '코드',
            keywords: ['인라인코드', 'inline code', '코드', 'code', '백틱', 'backtick'],
            name: '인라인 코드',
            description: '문장 내 코드',
            syntax: '`코드`',
            example: '이것은 `인라인 코드`입니다.'
        },
        {
            category: '코드',
            keywords: ['코드블록', 'code block', '블록', 'block', '코드', 'fenced'],
            name: '코드 블록',
            description: '여러 줄 코드 블록',
            syntax: '```\n코드\n```',
            example: '```\nfunction hello() {\n  console.log("Hello");\n}\n```'
        },
        {
            category: '코드',
            keywords: ['코드블록', 'code block', '언어', 'language', '하이라이팅', 'syntax'],
            name: '언어 지정 코드 블록',
            description: '언어를 지정한 코드 블록',
            syntax: '```언어\n코드\n```',
            example: '```javascript\nconst x = 10;\n```'
        },

        // === Links ===
        {
            category: '링크',
            keywords: ['링크', 'link', 'url', '연결', '하이퍼링크', 'hyperlink'],
            name: '기본 링크',
            description: '텍스트에 링크 연결',
            syntax: '[텍스트](URL)',
            example: '[Google](https://google.com)'
        },
        {
            category: '링크',
            keywords: ['링크', 'link', 'url', '제목', 'title', '툴팁'],
            name: '제목이 있는 링크',
            description: '마우스 호버 시 제목 표시',
            syntax: '[텍스트](URL "제목")',
            example: '[Google](https://google.com "구글 홈페이지")'
        },
        {
            category: '링크',
            keywords: ['자동링크', 'auto link', 'url', '자동'],
            name: '자동 링크',
            description: 'URL을 그대로 링크로 표시',
            syntax: '<URL>',
            example: '<https://google.com>'
        },
        {
            category: '링크',
            keywords: ['참조링크', 'reference link', '링크', 'ref'],
            name: '참조 링크',
            description: '링크를 별도로 정의',
            syntax: '[텍스트][id]\n\n[id]: URL',
            example: '[Google][1]\n\n[1]: https://google.com'
        },

        // === Images ===
        {
            category: '이미지',
            keywords: ['이미지', 'image', '그림', '사진', 'picture', 'img'],
            name: '기본 이미지',
            description: '이미지 삽입',
            syntax: '![대체텍스트](이미지URL)',
            example: '![Logo](logo.png)'
        },
        {
            category: '이미지',
            keywords: ['이미지', 'image', '링크', 'link', '클릭'],
            name: '링크가 있는 이미지',
            description: '클릭 가능한 이미지',
            syntax: '[![대체텍스트](이미지URL)](링크URL)',
            example: '[![Logo](logo.png)](https://example.com)'
        },
        {
            category: '이미지',
            keywords: ['이미지', 'image', '크기', 'size', 'width', 'height'],
            name: '크기 조정 이미지 (HTML)',
            description: 'HTML로 이미지 크기 조정',
            syntax: '<img src="이미지URL" width="너비" height="높이">',
            example: '<img src="logo.png" width="200" height="100">'
        },

        // === Lists ===
        {
            category: '목록',
            keywords: ['순서없는목록', 'unordered list', '목록', 'list', 'bullet', '리스트', '점'],
            name: '순서 없는 목록',
            description: '점으로 표시되는 목록',
            syntax: '- 항목',
            example: '- 항목 1\n- 항목 2\n- 항목 3'
        },
        {
            category: '목록',
            keywords: ['순서있는목록', 'ordered list', '목록', 'list', '번호', '리스트', 'numbered'],
            name: '순서 있는 목록',
            description: '번호가 매겨진 목록',
            syntax: '1. 항목',
            example: '1. 첫 번째\n2. 두 번째\n3. 세 번째'
        },
        {
            category: '목록',
            keywords: ['중첩목록', 'nested list', '목록', 'list', '들여쓰기', 'indent'],
            name: '중첩 목록',
            description: '계층 구조 목록',
            syntax: '- 항목\n  - 하위항목',
            example: '- 항목 1\n  - 하위 1-1\n  - 하위 1-2\n- 항목 2'
        },
        {
            category: '목록',
            keywords: ['체크박스', 'checkbox', '할일', 'todo', 'task', '체크리스트'],
            name: '체크박스 목록',
            description: '체크 가능한 할 일 목록',
            syntax: '- [ ] 할일',
            example: '- [x] 완료된 항목\n- [ ] 미완료 항목'
        },

        // === Blockquotes ===
        {
            category: '인용',
            keywords: ['인용', 'blockquote', 'quote', '인용구', '인용문'],
            name: '기본 인용',
            description: '인용문 표시',
            syntax: '> 인용문',
            example: '> 이것은 인용문입니다.'
        },
        {
            category: '인용',
            keywords: ['중첩인용', 'nested blockquote', '인용', 'quote'],
            name: '중첩 인용',
            description: '여러 단계 인용',
            syntax: '> 인용문\n>> 중첩인용',
            example: '> 인용문\n>> 더 깊은 인용'
        },

        // === Horizontal Rules ===
        {
            category: '수평선',
            keywords: ['수평선', 'horizontal rule', 'hr', '구분선', '선', 'divider', '줄'],
            name: '수평선 (---)',
            description: '페이지 구분선',
            syntax: '---',
            example: '---'
        },
        {
            category: '수평선',
            keywords: ['수평선', 'horizontal rule', 'hr', '구분선', '선', 'divider'],
            name: '수평선 (***)',
            description: '페이지 구분선',
            syntax: '***',
            example: '***'
        },
        {
            category: '수평선',
            keywords: ['수평선', 'horizontal rule', 'hr', '구분선', '선', 'divider'],
            name: '수평선 (___)',
            description: '페이지 구분선',
            syntax: '___',
            example: '___'
        },

        // === Tables ===
        {
            category: '테이블',
            keywords: ['테이블', 'table', '표', '표작성', 'grid'],
            name: '기본 테이블',
            description: '표 만들기',
            syntax: '| 헤더1 | 헤더2 |\n| --- | --- |\n| 셀1 | 셀2 |',
            example: '| 이름 | 나이 |\n| --- | --- |\n| 홍길동 | 25 |'
        },
        {
            category: '테이블',
            keywords: ['테이블', 'table', '정렬', 'align', 'alignment', '왼쪽', '오른쪽', '가운데'],
            name: '정렬된 테이블',
            description: '열 정렬 지정',
            syntax: '| 왼쪽 | 가운데 | 오른쪽 |\n| :--- | :---: | ---: |',
            example: '| 왼쪽 | 가운데 | 오른쪽 |\n| :--- | :---: | ---: |\n| L | C | R |'
        },

        // === Special Characters ===
        {
            category: '특수문자',
            keywords: ['이스케이프', 'escape', '백슬래시', 'backslash', '특수', '문자'],
            name: '특수문자 이스케이프',
            description: '마크다운 특수문자 표시',
            syntax: '\\문자',
            example: '\\* \\# \\[ \\]'
        },

        // === Line Breaks ===
        {
            category: '줄바꿈',
            keywords: ['줄바꿈', 'line break', 'br', '개행', '엔터'],
            name: '줄바꿈 (공백 2개)',
            description: '문장 끝 공백 2개로 줄바꿈',
            syntax: '문장  \n다음줄',
            example: '첫 번째 줄  \n두 번째 줄'
        },
        {
            category: '줄바꿈',
            keywords: ['줄바꿈', 'line break', 'br', '개행'],
            name: '줄바꿈 (HTML)',
            description: 'HTML 태그로 줄바꿈',
            syntax: '문장<br>다음줄',
            example: '첫 번째 줄<br>두 번째 줄'
        },

        // === Footnotes ===
        {
            category: '각주',
            keywords: ['각주', 'footnote', '주석', 'note', '참고'],
            name: '각주',
            description: '페이지 하단 주석',
            syntax: '텍스트[^1]\n\n[^1]: 주석 내용',
            example: '이것은 각주입니다[^1]\n\n[^1]: 각주 설명'
        },

        // === Definition Lists ===
        {
            category: '정의목록',
            keywords: ['정의', 'definition', 'dl', 'dt', 'dd', '용어'],
            name: '정의 목록',
            description: '용어와 정의',
            syntax: '용어\n: 정의',
            example: 'HTML\n: 마크업 언어'
        },

        // === Emojis ===
        {
            category: '이모지',
            keywords: ['이모지', 'emoji', '이모티콘', 'emoticon', '아이콘'],
            name: '이모지',
            description: '이모지 삽입 (지원 시)',
            syntax: ':emoji_name:',
            example: ':smile: :heart: :thumbsup:'
        },

        // === Advanced ===
        {
            category: '고급',
            keywords: ['html', 'raw', '원본', '태그'],
            name: 'HTML 직접 사용',
            description: 'HTML 태그 직접 입력',
            syntax: '<div>내용</div>',
            example: '<div style="color: red;">빨간 텍스트</div>'
        },
        {
            category: '고급',
            keywords: ['주석', 'comment', '숨김', 'hidden'],
            name: '주석 (보이지 않음)',
            description: '렌더링되지 않는 주석',
            syntax: '<!-- 주석 -->',
            example: '<!-- 이것은 주석입니다 -->'
        }
    ],

    /**
     * Initialize the module
     */
    init() {
        this.createDialog();
        this.bindEvents();
        this.bindToolbarButton();
        console.log('[MarkdownHelper] Initialized with', this.database.length, 'entries');
    },

    /**
     * Bind toolbar button event
     */
    bindToolbarButton() {
        const btn = document.getElementById('btn-markdown-helper');
        if (btn) {
            btn.addEventListener('click', () => this.toggle());
        }
    },

    /**
     * Create the dialog HTML
     */
    createDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'markdown-helper-dialog';
        dialog.className = 'markdown-helper-dialog';
        dialog.style.display = 'none';

        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>마크다운 문법 도우미</h3>
                <button class="close-btn" id="markdown-helper-close">&times;</button>
            </div>
            <div class="dialog-body">
                <div class="search-container">
                    <input type="text" id="markdown-search" placeholder="검색어 입력 (예: 굵게, 목록, 링크...)" autocomplete="off">
                    <div id="markdown-suggestions" class="suggestions-container"></div>
                </div>
                <div id="markdown-results" class="results-container">
                    <div class="results-placeholder">
                        <p>검색어를 입력하면 관련 마크다운 문법이 표시됩니다.</p>
                        <p class="hint">한글 또는 영어로 검색할 수 있습니다.</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        this.dialog = dialog;
        this.searchInput = dialog.querySelector('#markdown-search');
        this.resultsContainer = dialog.querySelector('#markdown-results');
        this.suggestionsContainer = dialog.querySelector('#markdown-suggestions');
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Close button
        const closeBtn = this.dialog.querySelector('#markdown-helper-close');
        closeBtn.addEventListener('click', () => this.close());

        // Search input
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                this.showSuggestions(query);
                this.search(query);
            } else {
                this.clearSuggestions();
                this.showPlaceholder();
            }
        });

        // Handle keyboard navigation
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.focusNextSuggestion();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.focusPrevSuggestion();
            } else if (e.key === 'Enter') {
                const focused = this.suggestionsContainer.querySelector('.suggestion-item.focused');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        });

        // Click outside to close
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.close();
            }
        });

        // Keyboard shortcut (Ctrl/Cmd + Shift + D to open)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggle();
            }
        });
    },

    /**
     * Show autocomplete suggestions
     */
    showSuggestions(query) {
        const lowerQuery = query.toLowerCase();
        const suggestions = new Set();

        // Collect matching keywords
        this.database.forEach(item => {
            item.keywords.forEach(keyword => {
                if (keyword.toLowerCase().startsWith(lowerQuery) && keyword.toLowerCase() !== lowerQuery) {
                    suggestions.add(keyword);
                }
            });
        });

        // Render suggestions
        if (suggestions.size > 0) {
            const sortedSuggestions = Array.from(suggestions).slice(0, 8);
            this.suggestionsContainer.innerHTML = sortedSuggestions
                .map(s => `<div class="suggestion-item" data-value="${s}">${this.highlightMatch(s, query)}</div>`)
                .join('');
            this.suggestionsContainer.style.display = 'block';

            // Bind click events
            this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.searchInput.value = item.dataset.value;
                    this.clearSuggestions();
                    this.search(item.dataset.value);
                    this.searchInput.focus();
                });
            });
        } else {
            this.clearSuggestions();
        }
    },

    /**
     * Highlight matching part of suggestion
     */
    highlightMatch(text, query) {
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return text;
        return text.substring(0, index) +
               '<strong>' + text.substring(index, index + query.length) + '</strong>' +
               text.substring(index + query.length);
    },

    /**
     * Clear suggestions
     */
    clearSuggestions() {
        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.style.display = 'none';
    },

    /**
     * Focus next suggestion
     */
    focusNextSuggestion() {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        const focused = this.suggestionsContainer.querySelector('.suggestion-item.focused');
        if (focused) {
            focused.classList.remove('focused');
            const next = focused.nextElementSibling || items[0];
            next.classList.add('focused');
        } else {
            items[0].classList.add('focused');
        }
    },

    /**
     * Focus previous suggestion
     */
    focusPrevSuggestion() {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        const focused = this.suggestionsContainer.querySelector('.suggestion-item.focused');
        if (focused) {
            focused.classList.remove('focused');
            const prev = focused.previousElementSibling || items[items.length - 1];
            prev.classList.add('focused');
        } else {
            items[items.length - 1].classList.add('focused');
        }
    },

    /**
     * Search database
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];

        this.database.forEach(item => {
            // Check if any keyword matches
            const matchScore = item.keywords.reduce((score, keyword) => {
                const lowerKeyword = keyword.toLowerCase();
                if (lowerKeyword === lowerQuery) return Math.max(score, 100);
                if (lowerKeyword.startsWith(lowerQuery)) return Math.max(score, 80);
                if (lowerKeyword.includes(lowerQuery)) return Math.max(score, 60);
                return score;
            }, 0);

            if (matchScore > 0) {
                results.push({ ...item, score: matchScore });
            }
        });

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        this.renderResults(results);
    },

    /**
     * Render search results
     */
    renderResults(results) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="no-results">
                    <p>검색 결과가 없습니다.</p>
                    <p class="hint">다른 키워드로 검색해 보세요.</p>
                </div>
            `;
            return;
        }

        // Group by category
        const grouped = {};
        results.forEach(item => {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        });

        let html = '';
        for (const [category, items] of Object.entries(grouped)) {
            html += `<div class="result-category"><h4>${category}</h4>`;
            items.forEach(item => {
                html += `
                    <div class="result-item" data-syntax="${this.escapeHtml(item.syntax)}">
                        <div class="result-info">
                            <span class="result-name">${item.name}</span>
                            <span class="result-description">${item.description}</span>
                            <code class="result-syntax">${this.escapeHtml(item.syntax)}</code>
                        </div>
                        <div class="result-preview">
                            <pre>${this.escapeHtml(item.example)}</pre>
                        </div>
                        <div class="result-actions">
                            <button class="btn-copy" data-syntax="${this.escapeHtml(item.syntax)}">복사</button>
                            <button class="btn-insert" data-syntax="${this.escapeHtml(item.syntax)}">삽입</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        this.resultsContainer.innerHTML = html;

        // Bind button events
        this.resultsContainer.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.syntax);
                btn.textContent = '복사됨!';
                setTimeout(() => btn.textContent = '복사', 1500);
            });
        });

        this.resultsContainer.querySelectorAll('.btn-insert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.insertSyntax(btn.dataset.syntax);
            });
        });

        // Click on result item to insert
        this.resultsContainer.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.insertSyntax(item.dataset.syntax);
            });
        });
    },

    /**
     * Show placeholder
     */
    showPlaceholder() {
        this.resultsContainer.innerHTML = `
            <div class="results-placeholder">
                <p>검색어를 입력하면 관련 마크다운 문법이 표시됩니다.</p>
                <p class="hint">한글 또는 영어로 검색할 수 있습니다.</p>
            </div>
        `;
    },

    /**
     * Copy to clipboard
     */
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('[MarkdownHelper] Copied:', text);
        }).catch(err => {
            console.error('[MarkdownHelper] Copy failed:', err);
        });
    },

    /**
     * Insert syntax into editor
     */
    insertSyntax(syntax) {
        if (typeof EditorModule !== 'undefined' && EditorModule.insertText) {
            EditorModule.insertText(syntax);
            this.close();
        } else {
            // Fallback: copy to clipboard
            this.copyToClipboard(syntax);
            alert('에디터에 직접 삽입할 수 없습니다. 문법이 클립보드에 복사되었습니다.');
        }
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Open dialog
     */
    open() {
        this.dialog.style.display = 'flex';
        this.isOpen = true;
        this.searchInput.value = '';
        this.showPlaceholder();
        this.clearSuggestions();
        setTimeout(() => this.searchInput.focus(), 100);
    },

    /**
     * Close dialog
     */
    close() {
        this.dialog.style.display = 'none';
        this.isOpen = false;
    },

    /**
     * Toggle dialog
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MarkdownHelperModule.init();
});
