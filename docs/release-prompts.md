# Saekim 릴리스 실행 프롬프트

[improvement-plan.md](improvement-plan.md)의 마일스톤을 실제 작업으로 옮기기 위한
프롬프트 모음입니다. 각 프롬프트는 **새 세션에 그대로 붙여넣어도 동작하도록**
자체 완결적으로 작성했습니다.

| 마일스톤 | 버전 | 성격 | 항목 수 |
| --- | --- | --- | :-: |
| 데이터 안전성 핫픽스 | `3.2.1` | patch | 10 |
| 플랫폼 정리 | `3.3.0` | minor | 12 |
| 에디터 완성도 | `3.4.0` | minor | 8 |
| 태블릿과 모바일 | `3.5.0` | minor | 4 + 기반 2 |
| 배포와 확장 | `4.0.0` | major | 6 |

항목 배치는 [improvement-plan.md](improvement-plan.md)의 마일스톤 표를 그대로 따릅니다.
`3.5.0`만 예외로, 계획 문서의 4개 항목에 더해 U-0(기능 쿼리 기반)과
U-7의 compact 부분을 선행 작업으로 포함했습니다 — 나머지가 그 위에 얹히기 때문입니다.

---

## 선행 정리 — 버전 드리프트

**어느 마일스톤보다 먼저 처리해야 합니다.** 현재 저장소에 버전 불일치가 있습니다.

| 문제 | 현재 상태 |
| --- | --- |
| `README_KR.md`가 한 버전 뒤 | 배지 `3.1.0`, 태그 예시 `v3.1.0` (`README.md`는 `3.2.0`) |
| `CHANGELOG.md`에 3.2.0 항목 없음 | `## [3.1.0] - Unreleased`가 최신인데 `package.json`은 `3.2.0` |
| About 대화상자에 버전 하드코딩 | `src/components/shell/appMenus.ts:146`의 `window.alert('Saekim 3.2.0')` |

아래 프롬프트로 먼저 정리하세요.

```
Saekim 저장소의 버전 표기 드리프트를 정리해줘.

현재 상태:
- package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json → 3.2.0
- README.md 배지와 태그 예시 → 3.2.0
- README_KR.md 배지(3행)와 태그 예시(124행) → 3.1.0 (뒤처짐)
- CHANGELOG.md 최상단이 "## [3.1.0] - Unreleased" (3.2.0 항목 자체가 없음)
- src/components/shell/appMenus.ts:146에 'Saekim 3.2.0' 문자열 하드코딩

작업:
1. README_KR.md의 배지와 태그 예시를 3.2.0으로 맞춘다.
2. CHANGELOG.md를 정리한다.
   - 기존 [3.1.0] - Unreleased 항목의 실제 릴리스 여부를 git tag로 확인
     (git tag --list 'v3.*', git log --oneline v3.1.0..HEAD)
   - 3.1.0이 이미 태그되어 있으면 날짜를 태그 날짜로 채운다.
   - 3.2.0 항목을 새로 추가한다. 내용은 3.1.0 이후 커밋 로그에서 뽑되,
     기존 CHANGELOG의 한국어 서술 스타일과 Added/Changed/Fixed 구분을 그대로 따른다.
   - 문서 하단 버전 요약 표(262행 부근)에도 3.2.0 행을 추가한다.
3. appMenus.ts의 하드코딩을 제거한다.
   - vite.config.ts에 define으로 package.json의 version을 주입하거나
     import.meta.env를 쓴다. 방식은 기존 빌드 설정에 맞는 쪽으로 고른다.
   - About 라벨이 빌드 시점 버전을 자동으로 따르게 만든다.
   - src/vite-env.d.ts에 타입 선언을 추가한다.

제약:
- 버전 숫자 자체는 올리지 않는다. 3.2.0 상태를 정확히 반영하는 것이 목적이다.
- 기능 코드는 건드리지 않는다.

검증: corepack pnpm lint && corepack pnpm build
커밋: chore: reconcile version metadata across docs and about dialog
```

---

## 버전 릴리스 절차

각 마일스톤 프롬프트가 참조하는 공통 절차입니다.
**버전을 올릴 때 아래 6곳을 모두 갱신해야 합니다.**

| # | 파일 | 위치 |
| :-: | --- | --- |
| 1 | `package.json` | 3행 `"version"` |
| 2 | `src-tauri/Cargo.toml` | 3행 `version` |
| 3 | `src-tauri/tauri.conf.json` | 4행 `"version"` |
| 4 | `src-tauri/Cargo.lock` | `name = "saekim"` 패키지의 `version` |
| 5 | `README.md` | 3행 배지, 126행 태그 예시 |
| 6 | `README_KR.md` | 3행 배지, 124행 태그 예시 |

`Cargo.lock`은 손으로 고치지 말고 `cargo update -p saekim --precise <새 버전>`
또는 `cargo check`로 갱신하세요.

「선행 정리」를 마쳤다면 About 대화상자는 자동으로 따라옵니다.
아직이라면 `src/components/shell/appMenus.ts:146`도 함께 고쳐야 합니다.

**CHANGELOG** — 새 버전 섹션을 최상단에 추가하고 기존 형식을 따릅니다.

```markdown
## [<버전>] - <YYYY-MM-DD>

### Added / Changed / Fixed
- 한국어 서술형, "~했습니다" 종결
```

문서 하단의 버전 요약 표에도 행을 추가합니다.

**커밋 규칙** — Conventional Commits, 주어 없는 명령형 문장.
저장소의 기존 스타일을 따릅니다 (`feat(tauri): ...`, `fix: ...`, `refactor: ...`).
릴리스 커밋은 `chore(release): bump to <버전>`.

---

## 3.2.1 — 데이터 안전성 핫픽스

가장 위험한 항목과, 몇 줄로 체감이 바뀌는 수정을 모았습니다.
**patch 릴리스이므로 새 기능이나 UI 재구성은 넣지 않습니다.**

```
Saekim 3.2.1 릴리스 작업을 해줘. 데이터 안전성 핫픽스다.

먼저 docs/improvement-plan.md를 읽고 아래 항목의 근거와 수정 방향을 확인해라.
문서에 파일:줄 번호와 수정 방향이 이미 적혀 있으니 그대로 따른다.

작업 항목 (전부 난이도 '하' 또는 '중'):

P0-2  문서 저장이 비원자적
      src-tauri/src/commands/file.rs:764의 fs::write를
      같은 파일 846/856행의 이미지 저장 패턴(temp write → rename)으로 교체.
      File::sync_all()과 원본 권한 복사까지 포함.
      완료 조건: write_selected_file이 임시 파일 경유로 쓰고,
      실패 시 임시 파일을 정리한다.

P0-3  CRLF가 조용히 LF로 변환됨
      src/store/workspace.ts:180 saveActive에서 file.eol === 'CRLF'이면
      저장 직전 \n을 \r\n으로 복원.
      혼합 개행은 다수결 판정 후 상태바에 Mixed 표시.
      완료 조건: CRLF 파일을 열고 한 글자 고쳐 저장했을 때
      git diff가 해당 줄만 나온다.

P0-8  멀티 윈도우 SQLite 동시성
      src-tauri/src/commands/session.rs:470 open_metadata_connection에
      PRAGMA journal_mode = WAL과 PRAGMA busy_timeout = 3000 추가.
      Connection을 AppState에 Mutex로 보관해 재사용하고,
      initialize_schema는 앱 시작 시 1회만 실행.

P0-7  열린 파일을 닫을 수 없음
      src/store/workspace.ts:147의 closeFile은 이미 구현되어 있는데
      호출부가 없다. Cmd/Ctrl+W를 파일 닫기로 연결.
      열린 파일이 없을 때만 창을 닫는다.
      macOS 네이티브 메뉴(src-tauri/src/platform/macos/native_menu.rs)의
      close_window를 Close File로 바꾸고 Close Window는 Cmd+Shift+W로.

W-1   저장할 때마다 워크스페이스 루트가 튄다
      saveActive / saveActiveAs / createFile 세 곳이
      workspaceFolderPatchForFile을 직접 호출해 rootPath와 tree를 통째로 교체한다.
      셋 다 workspaceFolderPatchForOpenFile(file, get().rootPath)를 쓰도록 통일.
      완료 조건: 워크스페이스 하위 폴더의 파일을 저장해도
      rootPath가 유지되고 폴더 펼침 상태가 남는다.

W-4   타이핑 60ms마다 문서 전체 재렌더
      src/platform/desktop/previewSurface.ts의 debounceMs를 60 → 250.
      src/components/preview/PreviewContent.tsx:88의 previewRenderKey에서
      activeFile.content 전문을 키로 쓰는 부분을 내용 해시나 activeFile.id로 교체.

W-5   사이드바 폭이 OS 창 최소 폭을 결박
      src/hooks/useWindowSizeConstraints.ts가 최소 폭을
      사이드바 폭까지 더해 계산한다. 622px 고정으로 바꾸고,
      공간 부족은 반응형 프로필(사이드바 접기/뷰 모드 강등)로 대응.

W-6   상태바가 파일 형식을 거짓 표시
      src/components/shell/StatusBar.tsx:12의
      name.endsWith('.txt') ? 'Text' : 'Markdown' 삼항을
      getFileTypeLabel(activeFile.name, activeFile.path, enabledFeatures)로 교체.

U-2   Android 다크 모드 테마 미구현
      src-tauri/gen/android/app/src/main/res/values-night/colors.xml을 새로 만든다
      (현재 없음). 다크용 saekim_background / saekim_system_bar 지정.
      values-night/themes.xml의 windowLightStatusBar와
      windowLightNavigationBar를 false로. 현재 day 테마와 바이트 단위로 동일하다.
      주의: gen/android는 tauri android init이 재생성할 수 있으니
      재생성 후에도 살아남는 방식인지 확인하고, 아니면 그 사실을 보고해라.

P0-1  닫기 시 저장 확인 (난이도 중, 이 릴리스의 유일한 중간 난이도)
      src-tauri/src/lib.rs의 app.run() 이벤트 루프에
      WindowEvent::CloseRequested 처리를 추가한다.
      api.prevent_close() 후 프론트엔드에 확인 요청 이벤트를 emit하고,
      dirty 파일 목록을 보여준 뒤 저장 / 저장 안 함 / 취소를 받는다.
      Cmd+Q는 열린 모든 창에 대해 순회.
      확인 UI는 window.confirm이 아니라 tauri-plugin-dialog의 네이티브 다이얼로그.

버전 작업:
docs/release-prompts.md의 「버전 릴리스 절차」를 따라 3.2.0 → 3.2.1로 올린다.
CHANGELOG에 [3.2.1] 섹션을 추가하고 위 항목을 Fixed 중심으로 정리한다.

제약:
- patch 릴리스다. 새 기능, UI 재구성, 리팩터링을 끼워넣지 않는다.
- 각 항목을 개별 커밋으로 나눈다. 마지막에 릴리스 커밋.
- main이 아닌 브랜치에서 작업한다.

검증:
corepack pnpm lint && corepack pnpm build && cd src-tauri && cargo test
P0-3은 CRLF 픽스처 파일을 만들어 왕복 저장을 직접 확인해라.
```

---

## 3.3.0 — 플랫폼 정리

우회 코드를 낳은 근본 원인(P1-1)을 먼저 제거하는 것이 이 릴리스의 핵심입니다.

```
Saekim 3.3.0 릴리스 작업을 해줘. 플랫폼 계층 정리다.

먼저 docs/improvement-plan.md와 docs/platform-architecture.md를 읽어라.

작업 항목:

P1-1  Tauri capability가 main 창에만 적용됨  ← 이 릴리스의 핵심
      src-tauri/capabilities/default.json이 "windows": ["main"]인데
      src-tauri/src/commands/window.rs의 open_new_window는
      window{timestamp} 라벨로 창을 만든다. 두 번째 창에 core:event:default가 없다.

      1) 스코프를 ["main", "window*"]로 확대한다.
      2) 새 창에서 JS listen()이 실제로 동작하는지 반드시 검증한다.
         (창 2개를 띄우고 두 번째 창에서 파일 연결/메뉴 이벤트를 받아본다)
      3) 검증이 끝나면 아래 우회 코드를 제거한다:
         - src-tauri/src/platform/macos/native_menu.rs의 dispatch_dom_event
           (window.eval로 DOM CustomEvent 주입)
         - 같은 파일의 3중 emit (emit_to_window_target /
           emit_to_webview_window_target / emit_to_webview_window) 중 하나만 남긴다
         - src/hooks/useExternalFileOpen.ts의 1500ms 폴링 루프
         - src/platform/desktop/tauriDesktopBackend.ts의 중복 제거 로직
      4) focus/visibilitychange 플러시는 남겨도 된다. 판단해서 결정하고 이유를 적어라.

      중요: 2)의 검증 없이 3)을 진행하지 마라. 검증이 실패하면
      우회 코드를 그대로 두고 그 사실을 보고해라.

P1-3  창 위치·크기 미복원
      tauri-plugin-window-state 도입. 창 라벨별 상태 저장이라 멀티 윈도우와 맞다.

P1-4  OS 테마 미추종
      src/types/workspace.ts의 ThemeName에 'system' 추가.
      matchMedia('(prefers-color-scheme: dark)') 구독 → default/dark 매핑.
      설정 패널(SettingsPanel.tsx)에 "시스템" 옵션 추가하고 기본값으로.

P1-5  Linux 반쪽 지원 (최소안)
      src/platform/desktop/linux/linuxPlatformProfile.ts:11의
      showsApplicationMenu를 true로. 현재 Linux는 인앱 메뉴바도 없고
      네이티브 메뉴도 없어서 Window/Help 메뉴에 접근할 수 없다.
      추가로 titleBarStyle "Overlay"와 trafficLightPosition은 macOS 전용인데
      공통 tauri.conf.json에 있다. tauri.macos.conf.json으로 옮긴다.

P1-7  Cmd+P가 인쇄가 아님
      src/features/pdf-export/commands.ts의 defaultShortcut을
      'mod+p' → 'mod+shift+e'로. Cmd/Ctrl+P는 window.print()로 연결하고
      기존 src/styles/print.css를 쓴다.
      macOS File 메뉴(native_menu.rs)에 Print 항목 추가.

W-7   앞뒤 이동이 조용히 무반응
      src/store/workspace.ts의 historyPrev/historyNext가
      openFiles에 없는 경로면 return {}로 아무 일도 하지 않는다.
      디스크에서 다시 열도록 고친다. (3.2.1에서 파일 닫기가 생겼으니 이제 드러난다)

U-4   태블릿 분할 뷰에서 그리드가 넘쳐 잘림
      medium 프로필 그리드 최소 폭은 196+6+240+6+240 = 688px인데
      medium 범위는 600~839px이다. 데스크톱은 useWindowSizeConstraints가 막아주지만
      그 훅은 window.chrome capability가 필요하고 Android에는 없다.
      src/hooks/useResponsiveViewMode.ts의 viewModesForViewportProfile에
      폭 인자를 추가해 688px 미만이면 split을 제외한다.

U-7   태블릿·모바일에서 뷰 모드 토글이 숨겨짐
      src/styles/app.css의 compact/medium .header-view-toggle display:none.
      medium에서는 토글을 유지하되 라벨 없이 아이콘만 남긴다.
      compact는 3.5.0에서 하단 탭으로 처리하므로 이번엔 건드리지 않는다.

P0-4  인코딩이 왕복되지 않음
      src-tauri/src/core/text_file.rs의 decode_text_bytes가 감지한 인코딩을
      OpenFilePayload에 실어 보낸다 (utf-8 / utf-8-bom / utf-16le / utf-16be).
      OpenFile.encoding의 'UTF-8' 하드코딩을 실제 값으로 바꾸고 저장 시 그대로 인코딩.
      형식이 바뀌는 저장은 최초 1회 확인.

W-2   Cmd+N이 곧바로 저장 다이얼로그를 띄움
      src/store/workspace.ts:103 createFile의 첫 줄이
      saveFileAs('', 'untitled.md')다. 한 글자도 치기 전에 저장 위치를 정해야 한다.
      1) untitled 버퍼를 메모리에 만든다. ~untitled-1 형태의 placeholder 경로는
         isPlaceholderPath가 이미 지원한다.
      2) 첫 Cmd+S에서 저장 다이얼로그. saveActive가 이미
         path.startsWith('~')이면 null을 넘겨 다이얼로그를 띄운다.
      3) 이미지 삽입 시에만 "먼저 저장해야 합니다" 안내.
         features/image-assets/editorHandlers.ts:240 requireSavedActiveFile에 이미 있다.

W-3   워크스페이스 검색이 접힌 폴더를 못 찾음
      src/components/sidebar/Sidebar.tsx:172의 filterTree가
      메모리에 로드된 tree만 훑는다. 트리는 깊이 2단계까지만 선로딩되므로
      펼치지 않은 폴더의 파일은 검색 대상에 아예 없다. 조용한 미탐이다.
      Rust에 워크스페이스 전체 파일명 순회 커맨드를 추가해 연결한다.

      설계 주의: 3.4.0의 P2-2(워크스페이스 전역 내용 검색)가 같은 순회 기반을
      쓴다. 지금은 파일명만 필요하지만, 나중에 내용 검색과 결과 페이징을
      얹을 수 있는 형태로 커맨드를 설계해라. 파일명 전용으로 좁게 짜지 마라.

P0-6  문서 전문이 메타데이터 DB에 무기한 축적
      src-tauri/src/commands/session.rs:812가 OpenFile 객체 전체를
      state_json으로 직렬화한다. content와 savedContent가 둘 다 들어간다.
      1) state_json에서 content/savedContent 제외 — 뷰 상태만 남긴다.
      2) 세션 복원 시 디스크에서 다시 읽는다 (last_content_hash로 무결성 확인).
      3) 저장 안 된 변경분만 별도 drafts 테이블에 두고 저장 완료 시 삭제.
      4) src/hooks/useSessionPersistence.ts의 저장을 두 단계로 분리 —
         UI/설정 400ms, 문서 상태 2초 또는 blur.
      마이그레이션: 기존 DB에 쌓인 본문을 어떻게 처리할지 결정하고 문서화해라.

버전 작업:
docs/release-prompts.md의 「버전 릴리스 절차」를 따라 3.2.1 → 3.3.0으로 올린다.

제약:
- P1-1을 가장 먼저 하고 검증까지 끝낸 뒤 나머지로 넘어간다.
- P0-6의 DB 스키마 변경은 마이그레이션 경로를 반드시 포함한다.
- main이 아닌 브랜치에서 작업한다.

검증:
corepack pnpm lint && corepack pnpm build && cd src-tauri && cargo test
P1-1은 창 2개를 실제로 띄워 이벤트 전달을 확인한다.
```

---

## 3.4.0 — 에디터 완성도

에디터로서 기대되는 기능을 채웁니다.

```
Saekim 3.4.0 릴리스 작업을 해줘. 에디터 기능 보강이다.

먼저 docs/improvement-plan.md와 docs/features.md를 읽어라.
features.md에 기여(contribution) 시스템 구조가 정리되어 있으니
새 기능은 그 확장 포인트를 쓴다.

작업 항목:

P2-1  탭 바 없음
      openFiles 배열과 setActiveFile/closeFile이 이미 스토어에 있다.
      탭 스트립 UI, Cmd+1~9 이동, 탭별 닫기 버튼, Cmd+Shift+T 복원.
      dirty 표시는 기존 isDirty 셀렉터를 쓴다.

P2-2  바꾸기 없음
      src/features/search/FindBar.tsx는 찾기 전용이다.
      바꾸기 / 전체 바꾸기, 정규식, 대소문자 구분, 단어 단위, 선택 영역 내 검색.
      워크스페이스 전역 내용 검색은 3.3.0의 W-3에서 만든 Rust 순회 커맨드를
      확장해 쓴다. 새로 만들지 말고 기존 것을 먼저 확인해라.

P2-3  파일 조작 없음
      트리에서 이름 변경, 삭제, 새 폴더, 복제.
      삭제는 trash 크레이트로 OS 휴지통에 보낸다 (영구 삭제 금지).
      Rust 커맨드를 새로 추가해야 한다.

P2-4  아웃라인 없음
      Markdown 렌더러가 이미 data-source-line을 붙이고 있으니
      스크롤 동기화(useScrollSync) 인프라를 재사용한다.
      사이드바에 아웃라인 탭을 추가하거나 별도 패널로.

P3    명령 팔레트 (Cmd+K)
      src/app/commands.ts의 CommandRegistry에 id, 라벨, 기본 단축키가
      이미 등록되어 있다. UI만 만들면 된다.
      P1-8의 키맵 테이블화와 함께 설계하면 등록 정보를 한 곳에서 쓴다.
      P1-6(macOS 메뉴 구멍)의 상당 부분도 이걸로 우회된다.

P1-8  단축키 처리의 구조적 문제
      src/hooks/useShortcuts.ts가 N/O/S/F/P 다섯 키만 처리하고
      if 체인이 else if가 아니라 병렬이다.
      키맵 테이블({ key, meta, shift, commandId } 배열)로 교체하고
      CommandRegistry의 defaultShortcut과 통합해
      기능이 등록한 단축키가 자동으로 동작하게 만든다.
      누락 단축키 추가: Cmd+, (설정), Cmd+B/I (볼드/이탤릭),
      Cmd+1/2/3 (뷰 모드), Cmd+\ (사이드바).

U-6   포커스 표시가 거의 없음
      전체 CSS에서 :focus/:focus-visible 규칙 6개, outline: none 6개다.
      src/styles/globals.css에 전역 :focus-visible 기본 링을 한 번 정의하고,
      outline: none은 대체 표시가 있는 곳에만 남긴다.
      --accent-border 토큰이 이미 있다.
      메뉴/다이얼로그/트리/툴바를 키보드만으로 순회해 확인한다.

P0-5  외부 변경 미감지 (난이도 상)
      1단계 — 저장 충돌 감지: read_file이 mtime과 크기를 함께 반환하고,
      저장 직전 현재 mtime과 비교. 다르면 덮어쓰기/다시 불러오기/다른 이름으로 저장.
      2단계 — notify 크레이트로 워크스페이스와 열린 파일 감시.
      300ms 디바운스, dirty가 아니면 자동 리로드, dirty면 배너.
      트리 변경도 같은 채널로 반영해 수동 refresh 버튼을 제거한다.
      1단계까지만 하고 2단계는 다음으로 미뤄도 된다. 판단해서 결정하고 이유를 적어라.

버전 작업:
docs/release-prompts.md의 「버전 릴리스 절차」를 따라 3.3.0 → 3.4.0으로 올린다.

제약:
- P2-2는 3.3.0에서 만든 Rust 순회 커맨드를 확장한다. 중복 구현하지 마라.
- P3(명령 팔레트)와 P1-8(키맵)은 CommandRegistry를 공유하니 함께 설계한다.
- 새 UI는 features.md의 기여 시스템 확장 포인트를 쓴다. App.tsx에 직접 넣지 마라.
- main이 아닌 브랜치에서 작업한다.

검증: corepack pnpm lint && corepack pnpm build && cd src-tauri && cargo test
```

---

## 3.5.0 — 태블릿과 모바일

작은 화면을 한 묶음으로 처리합니다. 이 마일스톤을 끝내면 Android를
"실험적"이 아니라 정식 지원이라 부를 수 있습니다.

```
Saekim 3.5.0 릴리스 작업을 해줘. 태블릿과 모바일 대응이다.

먼저 docs/improvement-plan.md의 U 밴드를 전부 읽어라.
특히 U-0(전제)을 먼저 읽어야 나머지가 이해된다.

배경:
현재 CSS 4,533줄에 반응형 미디어 쿼리가 @media (max-width: 860px) 하나뿐이다.
반응형은 전부 JS가 붙이는 data-viewport-profile 속성으로 처리한다.
그래서 hover: none, pointer: coarse, prefers-reduced-motion,
env(safe-area-inset-*)를 하나도 쓰지 못하고 있다.
이 릴리스는 그 구조적 제약을 먼저 푸는 것에서 시작한다.

작업 순서 (의존성이 있으니 이 순서를 지켜라):

1. U-0 기반 작업
   CSS 기능 쿼리를 도입한다. data-viewport-profile 방식을 걷어내라는 게 아니라,
   기기 특성(포인터 정밀도, 모션 선호, 안전 영역)은 미디어 쿼리로 분기하고
   레이아웃 폭만 프로필로 유지한다는 뜻이다.
   - index.html의 viewport 메타에 viewport-fit=cover 추가
   - prefers-reduced-motion 가드 (transition/animation 11개 대상)
   - 안전 영역 토큰 도입

2. U-3 터치 타깃 44px
   현재 값: --sidebar-control-size 30px, .ui-segmented button 28px(sm 24px),
   아이콘 버튼 24~28px, --pane-resizer-w 6px(::after로 실효 18px).
   전부 Apple HIG 44pt / Material 48dp의 절반 수준이다.
   @media (pointer: coarse)에서 토큰 값만 키운다:
     :root { --sidebar-control-size: 44px; --pane-resizer-w: 12px; }
   .pane-resizer::after의 ±6px 확장 폭도 함께 키운다.
   src/styles/tokens.css, ui.css, app.css.

3. U-1 모바일 파일 브라우저 복원  ← 이 릴리스의 핵심
   src/styles/app.css:1188이 compact에서 .sidebar-search, .sidebar-folder-path,
   .file-tree를 data-sidebar 상태와 무관하게 display:none 처리한다.
   모바일에서 파일 트리·경로·검색이 전부 사라져서
   네이티브 다이얼로그 말고는 파일을 고를 방법이 없다.
   또 app.css:447이 compact 그리드 컬럼을 항상 --sidebar-w-collapsed로 고정해서
   SidebarToggle이 눌러도 아무 일도 안 하는 죽은 컨트롤이다.

   - compact에서 사이드바를 오버레이 드로어로 만든다.
     레일 토글로 열고, 배경 탭이나 스와이프로 닫는다.
   - SidebarToggle이 compact에서 드로어를 여닫도록 연결한다.
   - 드로어 안에 기존 트리/경로/검색 컴포넌트를 그대로 넣는다. CSS만 추가.
   - 포커스 트랩과 Esc 닫기를 넣는다.

4. U-5 모바일 공간 낭비
   - 줄번호 표시 토글을 설정에 추가하고 compact에서 기본 꺼짐.
     현재 .editor-content가 grid-template-columns: 48px 1fr로
     375px 화면의 13%를 줄번호가 먹는다.
   - src/core/editor/editorHelper.css:14의 100vh를 100dvh로.
     앱 셸(app.css:10)은 이미 100dvh인데 모달만 100vh라
     키보드가 올라오면 화면 밖으로 넘친다.
   - 모달 백드롭 padding 36px을 clamp()로. 375px에서 실폭이 303px밖에 안 된다.
   - 편집기 패딩(20px 24px 20px 18px)을 뷰포트에 맞게.

5. U-7 compact 뷰 모드 전환
   3.3.0에서 medium은 처리했다. compact는 하단 탭 형태로 만든다.
   현재는 사이드바 메뉴를 열거나 6px 리사이저를 끄는 방법뿐이다.

6. U-8 그 밖의 정리
   - ::-webkit-scrollbar 10px 고정 + thumb :hover 의존 →
     터치에서는 hover가 없으니 pointer: coarse에서 다르게 처리.
     scrollbar-gutter 도입 검토.
   - overscroll-behavior: contain을 프리뷰와 편집기에.
   - .body의 grid-template-columns를 두고 15개 규칙이 경쟁하는데
     compact/medium 규칙이 동일 특이성에서 소스 순서로만 이긴다.
     규칙 하나만 옮겨도 레이아웃이 깨지는 구조라 특이성을 명시적으로 정리한다.

검증 (실기기 또는 에뮬레이터로 반드시 확인):
- 360×640 (소형 폰), 375×812, 412×915 (일반 폰)
- 800×1280 세로 태블릿, 분할 화면 600px
- Android 다크 모드 (3.2.1의 U-2가 적용된 상태여야 한다)
- 소프트 키보드를 올린 상태에서 헬퍼 모달과 편집기
- 회전 전환

버전 작업:
docs/release-prompts.md의 「버전 릴리스 절차」를 따라 3.4.0 → 3.5.0으로 올린다.
README.md와 README_KR.md의 Platform 배지에 Android를 정식 지원으로 추가할지
판단하고, 추가한다면 지원 범위를 문서에 적는다.

제약:
- 데스크톱 레이아웃을 회귀시키지 마라. 각 단계마다 expanded 프로필을 확인한다.
- main이 아닌 브랜치에서 작업한다.

검증: corepack pnpm lint && corepack pnpm build
```

---

## 4.0.0 — 배포와 확장

**major 릴리스입니다.** 서명·업데이터는 기술보다 인증서 조달이 병목이므로
일정을 따로 잡으세요.

```
Saekim 4.0.0 릴리스 작업을 해줘. 배포 파이프라인과 확장이다.

먼저 docs/improvement-plan.md를 읽어라.

작업 항목:

P2-9  테스트와 CI  ← 다른 항목보다 먼저 한다
      프론트엔드 테스트가 0건이고 .github/가 없다. Rust 단위 테스트만 있다.
      - Vitest 도입. 우선 대상: 마크다운 렌더러(core/markdown),
        텍스트 편집 유틸(core/editor/textEditing), 레이아웃 식별
        (features/block-layout/layoutIdentity), 구조화 데이터 파서
        (features/structured-data/parse)
      - GitHub Actions: pnpm lint, tsc, vitest, cargo test, 3-OS 빌드
      이걸 먼저 해야 나머지 작업의 회귀를 잡을 수 있다.

P1-2  코드 서명·노타라이즈·자동 업데이트
      - macOS: signingIdentity, hardenedRuntime: true, entitlements 파일,
        notarize 설정, minimumSystemVersion 명시
      - Windows: 코드 서명 인증서
      - tauri-plugin-updater 도입 + 업데이트 매니페스트 호스팅
      - 태그 푸시 시 3-OS 빌드 → 서명 → 릴리스 자동화
      주의: 인증서가 없으면 설정만 준비하고 그 사실을 명확히 보고해라.
      더미 값으로 채우지 마라.

P1-6  macOS 네이티브 통합
      - NSDocumentController.noteNewRecentDocumentURL로 OS 최근 문서 등록
        (objc2가 이미 의존성에 있다)
      - File 메뉴에 Open Recent File 서브메뉴.
        files 테이블의 last_opened_at을 그대로 쓴다.
      - window.set_title + 수정 상태를 창 제목에 반영
      - 빈 Help 메뉴에 GitHub 링크와 단축키 목록
      - View에 Zoom In/Out (fontSize 3단계가 이미 있으니 연결만)
      - Edit에 Find 연결 (search.openFind 명령이 이미 있다)

P2-7  PDF가 래스터 이미지
      현재 html2canvas + jsPDF다. 페이지 분할 회피, 제목 붙임, 여백 트리밍까지
      정교하게 만들어져 있지만 결과물에서 텍스트 선택·검색·링크가 안 된다.
      웹뷰 print-to-PDF(WKWebView createPDF, WebView2 PrintToPdfAsync)로 바꾼다.
      현재 src/features/pdf-export/export.ts의 분할 로직을
      CSS @page와 break-inside로 옮겨야 한다. 난이도 상이다.
      기존 경로를 폴백으로 남길지 판단해라.

P2-8  국제화
      UI 문자열이 전부 한국어 하드코딩이다. 경량 i18n 레이어와 언어 전환.
      최소 한국어/영어. README가 이미 두 언어라 기준으로 삼는다.

P3    자동 저장 + 로컬 버전 히스토리 (난이도 상)
      files.last_content_hash와 세션 DB가 이미 있으니
      스냅샷 테이블을 추가한다. "5분 전으로 되돌리기".
      3.3.0의 P0-6에서 만든 drafts 테이블과 함께 설계한다.

버전 작업:
docs/release-prompts.md의 「버전 릴리스 절차」를 따라 3.5.0 → 4.0.0으로 올린다.
major 릴리스이므로 CHANGELOG에 breaking change 항목을 명시한다.
P2-7이 PDF 출력 결과를 바꾸므로 그것도 적는다.

제약:
- P2-9(테스트/CI)를 가장 먼저 끝낸다.
- 인증서·비밀키를 저장소에 커밋하지 마라. GitHub Secrets를 쓴다.
- main이 아닌 브랜치에서 작업한다.

검증: CI가 3-OS에서 통과하는 것이 이 릴리스의 완료 조건이다.
```

---

## 사용 메모

- 각 프롬프트는 코드 블록 안의 내용만 복사해서 쓰세요.
- 마일스톤 하나가 한 세션에 다 들어가지 않으면 작업 항목 단위로 잘라서 쓰세요.
  각 항목이 문서의 ID(P0-2, W-1, U-3 …)를 달고 있어 개별로도 동작합니다.
- 프롬프트가 `docs/improvement-plan.md`를 읽도록 시켜뒀으므로,
  계획 문서를 수정하면 프롬프트 동작도 따라 바뀝니다.
  프롬프트 본문과 계획 문서가 어긋나면 계획 문서가 기준입니다.
