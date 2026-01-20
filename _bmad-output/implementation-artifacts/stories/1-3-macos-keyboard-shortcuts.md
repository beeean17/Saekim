# Story 1.3: macOS Keyboard Shortcuts

## Goal
Cmd 기반 단축키를 macOS에서 네이티브처럼 동작하도록 하고, Windows에서도 기존 Ctrl 매핑을 유지한다.

## Acceptance Criteria
- `QKeySequence.StandardKey`로 주요 액션(New/Open/Save/Close/Quit/Find) 정의
- macOS에서 Cmd로, Windows에서 Ctrl로 자동 매핑 확인
- WebView 내 텍스트 편집 기본 단축키(Cmd+C/V/Z 등) 정상
- 명시적 키 하드코딩 제거 또는 플랫폼 가드 적용

## Notes
- QAction/QShortcut를 생성할 때 StandardKey를 우선 사용
- 커스텀 키가 필요하면 플랫폼별 분기( win32 vs darwin )로 정의
- 메뉴/툴바/타이틀바 버튼 액션과 시그널 연결 시 동일 키 시퀀스 공유
