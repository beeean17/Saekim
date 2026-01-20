# Story 1.2: Cross-Platform Window Management

## Goal
PyQt6-Frameless-Window를 통합하고 MainWindow를 교체하여 macOS/Windows 모두에서 네이티브에 가까운 프레임리스 창을 제공한다.

## Acceptance Criteria
- `PyQt6-Frameless-Window` 라이브러리 통합
- `MainWindow`가 `FramelessMainWindow`를 상속하도록 변경
- macOS에서 stoplight(닫기/최대화/최소화) 동작 정상
- Windows에서 Aero Snap/리사이즈 정상
- 커스텀 타이틀바로 드래그 이동 가능
- 기존 `nativeEvent` 기반 Windows 코드 제거 또는 플랫폼 가드 처리

## Notes
- macOS에서는 ctypes 호출 금지, 라이브러리 기능 사용
- 타이틀바 버튼 시그널을 프레임리스 API에 연결 필요
- 리사이즈/리페인트 디바운스 로직은 유지하며 WebEngine 블랙스크린 회귀 방지
