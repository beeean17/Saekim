# Changelog

All notable changes to Saekim will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.0.0] - 2026-09-08

### Added

- Vitest 기반 프런트엔드 회귀 테스트와 Linux 검사, macOS·Windows·Linux 데스크톱 빌드를 수행하는 GitHub Actions CI를 추가했습니다.
- Git tag에서 서명된 설치 파일과 업데이트 매니페스트를 만드는 릴리스 워크플로우를 추가하고, 앱 시작 시 새 버전을 확인해 알림으로 안내한 뒤 사용자가 선택하면 설치 후 다시 시작하도록 했습니다.
- macOS 최근 문서 등록, Open Recent File, 문서 제목·수정 상태, Find, Zoom, GitHub 및 단축키 네이티브 메뉴를 추가했습니다.
- 한국어와 영어를 즉시 전환하고 선택한 언어를 세션에 유지하는 경량 국제화 계층을 추가했습니다.
- 편집 내용을 2초 디바운스 또는 창 blur 시점에 자동 스냅샷으로 남기고, 로컬 버전 목록·미리보기·선택 복원·5분 전 복원을 제공하도록 메타데이터 스키마를 v4로 확장했습니다.
- 명령 레지스트리에서 플랫폼별 표기로 만드는 단축키 목록과 버전 정보 대화상자를 추가했습니다.
- 데스크톱에 전체 화면 전환 명령을 추가했습니다. Windows·Linux는 `F11`, macOS는 시스템 단축키 `⌃⌘F`를 사용합니다.
- 오류와 작업 결과를 작업을 막지 않는 화면 구석 알림으로 표시하는 알림 영역을 추가했습니다.
- 탭이 탭 줄 너비를 넘으면 열린 문서 전체를 고를 수 있는 목록 메뉴를 추가했습니다.

### Changed

- 편집기의 실행 취소·다시 실행을 문서별 기록으로 관리해 모두 바꾸기, 버전 복원, 이미지 삽입 같은 프로그램 편집 뒤에도 이어지도록 했습니다. macOS Edit 메뉴의 Undo·Redo도 같은 기록을 사용하며, 이름 입력칸·찾기 바·명령 팔레트 같은 다른 입력칸에서는 각 입력칸의 기본 실행 취소를 그대로 사용합니다.
- 휴지통 이동, 미저장 변경 버리기, 인코딩 변경 확인을 브라우저 기본 confirm 대신 앱 내부 확인 대화상자로 바꾸고, 모두 바꾸기와 버전 복원 전에도 확인하도록 했습니다.
- 문서가 없을 때 빈 화면에서 파일 열기·새 파일·폴더 열기를 바로 실행할 수 있게 하고, 저장·다른 이름으로 저장·인쇄·닫기 명령은 비활성화했습니다.
- 이미지를 끌어 오면 편집기에 놓을 위치 안내를 표시하고, 창이 좁아 분할 보기를 쓸 수 없으면 편집기만 표시한다고 알리도록 했습니다.
- 편집기 글꼴은 Pretendard·IBM Plex Sans KR·시스템 고정폭 중에서 고르고, 줄 번호는 자동·표시·숨김 중에서 지정하도록 설정을 정리했습니다.
- Markdown 코드 블록 구문 강조를 앱에 포함한 40개 언어로 한정해 빌드 산출물을 줄였습니다. 목록에 없는 언어는 강조 없이 표시합니다.
- 앱에 포함하는 Pretendard 글꼴 파일을 가변 woff2 하나로 줄였습니다.
- 데스크톱의 새 파일 명령은 마지막으로 선택한 탐색기 폴더 안에서 확장자를 수정할 수 있는 `untitled.md` 이름 입력을 열고, Enter·포커스 이탈로 생성하며 Escape로 취소하도록 변경했습니다. 폴더 우클릭 메뉴에서도 새 파일·새 폴더를 만들 수 있고, 생성 직후 빈 파일은 `Cmd/Ctrl+Z`로 휴지통에 보내 되돌릴 수 있습니다.
- 폴더를 좌클릭하면 새 파일·새 폴더를 만들 위치로 선택하면서 펼치거나 접고, 우클릭 대상은 별도의 옅은 강조로 표시합니다. 새 폴더 생성은 앱 내부 대화상자를 사용하고, 이름 변경은 현재 탐색기 항목의 이름 칸에서 Enter·포커스 이탈로 확정하거나 Escape로 취소하는 인라인 편집으로 변경했습니다.
- 상단 File 메뉴의 새 파일·새 폴더 명령은 현재 탐색기에서 좌클릭으로 하이라이트한 폴더를 생성 위치로 사용하도록 연결했습니다.
- 탐색기 경로 줄의 새로고침 버튼을 상단 File·Edit 아이콘 옆으로 옮기고 `Cmd/Ctrl+R` 단축키를 추가했습니다.
- 탐색기에서 선택된 파일을 표시하는 왼쪽 강조 막대의 높이를 파일 행에 더 가깝게 늘렸습니다.
- 문서 아웃라인의 왼쪽 선택 막대를 제거하고 Markdown 제목 레벨에 따른 접이식 부모·자식 트리로 변경했습니다.
- 사이드바 표시 여부를 설정에서 제어하도록 옮기고 사이드바 안의 중복된 View 메뉴를 제거했습니다.
- Android compact 화면은 상단 파일명을 하단 상태바로 옮기고 CRLF 및 행·열 정보를 숨기며, 공간이 좁을 때는 단어 수도 숨기도록 변경했습니다.
- Android 상단 바는 파일 탐색기 버튼을 카메라 영역 왼쪽에 유지하고 편집·보기 아이콘과 설정 버튼을 오른쪽에 배치했습니다. 별도의 하단 편집·보기 탭 행은 제거했습니다.
- Android 파일 탐색기 드로어가 화면 최상단부터 열리도록 확장하고, 상단의 폴더·File·Edit·새로고침 아이콘을 왼쪽 정렬과 가로 스크롤로 배치했습니다.
- Android의 KaTeX·Mermaid 도우미는 가로 공간을 확보하기 위해 오른쪽 렌더 미리보기를 제거하고 단일 열 목록과 삽입 동작만 제공하도록 변경했습니다.
- macOS 릴리스 빌드에 hardened runtime, entitlements, 최소 시스템 버전 10.15를 명시하고 Apple notarization과 Windows 인증서 설정을 GitHub Secrets에서만 주입하도록 변경했습니다.
- Windows PDF 내보내기는 WebView2 네이티브 PDF API를 우선 사용해 텍스트 선택·검색과 링크를 유지하며, macOS와 네이티브 출력을 지원하지 않는 환경에서는 기존 캔버스 렌더러로 폴백하도록 변경했습니다.
- PDF 페이지 나눔 정책을 CSS `@page`와 `break-inside` 중심으로 옮겨 네이티브 벡터 출력에서도 제목과 주요 블록의 흐름을 유지하도록 변경했습니다.
- 같은 내용·인코딩·개행·저장 상태의 연속 스냅샷은 중복 저장하지 않고 파일마다 최근 100개만 보관하도록 변경했습니다.

### Breaking Changes

- Windows PDF 출력 엔진이 래스터 이미지 기반 문서에서 네이티브 벡터 문서로 바뀌었습니다. 텍스트와 링크는 보존되지만 기존 PDF와 페이지 경계, 글꼴 배치, 여백이 픽셀 단위로 같지 않을 수 있습니다.
- macOS 최소 지원 버전을 Tauri 기본값인 10.13에서 10.15로 올려 macOS 10.13과 10.14 지원을 종료했습니다.

### Fixed

- Android에서 화면을 회전해도 짧은 쪽 길이를 기준으로 휴대전화와 태블릿 레이아웃을 안정적으로 유지하도록 수정했습니다.
- 구조화 데이터와 표 데이터의 Raw 모드에서도 API·Tree·Table·Raw 전환 탭이 사라지지 않도록 수정했습니다.
- 탭 전환·닫기와 탐색기 루트를 분리하고, 저장된 워크스페이스를 열거나 복원할 때 실제 폴더 내용을 다시 읽도록 수정했습니다.
- 파일이나 폴더를 휴지통으로 이동한 뒤 삭제된 경로의 문서 탭이 남아 있던 문제를 수정했습니다.
- 파일을 우클릭할 때 이름 텍스트가 드래그 선택된 것처럼 남고 이름 변경 명령이 열리지 않던 문제를 수정했습니다.
- macOS에서 Control 조합을 Command와 같은 앱 단축키로 처리해 `Ctrl+H`, `Ctrl+K` 같은 시스템 편집 키가 동작하지 않던 문제를 수정했습니다.
- 제목 표시줄을 더블클릭하면 최대화가 두 번 전환되어 원래 크기로 돌아오던 문제를 수정했습니다.
- 고정폭 편집기 글꼴을 골라도 해당 글꼴이 없는 기기에서는 비례폭 글꼴로 표시되던 문제를 수정했습니다.

---

## [3.5.0] - 2026-09-08

### Added

- 작은 화면에서 기존 경로, 검색, 파일 트리를 재사용하는 오버레이 파일 브라우저와 배경 탭, 스와이프, Escape 닫기 및 포커스 트랩을 추가했습니다.
- compact 화면에서 편집과 미리보기를 바로 전환하는 하단 탭을 추가했습니다.
- 줄번호 표시 설정을 추가하고 compact 화면에서는 선택하지 않은 경우 자동으로 숨기도록 했습니다.

### Changed

- 레이아웃 폭은 viewport profile로 유지하면서 포인터 정밀도, 모션 감소, 안전 영역은 CSS 기기 특성 쿼리로 분리했습니다.
- coarse pointer에서 사이드바, 버튼, 분할 조절선의 실효 터치 영역을 최소 44px로 확대했습니다.
- 편집기와 헬퍼 모달이 동적 뷰포트 높이와 좁은 화면 여백을 사용하도록 조정했습니다.
- 셸의 경쟁하던 grid 규칙을 명시적 레이아웃 변수로 통합하고 터치 스크롤바와 overscroll 동작을 정리했습니다.
- Android 7.0(API 24) 이상을 정식 지원 범위로 문서화하고 target SDK 36 APK를 실제 에뮬레이터에서 검증했습니다.

---

## [3.4.0] - 2026-09-08

### Added

- 열린 문서를 탭으로 전환하고 닫은 탭을 `Cmd/Ctrl+Shift+T`로 복원하는 문서 탭 스트립을 추가했습니다.
- 정규식, 대소문자, 단어 단위, 선택 영역 옵션을 지원하는 바꾸기와 전체 바꾸기를 추가했습니다.
- 워크스페이스 전체의 파일 내용을 검색하고 줄·열·미리보기·파일별 결과 수를 표시하는 검색을 추가했습니다.
- 워크스페이스 트리에 파일·폴더 이름 변경, 새 폴더 생성, 복제, 운영체제 휴지통 이동 작업을 추가했습니다.
- Markdown 제목을 원본 줄 위치와 함께 표시하고 선택한 제목으로 이동하는 문서 개요 사이드바를 추가했습니다.
- 명령 라벨, ID, 단축키를 검색해 실행하는 `Cmd/Ctrl+K` 명령 팔레트를 추가했습니다.

### Changed

- 키보드 단축키, 애플리케이션 메뉴, 명령 팔레트가 같은 명령 메타데이터와 실행 함수를 사용하도록 통합했습니다.
- 문서 탭의 `Cmd/Ctrl+1~9` 단축키를 유지하기 위해 보기 모드 전환을 `Cmd/Ctrl+Shift+1~3`으로 배치했습니다.
- 버튼, 링크, 입력 요소에 일관된 키보드 포커스 표시를 적용하고 대화상자에서 초점이 밖으로 빠지지 않도록 조정했습니다.
- 파일 읽기 결과와 저장 요청에 디스크 수정 시각과 크기로 구성한 revision 메타데이터를 포함하도록 확장했습니다.

### Fixed

- 파일을 연 뒤 외부 프로그램에서 내용이 바뀐 경우 저장이 조용히 덮어쓰지 않고 다시 불러오기, 다른 이름으로 저장, 덮어쓰기를 선택하도록 수정했습니다.

---

## [3.3.0] - 2026-09-08

### Added

- 창별 위치와 크기를 저장하고 다음 실행에서 복원하도록 창 상태 플러그인을 추가했습니다.
- 시스템 색상 모드를 따라 밝은 테마와 어두운 테마를 자동으로 전환하는 설정을 추가했습니다.
- 저장 위치를 정하지 않고 바로 편집할 수 있는 메모리 기반 새 문서를 추가했습니다.
- 접힌 하위 폴더까지 순회하고 커서 기반으로 페이지를 나누는 워크스페이스 파일명 검색을 추가했습니다.

### Changed

- 보조 창에도 Tauri 이벤트 권한을 적용하고 DOM 이벤트 주입, 중복 emit, 폴링 우회 코드를 제거했습니다.
- Linux에서 애플리케이션 메뉴를 표시하고 macOS 전용 타이틀바 설정을 플랫폼 설정으로 분리했습니다.
- 중간 폭에서는 뷰 모드 아이콘을 유지하고, 최소 폭보다 좁은 화면에서는 분할 뷰를 선택할 수 없도록 조정했습니다.
- 저장된 문서 본문을 세션 메타데이터에서 제외하고 디스크에서 복원하며, 저장되지 않은 본문만 별도 초안으로 보관하도록 스키마를 v3로 변경했습니다.
- UI와 설정은 400ms, 문서 상태는 2초 또는 창 포커스를 잃을 때 저장하도록 세션 저장 주기를 분리했습니다.

### Fixed

- `Cmd/Ctrl+P`가 인쇄를 실행하도록 복원하고 PDF 내보내기 단축키를 `Cmd/Ctrl+Shift+E`로 옮겼습니다.
- 닫힌 파일이 탐색 기록에 남아 있어도 뒤로·앞으로 이동할 때 디스크에서 다시 열도록 수정했습니다.
- UTF-8 BOM과 UTF-16 LE/BE 인코딩을 감지하고 같은 형식으로 왕복 저장하도록 수정했습니다.

---

## [3.2.1] - 2026-09-08

### Changed

- 미리보기 갱신 간격과 렌더 키를 조정해 입력 중 불필요한 전체 재렌더를 줄였습니다.
- 창 최소 폭을 사이드바 상태와 분리하고 좁은 공간은 반응형 레이아웃으로 처리하도록 조정했습니다.

### Fixed

- 문서 저장을 임시 파일 쓰기, 디스크 동기화, 원본 권한 보존, 원자적 교체 순서로 처리하고 실패한 임시 파일을 정리하도록 수정했습니다.
- UTF-8 BOM과 LF, CRLF, 혼합 개행을 감지해 상태바에 표시하고 원래 개행 형식으로 왕복 저장하도록 수정했습니다.
- 멀티 윈도우 메타데이터 연결을 WAL과 busy timeout이 적용된 단일 연결로 직렬화해 SQLite 잠금 충돌을 줄였습니다.
- `Cmd/Ctrl+W`로 활성 파일을 닫고 열린 파일이 없을 때만 창을 닫으며, macOS 메뉴에서 파일 닫기와 창 닫기를 구분하도록 수정했습니다.
- 워크스페이스 아래 파일을 저장하거나 다른 이름으로 저장해도 루트와 폴더 펼침 상태가 유지되도록 수정했습니다.
- 현재 파일 형식을 실제 파일 유형 판정 결과에 따라 상태바에 표시하도록 수정했습니다.
- Android 다크 테마에서 배경과 시스템 바 색상 및 밝은 아이콘 설정이 적용되도록 수정했습니다.
- 변경된 파일이나 창 및 앱을 닫을 때 네이티브 대화상자에 대상 파일을 표시하고 저장, 저장 안 함, 취소를 선택할 수 있도록 수정했습니다.

---

## [3.2.0] - Unreleased

### Added

- 기능 레지스트리와 플랫폼별 capability/profile 구조를 추가해 데스크톱, 브라우저, Android 기능을 명시적으로 조합할 수 있는 기반을 마련했습니다.
- Android 문서 URI 입출력과 문서 메타데이터 연동, 플랫폼 전용 이미지 선택 및 런처 리소스를 추가했습니다.
- macOS 네이티브 메뉴 이벤트와 사이드바 앱 메뉴를 프론트엔드 명령 체계에 연결했습니다.
- 창별 워크스페이스 메타데이터와 문서 레이아웃 박스 저장을 추가했습니다.
- 미리보기 블럭을 드래그해 그룹화하고 크기와 배치를 조정하는 상호작용을 추가했습니다.

### Changed

- 공통 코드를 core/platform/features 계층과 backend adapter로 재구성하고 런타임 기능을 capability 기반으로 분리했습니다.
- 미리보기 렌더링을 scene/render object와 플랫폼별 surface로 분리해 확장 가능한 렌더링 흐름으로 정리했습니다.
- 최근 파일 중심의 사이드바를 워크스페이스 메뉴 중심으로 단순화하고 화면 크기에 따라 셸 제어가 반응하도록 조정했습니다.
- 편집기 텍스트가 패널 너비에 맞춰 줄바꿈되고 코드블럭 복사와 레이아웃 그룹 처리가 일관되게 동작하도록 개선했습니다.

### Fixed

- PDF 내보내기에서 코드블럭, 목록, KaTeX와 페이지 나눔이 잘리거나 흐름을 잃던 문제를 수정했습니다.
- 미리보기 블럭의 드롭 위치, 그룹 해제, 다단 이미지 크기 조절과 렌더링 안정성 문제를 수정했습니다.
- 파일을 연 직후의 스크롤 동기화와 상태바 커서 위치, 에디터 줄 높이 계산이 어긋나던 문제를 수정했습니다.
- 설정 팝오버가 즉시 닫히거나 앱 크롬 아래에 가려지던 문제를 수정했습니다.

---

## [3.1.0] - 2026-06-08

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
- 공개 3.x 앱의 현재 의존성 기준으로 프로젝트 라이선스와 서드파티 고지 범위를 MIT 중심으로 정리했습니다.

### Fixed

- 한 줄짜리 `-` 입력이 이전 줄을 setext heading처럼 렌더링하던 문제를 수정했습니다.
- preview 블럭 레이아웃 도구가 실제 블럭 외부 여백 클릭으로 열리던 문제를 수정했습니다.
- 최근 파일에서 열린 파일을 `Cmd/Ctrl+W`로 닫아도 최근 파일 목록에 남던 문제를 수정했습니다.
- Shiki 코드블럭 텍스트 선택 시 줄 바깥 여백까지 선택되는 것처럼 보이던 시각 문제를 완화했습니다.
- 코드블럭 줄간을 조정해 텍스트 선택 영역이 위아래 줄과 겹쳐 보이는 문제를 완화했습니다.
- preview 레이아웃 패널이 리스트/인용문 같은 일반 문단 요소에도 표시되던 문제를 수정했습니다.
- KaTeX 블록 수식에 코드블럭과 같은 라벨과 레이아웃 패널 처리를 적용했습니다.
- 코드블럭 편집 중 스크롤 동기화된 preview가 위로 튀는 문제를 완화했습니다.
- 코드블럭을 여러 줄 드래그 선택할 때 줄 끝에 빈칸처럼 보이는 선택 배경 깨짐을 수정했습니다.
- 코드블럭 줄 높이를 글자 크기별 px 행 높이로 계산하고, 플로팅 레이아웃 패널이 텍스트 선택에 포함되지 않도록 수정했습니다.

---

## [3.0.1] - 2026-05-30

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
| 4.0.0 | 2026-09-08 | Cross-platform CI and signed release pipeline, native vector PDF export, macOS document integration, Korean/English UI, autosave snapshots and local version history |
| 3.5.0 | 2026-09-08 | Responsive device foundations, 44px touch targets, compact file drawer and view tabs, mobile editor space recovery, Android dark-mode and rotation support |
| 3.4.0 | 2026-09-08 | Document tabs and restore, replace and workspace content search, workspace file operations, outline navigation, unified command palette, focus accessibility, external-change save protection |
| 3.3.0 | 2026-09-08 | Secondary-window events, restored window geometry, system theme, in-memory drafts, recursive workspace search, encoding round trips, body-free session metadata |
| 3.2.1 | 2026-09-08 | Atomic and line-ending-safe saves, serialized metadata access, dirty-close protection, stable workspace roots, responsive window constraints, Android dark system bars |
| 3.2.0 | Unreleased | Capability-based platform architecture, Android document integration, native app menus, responsive shell, persistent preview layouts, PDF export stability |
| 3.1.0 | 2026-06-08 | Editor tab indent, smoother dash handling, arrow/ascii diagram rendering, preview layout popup fixes, source-line preview sync, code block selection stability, recent-file close cleanup, Windows text icon handling |
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
