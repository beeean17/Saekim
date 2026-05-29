# Story 1.1: Platform-Specific Entry Point

## Goal
`main.py`가 OS를 감지해 각 플랫폼에 맞는 초기화를 수행하고, macOS/Windows 모두에서 문제없이 실행되도록 만든다.

## Acceptance Criteria
- `sys.platform == 'darwin'` 분기 추가 및 macOS 초기화 안전하게 수행
- Windows 전용 import(`ctypes`)는 `win32` 가드 뒤에 배치
- macOS에서 애플리케이션이 오류 없이 실행
- Windows 빌드/실행은 기존과 동일하게 유지
- 고해상도 설정은 macOS에서 기본 PyQt6 동작으로 충분한지 검증

## Notes
- DPI/AppUserModelID 설정은 win32 전용으로 유지
- QApplication 생성 전 HighDpiScaleFactorRoundingPolicy 설정 유지
- 로그 초기화는 setup_logger() 단일 호출만 허용
