---
project_name: 'Saekim'
user_name: 'Yoon'
date: '2026-01-19'
sections_completed: ['technology_stack']
existing_patterns_found: 0
sections_completed: ['technology_stack', 'language', 'framework', 'testing', 'code_quality', 'workflow', 'critical_rules']
existing_patterns_found: 0
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Python 3.10+ (consistent across Windows/macOS per architecture)
- PyQt6 >= 6.6.0 and PyQt6-WebEngine >= 6.6.0
- PyQt6-Frameless-Window >= 0.3.0 for cross-platform chrome
- Playwright >= 1.40.0 (Chromium download on first run; ensure network or pre-bundled browser)
- PyMuPDF >= 1.24.0; pdfplumber >= 0.11.0
- Markdown >= 3.5.0
- Packaging: PyInstaller spec saekim_macos.spec, entitlements.plist, codesign + notarization + staple flow for macOS .app

## Critical Implementation Rules

### Language-Specific Rules (Python)

- Gate platform guards: wrap Windows-only ctypes (DPI, AppUserModelID, nativeEvent) so macOS/Linux never import ctypes.windll; prefer a window strategy for chrome. See src/main.py and src/windows/main_window.py.
- Prefer Qt standard shortcuts: use QKeySequence.StandardKey to auto-map Cmd/Ctrl; avoid hardcoded modifiers.
- High DPI: keep QApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough) before QApplication creation.
- Logging: initialize via setup_logger() once at entry; do not reconfigure per module.
- Resource loading: use FileManager.resource_path for assets (fonts, icons) to stay PyInstaller-safe; avoid os.getcwd()-based paths.
- WebEngine repaint: preserve debounced repaint logic during resize; avoid blocking the UI thread inside resizeEvent.
- Threading: offload long-running work (update checks, I/O) to threads; use signals/slots with queued connections across threads.
- Path handling: prefer pathlib throughout; avoid hardcoded separators.
- Packaging: avoid __file__ assumptions that break under PyInstaller; keep imports explicit and static-friendly.

### Framework-Specific Rules (PyQt6, WebEngine, Frameless)

- Window chrome: prefer qframelesswindow.FramelessMainWindow (or equivalent) for cross-platform chrome; keep Windows nativeEvent code behind platform guards; avoid ctypes on macOS/Linux.
- Title bar integration: wire custom TitleBar buttons to Frameless window APIs; ensure hit-testing/drag uses the library on macOS, not manual ctypes math.
- High DPI: set QApplication HighDpiScaleFactorRoundingPolicy before QApplication creation; avoid per-widget scaling hacks.
- WebEngine: keep QWebEngineSettings tuned and use debounced repaint to prevent black flashes on resize; avoid blocking the UI thread during resize.
- Shortcuts: use QKeySequence.StandardKey for actions so Cmd/Ctrl map automatically; avoid hardcoded modifier masks.
- Resource loading: load UI assets via FileManager.resource_path to stay PyInstaller-safe inside the .app bundle.
- Thread boundaries: UI stays on the main thread; background work uses QThread/QRunnable with signals; avoid blocking slots that touch QWebEngineView.

### Testing Rules (테스트 규칙)

- UI/웹엔진 경계: QWebEngineView 관련 테스트는 기능/스모크 수준으로 수행하고, PyQt 시그널/슬롯 흐름을 무리하게 모킹하지 말 것(크래시/블랙스크린 회귀 방지).
- 플랫폼 가드: Windows 전용 ctypes 코드 경로가 macOS에서 호출되지 않는지 간단한 단위 테스트/가드 추가.
- 리사이즈/리페인트: 리사이즈 시 블랙스크린 회귀를 막기 위해 디바운스 로직 유지 여부를 스모크 테스트로 확인.
- 단축키: QKeySequence.StandardKey로 정의된 액션이 macOS에서 Cmd로 매핑되는지 스모크 테스트(핫키 표 기반).
- 업데이트 체크 스레드: 백그라운드 스레드가 UI 스레드를 블록하지 않는지(창이 멈추지 않는지) 확인.
- 패키징/번들: PyInstaller .app 빌드 후 리소스(폰트, 아이콘) 로딩 경로가 FileManager.resource_path로 정상 동작하는지 기본 실행 스모크.
- PDF/Playwright: Playwright 최초 실행 시 브라우저 다운로드 경로/권한 문제가 없는지 확인(네트워크 필요성 명시).
- 회귀 안전장치: macOS 전용 프레임리스 창 동작(드래그/리사이즈/최대화) 스모크 체크리스트 유지.

### Code Quality & Style Rules

- 경로/리소스: pathlib 사용, FileManager.resource_path로 번들 안전 경로 확보; os.getcwd 기반 경로 금지.
- 임포트: 정적 임포트 유지(동적 import 지양)해 PyInstaller 호환성 확보; __file__ 의존 줄이기.
- 명명: 클래스 PascalCase, 함수/메서드 snake_case, 상수 UPPER_SNAKE; UI 위젯/시그널 이름도 일관 snake_case.
- 로깅: setup_logger() 단일 초기화 후 모듈별 logger = logging.getLogger(__name__); print() 디버그 지양.
- 주석/문서: 비자명한 플랫폼 가드(Windows/macOS 분기), 리사이즈/리페인트 디바운스, WebEngine 특수 처리에만 간결 주석.
- 에러 처리: UI 스레드 블록 피하기(try/except 후 logger.warning); 사용자 영향 동작은 graceful fallback 우선.
- 포매팅: 기존 코드 스타일 유지(PEP8 근접); 지나친 줄바꿈/정렬 변경으로 diff 노이즈 만들지 말 것.
- 리소스/아이콘: DesignManager, ThemeManager 경유로 색상/테마 반영; 직접 경로 지정 금지.
- 단축키/메뉴: QKeySequence.StandardKey 우선, 커스텀 키는 플랫폼별 Cmd/Ctrl 고려해 조건 분기.

### Development Workflow Rules

- 브랜치/커밋: 브랜치명은 작업 맥락을 드러내도록 단순/일관되게, 커밋은 의미 단위로 작게(기능/버그/리팩터) 쪼개고 영어 현재형 메시지 유지.
- PR/리뷰: macOS 변경 시 최소 스모크 체크리스트(실행, 리사이즈, 단축키, PDF/Playwright 동작) 결과를 PR 설명에 명시.
- 상태 추적: sprint-planning → sprint-status.yaml 흐름 준수; macOS 작업은 해당 스토리/태스크에 기록.
- 배포/패키징: macOS .app/.dmg 빌드 시 codesign → notarize → staple 순서 준수; 빌드 스크립트와 entitlements.plist 버전 관리.
- 리소스 자산: 아이콘(.icns), 폰트 등은 repo에 포함하고 FileManager.resource_path 경유로 접근; 외부 의존 경로 기재 금지.

### Critical Don't-Miss Rules

- macOS 경계: Windows 전용 ctypes/nativeEvent 로직은 반드시 플랫폼 가드; macOS에서는 qframelesswindow 경로만 사용.
- 리사이즈/리페인트: 디바운스 제거 금지(블랙스크린 회귀 위험); WebEngine 강제 리페인트 토글 로직 유지.
- 단축키: 하드코딩된 Ctrl 조합 금지; QKeySequence.StandardKey로 Cmd 매핑 확보.
- 리소스 경로: os.getcwd, 상대경로 하드코딩 금지; FileManager.resource_path 필수.
- Playwright: 최초 실행 시 네트워크 필요; 오프라인 환경이면 사전 다운로드/캐시 경로 명시.
- 패키징: PyInstaller 빌드 시 __file__ 의존, 동적 import 피하기; codesign → notarize → staple 순서 불변.
