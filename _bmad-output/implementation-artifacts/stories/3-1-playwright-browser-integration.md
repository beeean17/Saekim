# Story 3.1: Playwright Browser Integration

## Goal
macOS에서 Playwright 기반 PDF 내보내기가 정상 동작하도록 브라우저 다운로드/경로 문제를 해결한다.

## Acceptance Criteria
- Playwright가 macOS용 Chromium 바이너리를 최초 실행 시 다운로드
- PDF export가 성공적으로 완료됨
- 브라우저 실행/경로 문제로 인한 에러가 없어야 함

## Notes
- 오프라인 환경이면 사전 다운로드/캐시 경로를 안내해야 함
- PyInstaller 번들에서 Playwright 데이터 경로 확인 필요
- 첫 실행 시 네트워크 필요성을 사용자에게 명시
