# Changelog

All notable changes to Saekim will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.1.0] - Unreleased

### Added

- Markdown 문법 검색 모달에 문단 도구로 줄바꿈, 들여쓰기, 내어쓰기 항목을 추가했습니다.
- Markdown 문법 검색 모달의 이미지 항목에서 원본 경로 연결과 문서 assets 복사 삽입을 실행할 수 있도록 추가했습니다.
- Assets 이미지 미리보기에서 현재 문서에 이미지를 추가할 수 있는 버튼을 추가했습니다.
- 열린 문서가 없을 때 편집기와 미리보기 영역에 파일 선택/열기 안내 메시지를 표시하도록 추가했습니다.
- 열린 문서가 없는 상태에서 메타데이터에 저장된 최근 파일 순서 큐의 맨 위 파일을 즉시 열도록 추가했습니다.
- 문단 도구 단축키로 `Shift+Enter`, `Tab`, `Shift+Tab`, `Cmd/Ctrl+]`, `Cmd/Ctrl+[`를 추가했습니다.
- Mermaid/KaTeX 헬퍼와 같은 검색 모달로 일반 Markdown 문법을 찾아 삽입할 수 있도록 추가했습니다.
- Markdown preview에서 `->`, `<-`, `^|`, `v|` 텍스트 화살표를 방향 화살표로 렌더링하도록 추가했습니다.
- ASCII 박스/흐름도 형태의 일반 텍스트 코드블럭을 선 연결 문자로 다듬어 렌더링하도록 추가했습니다.

### Changed

- 확장 아코디언 툴바를 제거하고, Markdown/Mermaid/KaTeX 검색 중심의 기본 툴바로 정리했습니다.
- Markdown preview는 기본 Markdown 줄바꿈을 유지하고, 코드블럭은 fenced code block 문법만 렌더링하도록 조정했습니다.
- Windows 패키징에서 `.txt` 파일은 앱 아이콘 대신 시스템 텍스트 문서 아이콘을 쓰는 별도 Open With ProgID로 등록하도록 조정했습니다.

### Fixed

- 한 줄짜리 `-` 입력이 이전 줄을 setext heading처럼 렌더링하던 문제를 수정했습니다.
- preview 블럭 레이아웃 도구가 실제 블럭 외부 여백 클릭으로 열리던 문제를 수정했습니다.
- 최근 파일에서 열린 파일을 `Cmd/Ctrl+W`로 닫아도 최근 파일 목록에 남던 문제를 수정했습니다.
- Shiki 코드블럭 텍스트 선택 시 줄 바깥 여백까지 선택되는 것처럼 보이던 시각 문제를 완화했습니다.

---

## [3.0.1] - Unreleased

### Added

- Markdown 외 텍스트 기반 파일을 열 수 있도록 파일 타입 판정 구조를 확장했습니다.
- `.html`, `.htm`, `.json`, `.yml`, `.yaml`, `.toml`, `.env` 파일을 3.0.1 우선 지원 대상으로 추가했습니다.
- 확장자가 알려지지 않은 파일도 UTF-8 텍스트로 판정되면 일반 텍스트 파일로 열 수 있도록 했습니다.
- 프론트엔드 파일 타입 모델에 `label`, `language`, `previewKind`를 추가해 파일 형식별 렌더링/하이라이트 확장 기반을 마련했습니다.
- HTML 파일 전용 미리보기 렌더링을 추가했습니다.
- HTML 미리보기 모드를 선택할 수 있는 `브라우저`/`안전` 토글을 추가했습니다.
- `브라우저` 모드에서는 sandboxed iframe과 `srcDoc`을 사용해 HTML을 브라우저에 가까운 방식으로 렌더링합니다.
- `안전` 모드에서는 sanitizer를 거친 HTML 조각을 기존 preview DOM 안에 렌더링합니다.
- JSON/YAML/TOML 파일을 접고 펼칠 수 있는 interactive tree preview로 렌더링하도록 추가했습니다.
- CSV/TSV 파일을 spreadsheet 형태의 table preview로 렌더링하도록 추가했습니다.
- OpenAPI v3 JSON/YAML 문서를 감지해 API 문서 preview로 렌더링하도록 추가했습니다.
- 구조화 데이터 preview에 `API`/`Tree`/`Raw`, 표 데이터 preview에 `Table`/`Raw` 모드 전환을 추가했습니다.
- 구조화 데이터 tree preview에서 객체 key path를 클릭해 복사할 수 있도록 추가했습니다.
- 이미지 삽입 버튼에 `원본 경로로 연결`과 `문서 assets로 복사` 드롭다운 옵션을 추가했습니다.
- 브라우저에서 원격 이미지를 편집기에 드래그 앤 드롭하면 현재 문서 옆 `.assets/` 폴더로 다운로드해 상대 경로로 삽입하는 기능을 추가했습니다.
- 원격 이미지 다운로드 중 Markdown preview의 이미지 위치에 진행률/실패 상태를 표시하도록 추가했습니다.
- 클립보드 이미지 붙여넣기 시 현재 문서 옆 `.assets/` 폴더에 저장하고 Markdown 이미지 문법을 자동 삽입하도록 추가했습니다.
- `.assets` 폴더의 이미지 파일을 워크스페이스 파일 트리에 표시하도록 추가했습니다.
- 워크스페이스 이미지 파일 클릭 시 앱 내부에서 이미지 미리보기 모달을 열 수 있도록 추가했습니다.
- Markdown preview의 이미지, 표, 리스트, 인용문, 코드블럭, Mermaid, KaTeX 블럭에 크기/정렬 metadata를 저장하는 블럭 레이아웃 기능을 추가했습니다.
- 연속된 preview 블럭을 2열 또는 3열로 묶어 표시하는 column group 기능을 추가했습니다.
- 앱 metadata 저장소를 SQLite 기반 구조로 확장하고 workspace, file, block layout metadata 저장 기반을 추가했습니다.
- Windows 데스크톱 빌드 지원을 추가했습니다.

### Changed

- 파일 열기 큐 진입 조건을 고정 확장자 화이트리스트 중심에서 텍스트 파일 판정 중심으로 변경했습니다.
- 파일 열기, drag and drop, OS 기본 앱 열기, `Cmd/Ctrl+O`가 동일한 Rust pending open queue를 공유하도록 정리했습니다.
- HTML preview에서 상대 이미지, 링크, CSS 경로를 현재 HTML 파일 위치 기준으로 해석하도록 보정했습니다.
- HTML preview 모드 선택값을 세션 설정에 저장하고 다음 실행 시 복원하도록 했습니다.
- JSON/YAML/TOML/CSV/TSV 파일의 기본 preview를 raw text에서 구조화된 데이터 preview로 변경했습니다.
- CSV/TSV preview는 대용량 파일에서 첫 1,000개 행만 표시하고 전체 행 수와 truncation 상태를 표시합니다.
- JSON/YAML/TOML/CSV/TSV preview 렌더링은 기존 Markdown/HTML 문자열 렌더링 경로와 분리된 React 컴포넌트 기반 렌더링 경로를 사용하도록 변경했습니다.
- Markdown preview에서 상대 이미지 경로를 현재 문서 위치 기준으로 해석하도록 변경했습니다.
- 이미지 assets 복사 시 원본 파일명을 우선 사용하고, 같은 파일이 이미 `.assets`에 있으면 중복 복사하지 않고 기존 파일을 재사용하도록 변경했습니다.
- 원격 이미지 URL 가져오기 메뉴는 기능 안정성과 필요성 대비 구현 비용을 고려해 UI에서 숨겼습니다.
- 현재 열린 파일 경로 기준으로 워크스페이스 루트를 표시하도록 정리해 `.assets`와 문서 주변 파일을 함께 탐색할 수 있도록 변경했습니다.
- preview 블럭 레이아웃 도구는 hover가 아니라 블럭 클릭 선택 상태에서만 표시되도록 변경했습니다.
- preview 블럭 그룹 해제는 별도 `풀기` 버튼 대신 활성화된 `2열`/`3열` 버튼을 다시 누르는 토글 방식으로 변경했습니다.
- 묶인 preview 블럭은 같은 시작 높이를 기준으로 정렬되도록 변경했습니다.

### Fixed

- 텍스트 파일임에도 확장자가 목록에 없으면 열리지 않던 문제를 완화했습니다.
- 명확한 바이너리 파일은 텍스트로 잘못 열리지 않도록 확장자와 내용 기반 판정을 추가했습니다.
- HTML preview에서 `<script>`, iframe/form/input류, inline event handler, 위험한 URL이 실행되거나 삽입되지 않도록 차단했습니다.
- iframe HTML preview 내부 링크 클릭이 앱 내부 navigation으로 이어지지 않고 외부 브라우저/시스템 열기로 처리되도록 했습니다.
- 구조화 데이터 파싱 실패 시 preview가 비지 않고 오류 패널과 raw text fallback을 표시하도록 했습니다.
- CSV/TSV 파싱 경고가 있을 때 표 preview와 함께 경고 메시지를 표시하도록 했습니다.
- 원격 이미지 assets 가져오기에서 `http`/`https` 외 URL, 사설망/localhost URL, remote SVG, 비이미지 MIME, 20MB 초과 파일을 차단하도록 했습니다.
- 원격 이미지 다운로드 실패 시 임시 파일이 남지 않도록 처리했습니다.
- Markdown preview에서 문서 옆 `.assets` 상대 이미지가 렌더링되지 않던 문제를 수정했습니다.
- preview 블럭 레이아웃 도구가 코드블럭 라벨 영역에만 반응하거나 hover로 불필요하게 노출되던 문제를 수정했습니다.
- Mermaid 블럭을 레이아웃 wrapper로 감싼 뒤 다이어그램 렌더링이 깨지던 문제를 수정했습니다.
- 묶이지 않은 preview 블럭에 stale group metadata가 남아 `풀기` 상태로 보이던 문제를 수정했습니다.
- preview 블럭 그룹 버튼 텍스트가 좁은 패널에서 위아래로 줄바꿈되어 도구 영역을 벗어나던 문제를 수정했습니다.
- Windows 환경에서 PDF export와 데스크톱 빌드가 동작하도록 플랫폼별 경로/빌드 설정 문제를 수정했습니다.

### Build

- 3.0.1 HTML/text 파일 지원 계획 문서를 `private/3.0.1/html_text_file_support_plan.md`에 추가했습니다.
- 구조화 데이터 preview를 위해 `yaml`, `smol-toml`, `papaparse` 의존성을 추가했습니다.
- 이미지 assets 가져오기 개발 계획 문서를 `private/3.0.1/image_assets_import_plan.md`에 추가했습니다.
- 원격 이미지 스트리밍 다운로드를 위해 Rust `reqwest`, `futures-util` 의존성을 추가했습니다.
- metadata 저장소 설계 문서를 `private/3.0.1/metadata_store_plan.md`에 추가했습니다.

---

## [3.0.0] - Unreleased

### Added

- Tauri 2 기반 데스크톱 셸과 React/TypeScript 프론트엔드 구조를 도입했습니다.
- PyQt/QWebEngine 의존 UI를 대체하는 Tauri command 기반 파일/세션/설정 어댑터를 추가했습니다.
- 파일 열기, 폴더 열기, 새 파일, 저장, 다른 이름 저장, 닫기 흐름을 네이티브 대화상자와 연결했습니다.
- macOS와 Windows에서 Markdown 파일 기본 앱으로 등록할 수 있도록 파일 연결 설정을 추가했습니다.
- `Cmd/Ctrl+O`, `Cmd/Ctrl+N`, `Cmd/Ctrl+S`, `Cmd/Ctrl+P` 단축키를 추가했습니다.
- 메인 File 메뉴에서 저장과 PDF 내보내기를 실행할 수 있도록 네이티브 메뉴 명령을 연결했습니다.
- 사이드바, 편집기, 미리보기 영역의 가로 크기 조절 기능을 추가했습니다.
- 편집기와 미리보기의 스크롤 동기화/해제 기능을 추가했습니다.
- 문서 내 탐색을 항상 표시되는 툴바로 이동했습니다.
- 설정 패널과 앱 메타데이터 저장소를 추가하고, 설정/세션/최근 항목 등 사용자 데이터를 OS별 Application Support 경로에 저장하도록 통일했습니다.
- Pretendard Variable을 기본 UI/문서 폰트로 적용하고, IBM Plex Sans KR 폰트 선택지를 추가했습니다.
- Markdown 프리뷰와 PDF export에 Mermaid, KaTeX, 표, 이미지, 코드블럭 렌더링을 통합했습니다.
- 명시된 언어가 있는 코드블럭에 Shiki 기반 문법 하이라이트를 적용했습니다.
- 코드블럭 언어 라벨, 줄 번호, diff 추가/삭제 줄 스타일을 추가했습니다.
- PDF export 진행 중/완료 상태를 하단 상태바에 표시하도록 했습니다.

### Changed

- 앱 UI를 Tauri 기반 macOS 스타일 창, 사이드바, 상단 툴바, 편집/분할/보기 전환 구조로 전면 재구성했습니다.
- 탐색기의 뒤로/앞으로/현재 경로 입력 영역을 제거해 사이드바와 문서 작업 영역을 단순화했습니다.
- 보기 분할 버튼을 상단 우측 도구 영역으로 이동하고, 메인 화면의 테마 전환 버튼은 설정 안으로 정리했습니다.
- 제목, 볼드, 이탤릭, 링크, 코드블럭 버튼을 추가 툴바로 이동하고 메인 툴바는 도구 아이콘 중심으로 정리했습니다.
- Mermaid와 KaTeX 버튼은 텍스트 라벨을 유지하고, 나머지 도구 버튼은 아이콘 중심 표현으로 통일했습니다.
- 사이드바가 접힌 상태에서도 전체 파일 목록을 볼 수 있고 세로 영역을 넘으면 스크롤할 수 있도록 변경했습니다.
- 편집기 줄 번호와 본문 줄 높이를 같은 폰트 크기/line-height 체계로 맞췄습니다.
- 편집기 본문 선택 상태와 줄 번호 선택 하이라이트가 함께 동기화되도록 변경했습니다.
- 선택한 문서 폰트가 편집기뿐 아니라 Markdown 미리보기에도 적용되도록 변경했습니다.
- PDF export는 자동 파일 저장 대신 운영체제 인쇄 대화상자를 통해 PDF로 저장합니다.
- PDF export는 사용자의 현재 테마와 관계없이 흰 배경의 light 테마 기준 CSS 템플릿을 사용합니다.
- PDF export 결과에서 상단 `Saekim Markdown Export` 헤더를 제거했습니다.
- PDF export에서 표, 이미지, 코드블럭처럼 연속성이 중요한 블록은 가능한 한 페이지 중간에서 잘리지 않고 다음 페이지로 넘어가도록 조정했습니다.
- PDF export에서 본문 텍스트와 코드블럭의 줄 잘림을 줄이도록 print CSS를 조정했습니다.
- 코드블럭 줄간을 더 조밀하게 조정해 프리뷰와 PDF export 모두 `line-height: 1.08` 기준으로 렌더링합니다.
- macOS bundle identifier를 `com.beeean17.saekim`으로 정리했습니다.

### Fixed

- 폴더 열기, 파일 열기, 다른 이름 저장에서 네이티브 대화상자 호출 후 무한 로딩이 발생하던 문제를 수정했습니다.
- 설정 버튼을 눌러도 설정 창이 열리지 않던 문제를 수정했습니다.
- 설정 창 바깥 영역을 클릭하면 설정 창이 닫히도록 수정했습니다.
- 편집 화면 전체 보기에서 보기 전환 토글에 접근할 수 없던 문제를 수정했습니다.
- 창 오른쪽 리사이즈 중 편집기/미리보기 영역이 끊기거나 흰 영역이 남던 레이아웃 문제를 수정했습니다.
- 좁은 창에서 편집기 또는 미리보기 한쪽이 먼저 사라지던 문제를 수정했습니다.
- 편집기와 미리보기의 최소 폭이 대칭적으로 줄어들도록 창 리사이즈 동작을 수정했습니다.
- 패널 드래그 리사이즈와 스크롤 동기화가 낮은 프레임처럼 보이던 문제를 완화했습니다.
- 스크롤 동기화 중 문서가 자동으로 위로 튀던 문제를 수정했습니다.
- 줄 번호가 문서 전체 줄 수만큼 표시되지 않거나, 특정 폰트 크기에서 본문 줄과 어긋나던 문제를 수정했습니다.
- 전체 선택 해제 후 줄 번호 선택 하이라이트가 즉시 풀리지 않던 문제를 수정했습니다.
- PDF export 시스템 창이 뜨지 않거나 export가 실패하던 문제를 수정했습니다.
- PDF export에서 Mermaid 다이어그램, KaTeX 수식, 코드블럭이 다크 테마 색상을 따라가 읽기 어려웠던 문제를 수정했습니다.
- KaTeX 인라인 수식, 블록 수식, 행렬, 다중 수식의 preview/PDF 렌더링 깨짐을 수정했습니다.
- PDF export에서 Shiki 스타일이 사라지거나 코드블럭 배경/글자색 대비가 맞지 않던 문제를 수정했습니다.

### Build

- `corepack pnpm tauri:dev` 환경에서 내부 `pnpm` 호출이 실패하지 않도록 Tauri dev hook 실행 방식을 정리했습니다.
- Tauri macOS 앱 번들 빌드 명령과 DMG 빌드 명령을 분리했습니다.
- macOS/Windows 배포와 파일 연결 설정을 위한 Tauri 패키징 설정을 정리했습니다.
- 3.0.0 개발 계획, 브랜치 전략, Tauri 개발 문서를 `private/3.0.0`에 정리했습니다.

### Deferred

- PDF-to-Markdown import는 3.0.0 MVP에서 제외합니다. 기존 Python/PyMuPDF/pdfplumber 변환 스택은 앱 크기와 시작 시간 목표를 약화시키므로 후속 릴리스에서 별도 sidecar 또는 native 변환기로 재검토합니다.
- DOCX export, silent PDF auto-save, 전체 네이티브 메뉴 parity, installer signing 자동화는 후속 릴리스에서 다룹니다.

---



## [1.3.0] - 2026-01-21

### ✨ Added

#### macOS Support
- **macOS 앱 번들**: PyInstaller macOS spec(arm64)로 Saekim.app 빌드, 리소스/아이콘 포함
- **PDF 내보내기 브라우저 처리**: Playwright 런타임 훅이 사용자 캐시(`~/.cache/ms-playwright`)를 우선 사용하고, 필요 시 첫 실행에 자동 다운로드
- **PKG 설치기**: postinstall 스크립트가 설치 중 Chromium을 자동 내려받아 사용자 캐시에 배치(수동 설치 불필요)
- **macOS UX 정비**: Frameless 창 유지, Cmd 기반 StandardKey 단축키 적용, macOS 렌더링 안정화(QT_MAC_WANTS_LAYER 등 환경 설정)

### 🐛 Fixed
- **Playwright 서명 오류 회피**: PyInstaller 빌드 시 Playwright Chromium 바이너리를 codesign 대상에서 제외하여 macOS COLLECT 단계 실패를 방지

---

## [1.2.0] - 2025-12-23

### ✨ Added

#### UI/UX Enhancements
- **Resize Overlay**: 창 크기 조정 중 반투명 오버레이와 "크기 조정 중..." 메시지 표시
  - 150ms debounce로 부드러운 사용자 경험 제공
  - Pretendard 폰트로 일관된 타이포그래피
- **Pretendard Font Bundling**: 시스템 폰트 의존성 제거
  - Variable font (PretendardVariable.ttf) 번들링
  - 앱 시작 시 자동 로드 (QFontDatabase)
  - UI 전체에 일관된 폰트 적용

#### ViewToggleButton 스타일 개선
- **모든 테마 지원**: Edit/View/Split 버튼의 active/inactive 상태를 명확히 구분
  - **Nord**: Active (청록 배경/#88C0D0), Inactive (회색 배경)
  - **Catppuccin mocha**: Active (라벤더 배경/#89b4fa), Inactive (중간 회색)
  - **white**: Active (검은 배경), Inactive (밝은 회색)
  - **black**: Active (흰 배경), Inactive (어두운 회색)
- **시각적 피드백**: Bold 폰트, hover 효과, 부드러운 색상 전환

#### 파일 새로고침 기능
- **수동 새로고침**: F5 단축키 및 툴바 새로고침 버튼 추가
- **자동 새로고침**: QFileSystemWatcher를 사용한 외부 파일 변경 감지
  - 파일이 외부에서 수정될 때 자동으로 콘텐츠 리로드
  - 파일 삭제/이름 변경 등 edge case 처리

### 🐛 Fixed
- **Black Screen on Resize**: 창 크기 조정 시 에디터/프리뷰 영역이 검게 변하는 문제 해결
  - JavaScript opacity toggle (0.999 → 1)로 강제 reflow
  - 리사이즈 오버레이로 시각적 피드백 제공
- **Edit/View Button State**: 버튼 선택 상태가 불명확했던 문제 개선
  - 테마별 커스텀 스타일링
  - Active 상태의 명확한 시각적 구분

### 📝 Documentation
- **LICENSES.md**: Pretendard 폰트 라이센스 추가 (SIL OFL-1.1)
- **.gitignore**: 빌드 결과물, 임시 파일, 사용자 데이터 제외 규칙 강화
  - `*.exe`, `*.msi` 등 빌드 파일
  - `src/resources/fonts/*.zip` 폰트 압축 파일
  - `.saekim/` 사용자 세션 데이터
  - `*_OLD.*`, `*_BACKUP.*` 백업 파일

### 🔧 Technical Details
- **Font Loading**: Pretendard Variable 폰트를 main.py에서 QFontDatabase로 로드
- **Resize Handler**: 150ms debounce timer + forced webview repaint
- **File Watcher**: QFileSystemWatcher를 MainWindow에 통합
- **Theme System**: ViewToggleButton 스타일을 모든 테마 QSS 파일에 추가

---


## Version Comparison

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 3.1.0 | Unreleased | Editor tab indent, smoother dash handling, arrow/ascii diagram rendering, preview layout popup fixes, recent-file close cleanup, Windows text icon handling |
| 3.0.1 | Unreleased | Flexible text-file detection, HTML/data previews, image assets workflow, preview block layouts, Windows desktop support |
| 3.0.0 | Unreleased | Tauri migration, native file/session commands, resizable editor/preview, synced scrolling, CSS-template PDF export, Shiki highlighting, bundled fonts |
| 1.3.0 | 2026-01-21 | macOS app bundle, PDF export browser handling, PKG installer, macOS UX cleanup |
| 1.2.0 | 2025-12-23 | Resize overlay, Pretendard font, ViewToggle styles, Refresh feature |


---

**Legend:**
- ✨ Added: 새로운 기능
- 🐛 Fixed: 버그 수정
- 🔧 Performance: 성능 개선
- 📝 Documentation: 문서 업데이트
- 🛠️ Build: 빌드/배포 관련
