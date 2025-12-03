# 구현 기능 파일 위치

## 1. katex 문법 도우미
* JavaScript (핵심 로직)
  - src/ui/js/katex-helper.js - KaTeX 도우미의 메인 로직 (110+ 템플릿 포함)

* HTML (UI 구조)
  - src/ui/index.html - KaTeX 도우미 다이얼로그 HTML 마크업

* CSS (스타일)
  - src/ui/css/dialogs.css - KaTeX 도우미 다이얼로그 스타일
  - src/ui/css/editor.css - 에디터 관련 스타일 (KaTeX 버튼 포함)

## 2. mermaid 문법 도우미
* JavaScript (핵심 로직)
  - src/ui/js/mermaid-helper.js - Mermaid 도우미의 메인 로직 (40+ 다이어그램 템플릿 포함)

* HTML (UI 구조)
  - src/ui/index.html - Mermaid 도우미 다이얼로그 HTML 마크업

* CSS (스타일)
  - src/ui/css/dialogs.css - Mermaid 도우미 다이얼로그 스타일
  - src/ui/css/editor.css - 에디터 관련 스타일 (Mermaid 버튼 포함)

## 3. 텍스트 입력 및 편집
* JavaScript (핵심 로직)
  - src/ui/js/editor.js - 네이티브 textarea 구현, 편집 기능 (375줄)

* HTML (UI 구조)
  - src/ui/index.html - textarea 요소 정의

* CSS (스타일)
  - src/ui/css/editor.css - 에디터 영역 스타일링

## 4. 실시간 마크다운 미리보기
* JavaScript (핵심 로직)
  - src/ui/js/preview.js - Marked.js 통합, 렌더링 로직 (744줄)
  - src/ui/js/editor.js - 300ms 디바운스 미리보기 업데이트

* HTML (UI 구조)
  - src/ui/index.html - Marked.js, DOMPurify CDN 포함

* CSS (스타일)
  - src/ui/css/preview.css - 미리보기 영역 스타일링

## 5. 파일 열기/저장
* JavaScript (핵심 로직)
  - src/ui/js/file.js - 파일 작업 처리
  - src/ui/js/app.js - 파일 핸들링 로직

* Python (백엔드)
  - src/backend/api.py - open_file_dialog, save_file 메서드
  - src/backend/file_manager.py - 정적 파일 I/O 유틸리티 (UTF-8 인코딩)

## 6. 실행 취소/다시 실행
* JavaScript (핵심 로직)
  - 브라우저 네이티브 기능 (Ctrl+Z, Ctrl+Y)

* HTML (UI 구조)
  - 네이티브 textarea 기능 사용

## 7. 코드 구문 강조
* JavaScript (핵심 로직)
  - src/ui/js/preview.js - Highlight.js 통합, 18개 언어 지원

* HTML (UI 구조)
  - src/ui/index.html - Highlight.js CDN 포함

* CSS (스타일)
  - Highlight.js GitHub Dark 테마 (CDN)

## 8. 다이어그램 렌더링 (Mermaid.js)
* JavaScript (핵심 로직)
  - src/ui/js/preview.js - Mermaid 초기화 및 렌더링 (8가지 다이어그램 타입)

* HTML (UI 구조)
  - src/ui/index.html - Mermaid.js v10.6.1 CDN 포함

* CSS (스타일)
  - src/ui/css/preview.css - Mermaid 다이어그램 스타일링

## 9. 수식 렌더링 (KaTeX)
* JavaScript (핵심 로직)
  - src/ui/js/preview.js - KaTeX 렌더링 (인라인/블록 수식)

* HTML (UI 구조)
  - src/ui/index.html - KaTeX v0.16.9 CDN 포함

* CSS (스타일)
  - KaTeX CSS (CDN) + preview.css 커스텀 수식 스타일

## 10. MD → PDF 변환
* JavaScript (핵심 로직)
  - src/ui/js/file.js - PDF 내보내기, 진행 표시줄, Mermaid SVG→PNG 변환

* Python (백엔드)
  - src/backend/converter.py - Playwright 기반 PDF 생성 (A4 형식)

* HTML (UI 구조)
  - src/ui/index.html - PDF 진행률 모달

* CSS (스타일)
  - src/ui/css/dialogs.css - 진행률 모달 스타일링

## 11. PDF → MD 변환
* JavaScript (핵심 로직)
  - src/ui/js/file.js - PDF에서 가져오기, 이미지 처리

* Python (백엔드)
  - src/backend/converter.py - PyMuPDF 기반 구조 분석 (pdfplumber 테이블 추출 폴백)

## 12. 키보드 단축키
* JavaScript (핵심 로직)
  - src/ui/js/app.js - Ctrl+S/O/N 단축키
  - src/ui/js/settings.js - Ctrl+=/+/-, Ctrl+0 단축키

## 13. 탭 인터페이스 (다중 파일)
* Python (백엔드)
  - src/windows/main_window.py - QTabWidget 설정
  - src/backend/tab_manager.py - 탭 상태 관리

* JavaScript (핵심 로직)
  - QWebChannel을 통해 백엔드와 통합

## 14. 마크다운 툴바
* JavaScript (핵심 로직)
  - src/ui/js/toolbar.js - 굵게/기울임/제목/리스트/코드/인용/링크/이미지/표 포맷팅 (150줄)

* Python (백엔드)
  - 백엔드 메뉴/툴바 통합

## 15. 찾기 및 바꾸기
* JavaScript (핵심 로직)
  - dist/Saekim/_internal/ui/js/find-replace.js - 대화상자 기반 찾기/바꾸기 (대소문자 구분, 정규식 옵션, 일치 개수 표시)

* HTML (UI 구조)
  - src/ui/index.html - find-replace.js 포함

* CSS (스타일)
  - src/ui/css/dialogs.css - 찾기-바꾸기 대화상자 스타일링

## 16. 스크롤 동기화
* JavaScript (핵심 로직)
  - src/ui/js/preview.js - 토글 및 동기화 로직
  - src/ui/js/editor.js - 에디터 스크롤 이벤트 리스너

* HTML (UI 구조)
  - src/ui/index.html - 동기화 토글 버튼

* CSS (스타일)
  - src/ui/css/app.css - 버튼 스타일링

## 17. 자동 저장 (LocalStorage)
* JavaScript (핵심 로직)
  - src/ui/js/app.js - localStorage에서 상태 로드/저장
  - src/ui/js/editor.js - 5초 디바운스 자동 저장 (현재 비활성화)

## 18. 레이아웃 크기 조절
* JavaScript (핵심 로직)
  - src/ui/js/app.js - 크기 조절 드래그 로직

* HTML (UI 구조)
  - src/ui/index.html - 크기 조절 div

* CSS (스타일)
  - src/ui/css/app.css - 크기 조절 스타일링

## 19. 이미지 업로드 및 관리
* JavaScript (핵심 로직)
  - src/ui/js/editor.js - 이미지 선택 및 삽입 (상대 경로)

* Python (백엔드)
  - src/backend/api.py - select_and_insert_image 메서드

## 20. 라이트/다크 테마 토글
* JavaScript (핵심 로직)
  - src/ui/js/theme.js - 테마 전환 (시스템 선호도 감지 포함, 114줄)

* HTML (UI 구조)
  - src/ui/index.html - 테마 토글 버튼, 테마 스타일시트

* CSS (스타일)
  - src/ui/css/theme-light.css - 라이트 테마
  - src/ui/css/theme-dark.css - 다크 테마
  - src/ui/css/app.css - CSS 변수 (양쪽 테마)

## 21. 표 생성기
* JavaScript (핵심 로직)
  - src/ui/js/toolbar.js - 헤더 포함 동적 표 생성

* CSS (스타일)
  - src/ui/css/preview.css - 표 렌더링

## 22. 단어 개수 표시
* JavaScript (핵심 로직)
  - src/ui/js/editor.js - updateWordCount 함수
  - src/ui/js/utils.js - 단어/문자 카운팅

* HTML (UI 구조)
  - src/ui/index.html - 단어 개수 버튼

* CSS (스타일)
  - src/ui/css/app.css - 버튼 스타일링

## 23. 코드 복사 버튼
* JavaScript (핵심 로직)
  - src/ui/js/preview.js - 코드 블록에 복사 버튼 추가 (클립보드 API)

* CSS (스타일)
  - src/ui/css/preview.css - 복사 버튼 스타일링

## 24. 글꼴 크기 조정 (12-24px)
* JavaScript (핵심 로직)
  - src/ui/js/settings.js - 글꼴 크기 제어 (증가/감소/재설정, 260줄)

* HTML (UI 구조)
  - src/ui/index.html - 글꼴 크기 버튼

## 25. 전체화면 모드
* Python (백엔드)
  - 네이티브 PyQt6 전체화면 (F11 키)

## 26. 파일 탐색기 사이드바
* Python (백엔드)
  - src/windows/file_explorer.py - 파일 트리 탐색 QDockWidget

* JavaScript (핵심 로직)
  - QWebChannel을 통한 통신
