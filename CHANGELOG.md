# Changelog

All notable changes to Saekim will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - **Dark**: Active (파란 배경/#007ACC), Inactive (어두운 회색)
  - **Catppuccin**: Active (라벤더 배경/#89b4fa), Inactive (중간 회색)
  - **White**: Active (검은 배경), Inactive (밝은 회색)
  - **Black**: Active (흰 배경), Inactive (어두운 회색)
  - **GitHub Primer**: Active (GitHub 파랑/#0366d6), Inactive (중간 회색)
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
| 1.2.0 | 2025-12-23 | Resize overlay, Pretendard font, ViewToggle styles, Refresh feature |


---

**Legend:**
- ✨ Added: 새로운 기능
- 🐛 Fixed: 버그 수정
- 🔧 Performance: 성능 개선
- 📝 Documentation: 문서 업데이트
- 🛠️ Build: 빌드/배포 관련
