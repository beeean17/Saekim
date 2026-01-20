# Story 2.1: PyInstaller macOS Configuration

## Goal
`saekim_macos.spec`를 작성해 macOS용 standalone `.app` 번들을 빌드 가능하게 만든다.

## Acceptance Criteria
- `saekim_macos.spec` 작성: 이름 `Saekim.app`, bundle 구조 생성
- `.icns` 아이콘 포함 (경로 명시)
- `Info.plist`에 버전, HighDPI 키 포함 (예: CFBundleShortVersionString, NSHighResolutionCapable)
- 클린 macOS 환경(파이썬 미설치)에서 빌드 산출물 실행 가능

## Notes
- 빌드 산출물 위치를 명확히 기록 (예: dist/Saekim.app)
- Playwright/리소스 경로가 PyInstaller 번들에서 정상 로드되는지 확인 필요
- entitlements/codesign/노타라이즈는 후속 스토리(2.2/2.3)에서 처리
