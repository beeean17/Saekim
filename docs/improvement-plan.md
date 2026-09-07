# Saekim 개선 계획

Saekim 3.2.0 코드베이스 검토 결과와 개선 로드맵입니다.
현재 구현 범위는 [features.md](features.md)를 참고하세요.

---

## 요약

Saekim은 렌더 파이프라인, 플랫폼 추상화, 블록 레이아웃 같은 **상위 구조가
잘 잡혀 있습니다.** capability 기반 기능 게이팅과 프리뷰 기여 모델은 확장에
충분히 견딥니다.

문제는 그 아래에 있습니다. **문서를 디스크에 안전하게 읽고 쓰는 계층**이
상대적으로 얇습니다. 이미지 저장은 원자적으로 쓰면서 본문 저장은 그렇지 않고,
인코딩·개행을 감지해 상태바에 표시하면서 저장할 때는 쓰지 않습니다.
로컬 우선 에디터에서 가장 먼저 튼튼해야 할 부분입니다.

또 하나는 **플랫폼 계층의 미완성**입니다. Tauri capability 스코프가 새 창을
포함하지 않아 이벤트 전달을 폴링과 `eval`로 우회하고 있고, 코드 서명과
자동 업데이트가 없어 배포 자체가 막혀 있습니다.

세 번째는 **동선의 마찰**입니다. 기능이 없어서가 아니라, 있는 기능의 흐름이
어긋나 있습니다. 저장할 때마다 워크스페이스 루트가 튀고(W-1), 새 문서를 만들려면
글자를 치기도 전에 저장 위치부터 정해야 하며(W-2), 검색은 접힌 폴더의 파일을
조용히 놓칩니다(W-3). 셋 다 원인이 명확하고 수정 범위가 좁습니다.

네 번째는 **작은 화면**입니다. 데스크톱 UI는 정돈되어 있지만 태블릿과 모바일은
사실상 미완성입니다. 모바일에서는 파일 트리·경로·검색이 통째로 `display: none`이라
파일을 고를 방법이 네이티브 다이얼로그밖에 없고(U-1), Android 다크 모드 테마는
day 테마를 그대로 복사해 둔 상태이며(U-2), 모든 터치 타깃이 권장 크기의
절반입니다(U-3). Android가 이미 출시 대상인 만큼 그냥 두기 어려운 지점입니다.

### 심각도 기준

| 등급 | 의미 |
| --- | --- |
| **P0** | 사용자가 모르는 사이 데이터가 유실·변형됨 |
| **P1** | 플랫폼 통합이 깨져 있거나 배포를 막음 |
| **W** | 있는 기능의 동선이 어색하거나 비효율적임 (항목별 심각도 상이) |
| **U** | 화면·반응형 문제 — 데스크톱/태블릿/모바일/Android 셸 (항목별 심각도 상이) |
| **P2** | 에디터로서 기대되는 기능이 없음 |
| **P3** | 제품을 키우는 신규 기능 |

---

## P0 — 데이터 안전성

### P0-1. 저장 안 된 변경사항이 경고 없이 사라짐

**현상**
`Cmd+W`, 창 닫기 버튼, `Cmd+Q` 어느 경로에서도 확인 창이 뜨지 않습니다.

**근거**
`src-tauri/src/lib.rs`의 `app.run()` 이벤트 루프는 `Focused`와 `DragDrop`만
처리하고 `WindowEvent::CloseRequested`가 없습니다. 프론트엔드에도
`beforeunload` 핸들러가 없습니다. dirty 확인 함수는
`src/store/workspace.ts:493`의 `confirmDiscardDirtyWorkspace` 하나뿐이고
**워크스페이스 전환 시에만** 호출됩니다.

**수정 방향**
1. `WindowEvent::CloseRequested`를 받아 `api.prevent_close()` 후 프론트엔드에
   확인 요청 이벤트를 emit
2. 프론트엔드가 dirty 파일 목록을 보여주고 저장 / 저장 안 함 / 취소를 받음
3. `Cmd+Q`(앱 종료)는 열린 모든 창에 대해 같은 절차를 순회
4. 확인 UI는 `window.confirm` 대신 네이티브 다이얼로그
   (`tauri-plugin-dialog`의 `ask`/`confirm`) 사용 — 파일명을 나열해야 하므로

**영향 파일** `src-tauri/src/lib.rs`, `src/store/workspace.ts`, `src/App.tsx`
**난이도** 중

---

### P0-2. 문서 저장이 비원자적

**현상**
저장 중 크래시·전원 차단이 나면 원본 파일이 잘린 채 남습니다.

**근거**
`src-tauri/src/commands/file.rs:764`

```rust
fs::write(&path, content).map_err(|error| format!("failed to save file: {error}"))
```

같은 파일 안의 이미지 저장 경로(`file.rs:846`, `:856`)는
`fs::write(temp)` → `fs::rename(temp, target)`로 **이미 원자적으로 처리**하고
있습니다. 정작 본문 저장만 빠졌습니다. `fsync`도 없습니다.

**수정 방향**
`write_selected_file`을 이미지 경로와 동일한 패턴으로 교체합니다.

1. 같은 디렉터리에 `.{name}.saekim-tmp` 생성
2. 내용 쓰기 → `File::sync_all()`
3. 원본의 권한(mode)·소유자를 임시 파일에 복사
4. `fs::rename`으로 교체
5. 실패 시 임시 파일 정리

디렉터리 fsync까지 하면 더 안전하지만 플랫폼별 처리가 필요하므로 2단계로 미룹니다.

**영향 파일** `src-tauri/src/commands/file.rs`
**난이도** 하 — 기존 코드 재사용

---

### P0-3. CRLF가 조용히 LF로 변환됨

**현상**
Windows에서 CRLF 파일을 열고 한 글자만 고쳐 저장하면 **파일 전체가 LF로
바뀝니다.** git diff가 전체 파일로 뜹니다. 상태바에 표시된 `CRLF`도
그 시점부터 사실과 다릅니다.

**근거**
`src/store/workspace.ts:320`이 여는 시점에 EOL을 감지해 `OpenFile.eol`에
저장하고 `StatusBar.tsx:25`가 표시합니다. 그런데 `saveActive`
(`workspace.ts:180`)는 `file.content`를 그대로 넘깁니다.
HTML 스펙상 `textarea.value`는 CRLF를 LF로 정규화하므로 원본 개행은
읽는 순간 이미 사라져 있습니다.

**수정 방향**
1. 저장 직전 `file.eol === 'CRLF'`이면 `\n` → `\r\n` 복원
2. 혼합 개행 파일은 다수결로 판정하고 상태바에 `Mixed` 표시
3. 설정에 "개행 문자" 항목 추가 — 원본 유지(기본) / LF 강제 / CRLF 강제
4. 상태바의 EOL 표시를 클릭 가능하게 만들어 현재 파일만 변환

**영향 파일** `src/store/workspace.ts`, `src/components/shell/StatusBar.tsx`,
`src/store/settings.ts`
**난이도** 하

---

### P0-4. 인코딩이 왕복되지 않음

**현상**
UTF-16 파일이나 BOM이 있는 UTF-8 파일을 열어 저장하면
**BOM 없는 UTF-8로 형식이 바뀝니다.** 사용자에게 알리지 않습니다.

**근거**
`src-tauri/src/core/text_file.rs`의 `decode_text_bytes`는 UTF-8 BOM,
UTF-16 LE/BE를 정확히 읽습니다. 하지만 저장 경로에는 인코딩 개념이 없고,
`OpenFile.encoding`은 `toOpenFile`에서 `'UTF-8'` 문자열로 하드코딩됩니다.

**수정 방향**
1. `read_file`이 감지한 인코딩을 `OpenFilePayload`에 실어 보냄
   (`utf-8` / `utf-8-bom` / `utf-16le` / `utf-16be`)
2. `OpenFile.encoding`에 실제 값 보관, 저장 시 그대로 인코딩
3. 상태바 인코딩 표시를 클릭해 변환할 수 있게 함
4. UTF-16 → UTF-8 변환처럼 형식이 바뀌는 저장은 최초 1회 확인

P0-3과 같은 성격의 문제이므로 함께 처리하는 편이 낫습니다.

**영향 파일** `src-tauri/src/core/text_file.rs`,
`src-tauri/src/commands/file.rs`, `src/types/workspace.ts`,
`src/store/workspace.ts`
**난이도** 중

---

### P0-5. 외부 변경을 감지하지 못하고 덮어씀

**현상**
다른 에디터나 `git checkout`으로 파일이 바뀌어도 Saekim은 알지 못합니다.
저장하면 **비교 없이 덮어씁니다.** 트리의 파일 추가·삭제도 반영되지 않습니다.

**근거**
`notify` 크레이트가 의존성에 없고, 코드베이스 전체에 파일 워처가 없습니다.
`save_file`은 mtime이나 해시를 확인하지 않습니다.

**수정 방향**

*1단계 — 저장 충돌 감지 (워처 없이)*
- `read_file`이 mtime과 크기를 함께 반환
- 저장 직전 현재 mtime을 다시 읽어 열었을 때와 비교
- 다르면 "디스크의 파일이 변경되었습니다" 다이얼로그 —
  덮어쓰기 / 다시 불러오기 / 다른 이름으로 저장
- `files.last_content_hash`가 이미 DB에 있으므로 해시 대조도 가능

*2단계 — 실시간 감시*
- `notify` 크레이트로 워크스페이스 루트와 열린 파일 감시
- 디바운스(300ms 정도) 후 프론트엔드에 변경 이벤트
- dirty가 아니면 자동 리로드, dirty면 배너로 알림
- 트리 변경도 같은 채널로 반영해 수동 `refresh` 제거

**영향 파일** `src-tauri/Cargo.toml`, `src-tauri/src/commands/file.rs`,
신규 `src-tauri/src/core/watcher.rs`, `src/store/workspace.ts`
**난이도** 상

---

### P0-6. 문서 전문이 메타데이터 DB에 무기한 축적

**현상**
열어본 모든 파일의 **본문이 평문으로, 파일당 2벌씩** SQLite에 저장됩니다.
`.env`, 로그, 비밀이 담긴 파일도 예외가 아니고, 정리 로직이 없습니다.

**근거**
`src-tauri/src/commands/session.rs:812`

```rust
let state_json = serde_json::to_string(open_file)
```

`open_file`은 프론트엔드의 `OpenFile` 객체 전체이고, 여기에는 `content`와
`savedContent`가 둘 다 들어 있습니다. 파일당 최대 20MB이므로
`~/Library/Application Support/Saekim/metadata.sqlite3`가 무제한으로 커집니다.

부수 효과로 `useSessionPersistence`가 400ms 디바운스마다 **열린 모든 파일의
본문을 JSON 직렬화해 SQLite에 씁니다.** 타이핑하는 동안 계속 도는 I/O입니다.

**수정 방향**
1. `state_json`에서 `content` / `savedContent` 제외 — 경로, 이름, 커서 위치,
   스크롤 위치 같은 뷰 상태만 남김
2. 세션 복원 시 디스크에서 다시 읽음 (해시로 무결성 확인)
3. **저장 안 된 변경분만** 별도 `drafts` 테이블에 보관하고,
   저장 완료 시 즉시 삭제 → 크래시 복구는 유지하면서 축적은 막음
4. 세션 저장을 두 단계로 분리 — UI/설정은 400ms, 무거운 문서 상태는
   2초 또는 blur 시점

**영향 파일** `src-tauri/src/commands/session.rs`,
`src/hooks/useSessionPersistence.ts`
**난이도** 중

---

### P0-7. 열린 파일을 닫을 수 없어 무한히 누적됨

**현상**
한 번 연 파일은 세션에서 빠지지 않습니다. 작업을 오래 할수록
`openFiles`가 계속 늘어납니다.

**근거**
`src/store/workspace.ts:147`에 `closeFile`이 구현되어 있지만
**호출하는 코드가 코드베이스에 없습니다.** `Cmd+W` 핸들러도 없고
(`useShortcuts`는 W를 처리하지 않음), 탭이나 닫기 버튼도 없습니다.
macOS에서 `Cmd+W`는 네이티브 `close_window`로 **창 전체**가 닫힙니다.

**왜 P0인가**
단독으로는 불편함이지만 P0-6과 곱해집니다. 열린 파일이 늘어날수록
400ms마다 SQLite에 직렬화되는 본문 총량이 커지고, 메타데이터 DB에
평문으로 쌓이는 파일 수도 무제한으로 늘어납니다. 타이핑 지연과
DB 비대화가 시간이 갈수록 악화됩니다.

**수정 방향**
1. `Cmd/Ctrl+W`를 **파일 닫기**로 연결 (열린 파일이 없을 때만 창 닫기)
2. dirty 파일이면 P0-1의 확인 절차 재사용
3. 탭 바(P2-1)를 만들면 닫기 버튼이 자연스럽게 따라옴
4. macOS 네이티브 메뉴의 `close_window` 항목을 Close File로 교체하고
   Close Window는 `Cmd+Shift+W`로

**영향 파일** `src/hooks/useShortcuts.ts`, `src/App.tsx`,
`src-tauri/src/platform/macos/native_menu.rs`
**난이도** 하 — 스토어 로직은 이미 있음

---

### P0-8. 멀티 윈도우 SQLite 동시성

**현상**
창을 2개 이상 띄우면 `SQLITE_BUSY`로 세션 저장이 실패할 수 있습니다.

**근거**
`session.rs:470`의 `open_metadata_connection`은 호출마다 새 `Connection`을 열고
**매번 `initialize_schema`(전체 `CREATE TABLE IF NOT EXISTS` 배치)를 실행**합니다.
WAL 모드도 `busy_timeout`도 설정하지 않습니다. 창 2개가 400ms마다 쓰면
충돌 조건이 갖춰집니다.

**수정 방향**
1. `PRAGMA journal_mode = WAL`
2. `PRAGMA busy_timeout = 3000`
3. `Connection`을 `AppState`에 `Mutex`로 보관해 재사용
4. 스키마 초기화는 앱 시작 시 1회만

**영향 파일** `src-tauri/src/commands/session.rs`, `src-tauri/src/app_state.rs`
**난이도** 하

---

## P1 — 플랫폼과 배포

### P1-1. Tauri capability가 `main` 창에만 적용됨

**현상**
두 번째 창에서 JS `listen()`이 동작하지 않습니다. 이것이 코드베이스 곳곳의
우회 코드를 낳았습니다.

**근거**
`src-tauri/capabilities/default.json`

```json
{ "windows": ["main"], "permissions": ["core:event:default"] }
```

그런데 `src-tauri/src/commands/window.rs`의 `open_new_window`는
`window{timestamp}` 라벨로 창을 만듭니다. 라벨이 매칭되지 않으므로
`core:event:default` 권한이 없습니다.

우회의 흔적:

| 위치 | 우회 방식 |
| --- | --- |
| `platform/macos/native_menu.rs` | `window.eval`로 DOM CustomEvent 주입 |
| `native_menu.rs` | 같은 이벤트를 3개 채널로 중복 emit |
| `hooks/useExternalFileOpen.ts` | 1.5초 폴링 루프 |
| `useExternalFileOpen.ts` | focus / visibilitychange 재플러시 |

**수정 방향**
1. `"windows": ["main", "window*"]`로 스코프 확대
2. 새 창에서 `listen()`이 실제로 동작하는지 검증
3. 검증 후 `eval` 기반 DOM 이벤트, 3중 emit, 폴링 루프를 제거
4. 세 채널 중 하나만 남기면 `tauriDesktopBackend.ts`의 중복 제거 로직도 정리됨

**영향 파일** `src-tauri/capabilities/default.json`,
`src-tauri/src/platform/macos/native_menu.rs`,
`src/hooks/useExternalFileOpen.ts`,
`src/platform/desktop/tauriDesktopBackend.ts`
**난이도** 하 (설정) + 중 (우회 코드 제거)
**부수 효과** 코드가 눈에 띄게 줄어들고 이벤트 경로가 하나로 정리됨

---

### P1-2. 코드 서명·노타라이즈·자동 업데이트 부재

**현상**
배포하면 macOS Gatekeeper와 Windows SmartScreen에 막힙니다.
한번 설치된 앱을 업데이트할 경로가 없습니다.

**근거**
`tauri.conf.json`의 `bundle`에 macOS `signingIdentity`, `hardenedRuntime`,
`entitlements`, `minimumSystemVersion`이 없고 Windows 인증서 설정도 없습니다.
`Cargo.toml`에 `tauri-plugin-updater`가 없습니다.

**수정 방향**
1. macOS — Developer ID 인증서, `hardenedRuntime: true`,
   entitlements 파일, `notarize` 설정, `minimumSystemVersion` 명시
2. Windows — 코드 서명 인증서 또는 최소한 명확한 설치 안내
3. `tauri-plugin-updater` 도입 + 업데이트 매니페스트 호스팅
4. GitHub Actions로 태그 푸시 시 3-OS 빌드 → 서명 → 릴리스 자동화

**영향 파일** `src-tauri/tauri.conf.json`,
`src-tauri/tauri.macos.conf.json`, `src-tauri/Cargo.toml`,
신규 `.github/workflows/release.yml`
**난이도** 중 — 기술보다 인증서 발급·비용 문제

---

### P1-3. 창 위치·크기가 복원되지 않음

**현상**
사이드바 폭과 분할 비율은 복원하면서 창 자체는 매번 1280x820으로 리셋됩니다.
멀티 모니터에서 특히 불편합니다.

**근거**
`tauri-plugin-window-state`가 없고, `setPosition`/`outerPosition` 사용처도
없습니다.

**수정 방향**
`tauri-plugin-window-state` 도입. 창 라벨별로 상태를 저장하므로
멀티 윈도우와도 맞습니다. 사라진 모니터 좌표는 플러그인이 보정합니다.

**영향 파일** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`
**난이도** 하

---

### P1-4. OS 테마를 따르지 않음

**현상**
시스템 다크모드로 전환해도 앱은 그대로입니다. "시스템 따르기" 옵션이 없습니다.

**근거**
`prefers-color-scheme`이나 `matchMedia` 사용처가 코드베이스에 0건입니다.
`settings.ts`는 `theme: 'default'`로 시작합니다.

**수정 방향**
1. `ThemeName`에 `'system'` 추가
2. `matchMedia('(prefers-color-scheme: dark)')` 구독 →
   `default` / `dark`로 매핑
3. 설정 패널의 테마 컨트롤에 "시스템" 옵션 추가하고 기본값으로
4. 테마 전환 시 이미 있는 네이티브 타이틀바 색 동기화가 그대로 동작

**영향 파일** `src/store/settings.ts`, `src/types/workspace.ts`,
`src/components/shell/SettingsPanel.tsx`
**난이도** 하

---

### P1-5. Linux가 반쪽 지원

**현상**
Linux에서 Window·Help 메뉴에 접근할 수 없습니다.

**근거**
`linuxPlatformProfile.ts:11`이 `showsApplicationMenu: false`로 인앱 메뉴바를
끄는데, 네이티브 메뉴는 `lib.rs`에서 `#[cfg(target_os = "macos")]`로
macOS에만 등록됩니다. 결과적으로 사이드바 햄버거 메뉴만 남고,
`SidebarMenu`는 `window`와 `help` 그룹을 필터링해 제외합니다.

추가로:
- `.desktop` 파일과 MIME 연결 설정이 없음
- `targets: "all"`인데 빌드 스크립트와 README에 Linux가 없음
- `titleBarStyle: "Overlay"`, `trafficLightPosition`은 macOS 전용 옵션인데
  공통 config에 들어 있음

**수정 방향**

*최소 (권장)* — Linux 프로필을 Windows와 동일하게 `showsApplicationMenu: true`로
바꿔 인앱 메뉴를 노출. 한 줄 수정으로 메뉴 접근 불가가 해소됩니다.

*정식 지원* — `.desktop` + MIME 등록, AppImage/deb 빌드 스크립트,
macOS 전용 창 옵션을 `tauri.macos.conf.json`으로 이동, README에 Linux 명시.

*또는* — Linux를 공식 미지원으로 명시하고 프로필을 정리.

**영향 파일** `src/platform/desktop/linux/linuxPlatformProfile.ts`,
`src-tauri/tauri.conf.json`, `package.json`, `README.md`
**난이도** 하 (최소) / 중 (정식)

---

### P1-6. macOS 네이티브 통합 누락

**현상**

| 항목 | 상태 |
| --- | --- |
| Dock·Apple 메뉴의 최근 항목 | 파일이 등록되지 않음 |
| 앱 내 Open Recent | 워크스페이스만 있고 **파일 단위가 없음** |
| 창 제목 프록시 아이콘 | 없음 |
| 수정됨 표시 (닫기 버튼의 점) | 없음 |
| View 메뉴 | Zoom In/Out/Actual Size 없음 |
| Edit 메뉴 | Find / Find Next / Replace 없음 |
| Window 메뉴 | Bring All to Front 없음 |
| Help 메뉴 | **비어 있는 채로 노출** |
| Print | 메뉴에 없음 |

**수정 방향**
1. `NSDocumentController.noteNewRecentDocumentURL`로 OS 최근 문서 등록
   (`objc2`가 이미 의존성에 있음)
2. File 메뉴에 Open Recent File 서브메뉴 추가 —
   `files` 테이블의 `last_opened_at`을 그대로 사용
3. `window.set_title` + 수정 상태를 창 제목에 반영
4. 빈 Help 메뉴에 최소한 GitHub 링크와 단축키 목록
5. View에 Zoom In/Out — 이미 `fontSize` 3단계가 있으므로 연결만
6. Edit에 Find 연결 (`search.openFind` 명령이 이미 있음)

**영향 파일** `src-tauri/src/platform/macos/native_menu.rs`,
신규 `src-tauri/src/platform/macos/recent_documents.rs`,
`src/components/shell/appMenus.ts`
**난이도** 중

---

### P1-7. `Cmd+P`가 인쇄가 아님

**현상**
모든 OS에서 `Cmd/Ctrl+P`는 인쇄입니다. Saekim은 PDF 내보내기에 할당했습니다.
인쇄 기능 자체가 없는데 `styles/print.css`는 이미 존재합니다.

**근거**
`native_menu.rs`의 `MENU_EXPORT_PDF`와
`features/pdf-export/commands.ts`의 `defaultShortcut: 'mod+p'`.

**수정 방향**
1. `Cmd/Ctrl+P` → 인쇄 (`window.print()` + 기존 `print.css`)
2. PDF 내보내기 → `Cmd/Ctrl+Shift+E`
3. macOS File 메뉴에 Print 항목 추가

**영향 파일** `src/features/pdf-export/commands.ts`,
`src/hooks/useShortcuts.ts`, `src-tauri/src/platform/macos/native_menu.rs`
**난이도** 하

---

### P1-8. 단축키 처리의 구조적 문제

**현상**
`useShortcuts`가 N / O / S / F / P 다섯 키만 처리하고, `if` 체인이
`else if`가 아니라 병렬이라 한 키에 여러 분기가 평가됩니다.
`Cmd+W`, `Cmd+,`, `Cmd+B/I`, `Cmd+1/2/3` 등이 없습니다.

**수정 방향**
1. 하드코딩된 `if` 체인을 **키맵 테이블**로 교체 —
   `{ key, meta, shift, commandId }` 배열을 순회
2. 명령 레지스트리(`CommandRegistry`)와 통합해
   기능이 등록한 `defaultShortcut`이 자동으로 동작하게 함
3. 누락 단축키 추가 — 닫기, 설정, 볼드/이탤릭, 뷰 모드 전환, 사이드바 토글
4. 이후 사용자 단축키 재정의의 기반이 됨

**영향 파일** `src/hooks/useShortcuts.ts`, `src/app/commands.ts`
**난이도** 중

---

## W — 워크플로우 마찰

P0~P3이 "무엇이 없는가"를 다룬다면, 이 절은 **이미 있는 기능의 동선이 어색하거나
비효율적인 지점**을 다룹니다. 심각도가 항목마다 다르므로 각각에 표시했습니다.

### W-1. 저장할 때마다 워크스페이스 루트가 튄다

**심각도** 높음 — 워크스페이스를 쓰는 사용자가 매 저장마다 겪음

**현상**
`~/notes`를 워크스페이스로 열고 `~/notes/2024/journal/entry.md`를 편집한 뒤
`Cmd+S`를 누르면 **워크스페이스 루트가 `~/notes/2024/journal`로 바뀝니다.**
사이드바 트리가 통째로 교체되고 펼쳐둔 폴더가 전부 접힙니다.

**근거**
`src/store/workspace.ts:180`

```js
const folderPatch = await workspaceFolderPatchForFile(savedPath);
if (folderPatch) set((state) => applyFolderPatch(state, folderPatch));
```

`workspaceFolderPatchForFile`(`workspace.ts:365`)은 파일의 부모 폴더를 읽어
`rootPath`와 `tree`를 통째로 교체합니다.

핵심은 이것입니다 — 파일을 **열** 때는 `shouldRetainWorkspaceRootForFile`
(`workspace.ts:513`)이 "이 파일이 이미 워크스페이스 안에 있으면 루트를 유지"하도록
제대로 막아줍니다. 그런데 **`saveActive`·`saveActiveAs`·`createFile` 세 곳은
이 가드를 거치지 않고 `workspaceFolderPatchForFile`을 직접 호출합니다.**
열 때 지켜지는 규칙이 저장할 때만 깨집니다.

**부수 피해**

| 영향 | 내용 |
| --- | --- |
| 최근 목록 오염 | `applyFolderPatch`가 `upsertRecentWorkspace`를 호출해 저장할 때마다 하위 폴더가 최근 워크스페이스에 추가됨. 상한 5개라 진짜 워크스페이스가 밀려남 |
| 디스크 I/O | `readFolder`는 깊이 2단계 순회. `Cmd+S` 한 번에 디렉터리 워크가 한 번 |
| 상태 손실 | 폴더 펼침 상태(`isOpen`/`isLoaded`) 초기화 |

**수정 방향**
세 곳 모두 `workspaceFolderPatchForOpenFile(file, get().rootPath)`을 쓰도록 통일합니다.
저장 후에 필요한 건 트리 갱신이지 루트 교체가 아닙니다.

**영향 파일** `src/store/workspace.ts`
**난이도** 하 — 가드 함수가 이미 있음, 세 줄 교체

---

### W-2. `Cmd+N`이 곧바로 저장 다이얼로그를 띄운다

**심각도** 높음 — 가장 자주 쓰는 동선의 첫 단계

**현상**
`workspace.ts:103`의 `createFile`은 첫 줄이 `saveFileAs('', 'untitled.md')`입니다.
**한 글자도 치기 전에 저장 위치와 파일명을 정해야 합니다.**
&ldquo;메모 하나 급히 적자&rdquo;가 불가능합니다.

**왜 이렇게 되었나**
이미지 삽입(`features/image-assets/editorHandlers.ts:240`의 `requireSavedActiveFile`)은
`.assets/` 폴더를 만들 부모 경로가 필요해 저장된 문서를 요구합니다.
`createFile`이 미리 저장을 강제해 두면 이 검사에 걸릴 일이 없어집니다.
증상을 원인 쪽에서 막아둔 구조입니다.

**수정 방향**
1. untitled 버퍼를 메모리에 생성 — `~untitled-1` 형태의 placeholder 경로는
   `isPlaceholderPath`가 이미 지원합니다
2. 첫 `Cmd+S`에서 저장 다이얼로그 (`saveActive`가 이미
   `path.startsWith('~')`이면 `null`을 넘겨 다이얼로그를 띄웁니다)
3. 이미지 삽입 시에만 "먼저 저장해야 합니다" 안내 — 그 코드는 이미 있습니다

**영향 파일** `src/store/workspace.ts`
**난이도** 중

---

### W-3. 워크스페이스 검색이 접힌 폴더를 못 찾는다

**심각도** 높음 — 조용한 미탐

**현상**
존재하는 파일을 검색해도 **아무 결과 없이 "없음"이 나옵니다.**
사용자는 파일이 없다고 믿게 됩니다.

**근거**
`src/components/sidebar/Sidebar.tsx:172`의 `filterTree`는 메모리에 이미 로드된
`tree`만 훑습니다. 그런데 트리는 깊이 2단계까지만 선로딩되고 나머지는 펼칠 때
`readFolderChildren`으로 지연 로딩됩니다. 펼치지 않은 폴더의 파일은
검색 대상에 아예 없습니다.

오탐이 아니라 **미탐**이라 더 나쁩니다. 사용자가 잘못을 알아챌 방법이 없습니다.

**수정 방향**
1. Rust에 워크스페이스 전체 파일명 순회 커맨드 추가 (P2-2의 전역 검색과 같은 기반)
2. 임시 완화책 — "로드된 범위에서만 검색 중" 표시 + 전체 탐색 버튼

**영향 파일** `src/components/sidebar/Sidebar.tsx`, `src-tauri/src/commands/file.rs`
**난이도** 중

---

### W-4. 타이핑 60ms마다 문서 전체 재렌더

**심각도** 중 — 문서가 커질수록 악화

**현상**
데스크톱 프리뷰 정책이 `debounceMs: 60`입니다
(`src/platform/desktop/previewSurface.ts`). 보통 타자 속도(키 간격 100~200ms)에서는
**사실상 거의 모든 키 입력이 전체 재렌더를 유발합니다.**

한 번의 재렌더가 하는 일 — markdown-it 전체 재파싱 → Shiki로 모든 코드블록
재하이라이트 → mermaid로 모든 다이어그램 `mermaid.render()` → DOM 교체 →
블록 레이아웃 재적용.

참고로 Android는 `220ms`입니다. 데스크톱만 유독 공격적입니다.

**추가 문제 — 문서 전문을 React key로 사용**
`src/components/preview/PreviewContent.tsx:88`

```js
const previewRenderKey = previewResult?.kind === 'react'
  ? `${renderer?.id}:${previewResult.renderKey ?? activeFile?.id}:${activeFile?.content ?? ''}`
```

JSON·CSV 같은 react 프리뷰는 키 입력마다 컴포넌트가 통째로 언마운트/재마운트됩니다.
큰 CSV에서는 트리 접힘 상태도 함께 사라집니다.

**수정 방향**
1. 데스크톱 `debounceMs`를 200~300ms로
2. react key를 내용 해시 또는 `activeFile.id`로 교체
3. 장기적으로는 변경된 블록만 다시 그리는 증분 렌더

**영향 파일** `src/platform/desktop/previewSurface.ts`, `PreviewContent.tsx`
**난이도** 하 (1·2) / 상 (3)

---

### W-5. 사이드바를 넓히면 OS 창을 좁힐 수 없게 된다

**심각도** 중

**현상**
사이드바를 최대(420px)로 넓히고 분할 뷰이면 창 최소 폭이 992px가 됩니다.
**그 아래로 창을 줄일 수 없습니다.** macOS는 `set_min_size`가 현재 창보다 크면
창을 강제로 키우기까지 합니다.

**근거**
`src/hooks/useWindowSizeConstraints.ts`

```
minWidth = 사이드바폭 + 리사이저 + (split이면 280*2+6, 아니면 280)
        = 420 + 6 + 566 = 992
```

좁은 창으로 돌아가려면 먼저 사이드바를 줄여야 한다는 걸 사용자가 알아낼 방법이
없습니다. `tauri.conf.json`의 `minWidth: 622`도 이 훅이 덮어씁니다.

**수정 방향**
OS 최소 폭은 622로 고정하고, 공간이 부족하면 사이드바를 접거나 뷰 모드를
강등하는 쪽으로 대응합니다. 반응형 프로필 로직이 이미 그 일을 하고 있습니다.

**영향 파일** `src/hooks/useWindowSizeConstraints.ts`
**난이도** 하

---

### W-6. 상태바가 파일 형식을 거짓으로 표시한다

**심각도** 낮음 — 다만 한 화면에서 모순이 보임

**근거**
`src/components/shell/StatusBar.tsx:12`

```js
const language = activeFile?.name.endsWith('.txt') ? 'Text' : 'Markdown';
```

`.json`, `.yaml`, `.rs`, `.csv` — **전부 "Markdown"으로 표시됩니다.**
같은 화면의 편집기 툴바는 `getFileTypeLabel`(`EditorPane.tsx:125`)로 올바른
형식을 보여주고 있어서, 한 화면에 서로 다른 답이 동시에 뜹니다.

**수정 방향**
`getFileTypeLabel(activeFile.name, activeFile.path, enabledFeatures)`로 교체.

**영향 파일** `src/components/shell/StatusBar.tsx`
**난이도** 하 — 한 줄

---

### W-7. 앞뒤 이동이 조용히 무반응

**심각도** 낮음 — 지금은 드러나지 않지만 P0-7 수정 시 즉시 표면화

**근거**
`historyPrev`/`historyNext`는 **이미 열려 있는 파일 중에서만** 이동합니다.

```js
const file = state.openFiles.find((candidate) => candidate.path === previousPath);
if (!file) return {};
```

히스토리에 남아 있지만 `openFiles`에 없는 경로면 아무 일도 일어나지 않습니다.
버튼은 활성 상태인데 눌러도 반응이 없습니다.

현재는 파일을 닫을 수 없어(P0-7) 이 상황이 잘 생기지 않지만,
닫기를 붙이는 순간 바로 드러납니다.

**수정 방향**
`openFiles`에 없으면 디스크에서 다시 엽니다. P0-7·P2-1과 함께 처리합니다.

**영향 파일** `src/store/workspace.ts`
**난이도** 하

---

### W-8. 그 밖의 마찰

**심각도** 낮음

| 지점 | 내용 |
| --- | --- |
| **사이드바 새로고침 버튼** | 파일 워처(P0-5)가 없어 수동 버튼이 필요한 상태. 버튼의 존재 자체가 증상입니다. 게다가 `refresh()`는 트리를 통째로 다시 읽어 펼침 상태를 날립니다 |
| **arrange 모드가 전역** | 블록 재배치 모드가 문서별이 아니라 앱 전역 상태라 파일을 바꿔도 계속 arrange 모드입니다. 세션에도 저장되지 않아 재시작하면 항상 `view` |
| **설정에 단축키 없음** | 타이틀바 톱니바퀴 클릭이 유일한 경로. `Cmd+,`가 비어 있습니다 (P1-8과 함께) |
| **단어 수 매 렌더 전체 스캔** | `countKoreanAwareWords(content)`가 memo 없이 렌더마다 문서 전체를 훑습니다 |
| **커서 훅 이중 실행** | `useCursorPosition`이 `EditorPane`과 `StatusBar`에서 각각 돌면서, 키 입력마다 textarea에 리스너 4개를 떼었다 붙입니다 — 두 번씩 |

---

## U — UI와 반응형

데스크톱·태블릿·모바일·Android 셸의 화면 문제를 다룹니다.
W가 "동선"이라면 U는 "화면 그 자체"입니다.

### U-0. 전제 — 미디어 쿼리가 사실상 없다

CSS 4,533줄 전체에서 반응형 미디어 쿼리는 **`@media (max-width: 860px)` 하나**입니다
(나머지 2개는 `print`). 반응형은 전부 JS가 붙이는 `data-viewport-profile` 속성으로
처리합니다 — compact 32개 규칙, medium 20개 규칙.

작동은 합니다. 문제는 **CSS 기능 쿼리를 쓸 수 없게 된다는 것**입니다.
아래 U-3·U-5·U-6이 전부 여기서 파생됩니다.

| 쿼리 | 사용 | 결과 |
| --- | :-: | --- |
| `hover: none` / `pointer: coarse` | 0건 | `:hover` 33개 규칙에 터치 대체 경로 없음 |
| `prefers-reduced-motion` | 0건 | transition/animation 11개가 무조건 재생 |
| `prefers-color-scheme` | 0건 | OS 테마 미추종 (P1-4와 동일 원인) |
| `env(safe-area-inset-*)` | 0건 | 노치·홈 인디케이터 침범 |

---

### U-1. 모바일에서 파일 브라우저가 통째로 사라진다

**심각도** 높음 — 모바일에서 앱의 절반이 빠진 상태

**근거**
`src/styles/app.css:1188`

```css
.app[data-viewport-profile="compact"] .sidebar-search,
.app[data-viewport-profile="compact"] .sidebar-folder-path,
.app[data-viewport-profile="compact"] .file-tree {
  display: none;
}
```

**`data-sidebar` 상태와 무관하게 무조건 숨깁니다.** compact(≤599px)에서 사이드바는
`.sidebar-head`만 남은 56px 레일이 됩니다. 파일 트리도, 워크스페이스 경로도,
검색도 없습니다.

파일에 접근할 유일한 경로는 메뉴 → "파일 열기" 네이티브 다이얼로그(Android는 SAF)입니다.
트리 탐색, 워크스페이스 검색이 전부 막힙니다.

**부수 문제 — 죽은 컨트롤**
`SidebarToggle`은 그대로 렌더되고 아이콘도 바뀌지만(`folderOpen` ↔ `folder`),
compact에서는 그리드 컬럼이 항상 `--sidebar-w-collapsed`로 고정(`app.css:447`)이라
**눌러도 아무 일도 일어나지 않습니다.**

**수정 방향**
1. 모바일에서는 사이드바를 **오버레이 드로어**로 — 레일 토글로 열고 배경 탭으로 닫기
2. `SidebarToggle`이 compact에서는 드로어를 여닫도록 연결
3. 드로어 안에 트리·경로·검색을 그대로 배치 (컴포넌트 재사용, CSS만 추가)

**영향 파일** `src/styles/app.css`, `src/components/sidebar/Sidebar.tsx`
**난이도** 중

---

### U-2. Android 다크 모드 테마가 미구현

**심각도** 높음 — Android 사용자 절반이 겪음

**근거**
`src-tauri/gen/android/app/src/main/res/values-night/themes.xml`은 존재하지만
**`values/themes.xml`과 바이트 단위로 동일합니다.** 둘 다 이렇게 설정합니다.

```xml
<item name="android:windowLightStatusBar">true</item>
<item name="android:windowLightNavigationBar">true</item>
```

그리고 **`values-night/colors.xml`이 아예 없습니다.**

| 리소스 | 값 | 다크 모드에서의 문제 |
| --- | --- | --- |
| `saekim_background` | `#FFF8F7F3` | 앱 시작 시 흰 화면 플래시 |
| `saekim_system_bar` | `#FFF8F7F3` | 어두운 앱 위에 흰 상태바/내비바 |
| `windowLightStatusBar` | `true` | 어두운 배경에 어두운 아이콘 → 안 보임 |

**시스템 바가 인앱 테마도 따라가지 않습니다.**
`useNativeWindowChrome`이 테마 변경 시 `setWindowBackgroundColor`를 호출하지만
(`AppShell.tsx:71`) `window.chrome` capability로 가드되어 있고 Android에는
그 capability가 없습니다. Saekim에서 Dark나 Nord를 골라도 상태바는 계속 흰색입니다.

**잘 되어 있는 부분** — `windowSoftInputMode="adjustResize"`, `configChanges`에
orientation·screenSize·uiMode 포함, `resizeableActivity="true"`, `supportsRtl="true"`.
네이티브 매니페스트 자체는 제대로 잡혀 있습니다.

**수정 방향**
1. `values-night/colors.xml` 추가 — 다크용 background / system_bar
2. `values-night/themes.xml`에서 `windowLightStatusBar`·`windowLightNavigationBar`를 `false`로
3. Android에도 시스템 바 색 동기화 경로 마련 — `window.chrome` 대신
   별도 capability(`system.bars` 등)를 두거나 Kotlin 플러그인에서 처리

**영향 파일** `res/values-night/colors.xml`(신규), `res/values-night/themes.xml`,
`src/platform/android/androidCapabilities.ts`
**난이도** 하 (1·2) / 중 (3)

---

### U-3. 터치 타깃이 전부 미달

**심각도** 높음 — Android가 출시 대상

Apple HIG 44pt, Material 48dp 기준인데 실제 값은 이렇습니다.

| 요소 | 크기 | 기준 대비 |
| --- | --- | --- |
| `--sidebar-control-size` (모바일 레일 버튼) | 30px | 62% |
| `.ui-segmented button` | 28px | 58% |
| `.ui-segmented[data-size="sm"] button` | 24px | 50% |
| 아이콘 버튼 | 24~28px | 50~58% |
| `.ic` 아이콘 | 14~16px | — |
| `--pane-resizer-w` | 6px (`::after`로 ±6px → 실효 18px) | 38% |

전부 최소 기준의 절반 수준입니다.

**수정 방향**
`pointer: coarse` 미디어 쿼리로 터치 기기에서만 크기 토큰을 키웁니다.
`--sidebar-control-size` 같은 값이 이미 토큰이라 값만 갈아끼우면 됩니다.

```css
@media (pointer: coarse) {
  :root { --sidebar-control-size: 44px; --pane-resizer-w: 12px; }
}
```

리사이저는 `::after` 확장 폭을 함께 키웁니다.

**영향 파일** `src/styles/tokens.css`, `src/styles/ui.css`, `src/styles/app.css`
**난이도** 중

---

### U-4. 태블릿 분할 뷰에서 그리드가 넘쳐 잘린다

**심각도** 중 — Android 태블릿·분할 화면

**근거**
medium 프로필 그리드의 최소 폭은 이렇습니다.

```
196(사이드바) + 6 + 240(편집기) + 6 + 240(프리뷰) = 688px
```

medium 범위는 600~839px입니다. 데스크톱에서는 `useWindowSizeConstraints`가
OS 창 최소 폭을 강제해 이 상황을 막아줍니다. 그런데 **그 훅은 `window.chrome`
capability가 있어야 동작하고, Android에는 그 capability가 없습니다**
(`src/platform/android/androidCapabilities.ts`).

즉 **Android 태블릿 600~688px 구간에서 분할 뷰를 켜면 그리드가 컨테이너를 넘고,
`.body { overflow: hidden }`이라 프리뷰가 스크롤 없이 잘립니다.**
세로 모드 태블릿과 분할 화면(`resizeableActivity="true"`)에서 바로 걸립니다.

**수정 방향**
1. medium 프로필의 분할 가용 여부를 폭으로 판정 — 688px 미만이면 `split` 제외
   (`viewModesForViewportProfile`이 이미 프로필별 목록을 반환하므로 폭 인자만 추가)
2. 또는 medium 최소 폭을 낮춰(사이드바 축소 + pane-min 200px) 600px에 들어가게 함

**영향 파일** `src/hooks/useResponsiveViewMode.ts`, `src/styles/app.css`
**난이도** 하

---

### U-5. 모바일에서 화면 공간을 낭비한다

**심각도** 중

| 지점 | 내용 |
| --- | --- |
| **줄번호 48px 고정** | `.editor-content { grid-template-columns: 48px 1fr }`. 375px 화면의 **13%**를 줄번호가 먹습니다. 끄는 설정이 없습니다 |
| **헬퍼 모달이 `100vh`** | `editorHelper.css:14`의 `height: min(720px, calc(100vh - 72px))`. 앱 셸은 `100dvh`를 쓰는데(`app.css:10`) 모달만 `100vh`라 키보드가 올라오면 화면 밖으로 넘칩니다 |
| **모달 백드롭 패딩 36px** | 375px 화면에서 실폭 303px. 검색+미리보기 모달로는 지나치게 좁습니다 |
| **편집기 패딩 고정** | `padding: 20px 24px 20px 18px` — 뷰포트 무관 |
| **글자 크기 최소 12px** | 폰 화면에서 과하게 작습니다. UI 폰트는 `14px` 하드코딩이라 OS 글자 크기 설정도 무시 |

**수정 방향**
줄번호 표시 토글을 설정에 추가하고 compact에서 기본 꺼짐.
모달 `100vh` → `100dvh`, 백드롭 패딩을 `clamp()`로.

**영향 파일** `src/styles/app.css`, `src/core/editor/editorHelper.css`, `src/store/settings.ts`
**난이도** 하

---

### U-6. 포커스 표시가 거의 없다

**심각도** 중 — 접근성(P2-5)의 화면 쪽 대응

전체 CSS에서 `:focus`/`:focus-visible` 규칙 **6개**, `outline: none` **6개**.
스타일을 준 만큼 지웠습니다. 메뉴·다이얼로그·트리·툴바가 있는 앱인데
키보드 포커스가 대부분 보이지 않습니다.

**수정 방향**
전역 `:focus-visible` 기본 링을 한 번 정의하고, `outline: none`은
대체 표시가 있는 곳에만 남깁니다. `--accent-border` 토큰이 이미 있습니다.

**영향 파일** `src/styles/globals.css`, `src/styles/ui.css`
**난이도** 중

---

### U-7. 태블릿·모바일에서 뷰 모드 토글이 숨겨진다

**심각도** 낮음

`.app[data-viewport-profile="compact"] .header-view-toggle`와
`.app[data-viewport-profile="medium"] .header-view-toggle`가 모두 `display: none`입니다.

태블릿에서 편집/분할/보기 전환은 사이드바 메뉴를 열거나 6px 리사이저를 끄는 것뿐입니다.
가장 자주 쓰는 컨트롤이 가장 접근하기 어려워졌습니다.

**수정 방향**
medium에서는 토글을 유지하되 아이콘만 남깁니다(라벨 제거).
compact에서는 하단 탭 형태가 더 맞습니다.

**영향 파일** `src/styles/app.css`, `src/components/shell/Header.tsx`
**난이도** 하

---

### U-8. 그 밖의 UI 정리

**심각도** 낮음

| 지점 | 내용 |
| --- | --- |
| **스크롤바가 항상 자리 차지** | `::-webkit-scrollbar { width: 10px }` 고정에 thumb는 `:hover`로 밝아집니다. 터치에는 hover가 없어 항상 흐린 상태로 10px를 먹습니다. `scrollbar-gutter`도 없음 |
| **`overscroll-behavior` 없음** | 프리뷰를 끝까지 스크롤하면 부모로 체이닝됩니다 |
| **그리드 특이성이 취약** | `.body`의 `grid-template-columns`를 두고 15개 규칙이 경쟁하는데, compact/medium 규칙이 **동일 특이성에서 소스 순서로만** 이깁니다. 지금은 맞게 동작하지만 규칙 하나만 위로 옮겨도 레이아웃이 깨집니다 |
| **테마 3종 중 라이트 1종** | `default`(라이트) / `dark` / `nord`(둘 다 다크). 토큰 오버라이드 자체는 완전합니다 |
| **`viewport-fit=cover` 없음** | `index.html`의 viewport 메타에 빠져 있어, 나중에 `env(safe-area-inset-*)`를 넣어도 동작하지 않습니다 |

---

## P2 — 기능 공백

### P2-1. 탭 바 없음

여러 파일을 열 수 있는데(`openFiles` 배열) 전환 UI는 사이드바 트리의
표시점뿐입니다. 탭 스트립, `Cmd+1~9` 이동, `Cmd+W` 닫기,
`Cmd+Shift+T` 복원이 필요합니다.

스토어에 `setActiveFile`과 `closeFile`이 이미 구현되어 있으므로
(P0-7 참고) 사실상 UI만 만들면 됩니다. P0-7을 임시로 단축키만 연결해
막아두더라도, 제대로 된 해결은 탭 바입니다.

### P2-2. 바꾸기 없음

`FindBar`는 찾기 전용입니다. 필요한 것:

- 바꾸기 / 전체 바꾸기
- 정규식, 대소문자 구분, 단어 단위
- 선택 영역 내 검색
- 워크스페이스 전체 검색 (Rust 쪽에 병렬 그렙 커맨드 추가)

### P2-3. 파일 조작 없음

트리에서 이름 변경, 삭제, 새 폴더, 복제, 휴지통 이동이 모두 불가능합니다.
관련 Rust 커맨드 자체가 없습니다. `trash` 크레이트를 쓰면 영구 삭제 대신
OS 휴지통으로 보낼 수 있습니다.

### P2-4. 아웃라인 없음

긴 문서에서 헤딩으로 이동할 수단이 없습니다.
Markdown 렌더러가 이미 `data-source-line`을 붙이고 있어
스크롤 동기화 인프라를 그대로 재사용할 수 있습니다.

### P2-5. 접근성

- `FileTreeNode.tsx`에 `role`, `tabIndex`, `onKeyDown`, `aria-*`가 하나도 없어
  트리를 키보드로 조작할 수 없음
- `spellCheck={false}` 하드코딩, 토글 없음
- 포커스 트랩과 포커스 순서가 모달·팝오버에서 일관되지 않음

### P2-6. 대용량 파일 성능

단일 `<textarea>`에 전체 내용을 넣고, 줄번호도 전량 DOM으로 렌더합니다.
가상화가 없어 수 MB 파일에서 입력 지연이 생깁니다. 상한은 20MB입니다.

단기로는 파일 크기에 따라 프리뷰 자동 렌더를 끄고 수동 갱신으로 전환하는
완화책이 현실적입니다.

### P2-7. PDF 품질

`html2canvas` + `jsPDF` 조합은 페이지 분할 회피, 제목 붙임, 여백 트리밍까지
정교하게 만들어져 있지만 결과물은 **래스터 이미지**입니다.
텍스트 선택·검색·링크가 안 되고 용량이 크며 고DPI에서 흐립니다.

웹뷰의 print-to-PDF(WKWebView `createPDF`, WebView2 `PrintToPdfAsync`)를 쓰면
벡터 PDF가 나옵니다. 다만 페이지 제어권을 CSS `@page`에 넘겨야 하므로
현재의 세밀한 분할 로직을 CSS로 옮기는 작업이 따릅니다.

### P2-8. 국제화

UI 문자열이 전부 한국어로 하드코딩되어 있습니다. README는 영어/한국어
둘 다 있는데 앱은 한국어 전용입니다. 경량 i18n 레이어와 언어 전환이 필요합니다.

### P2-9. 테스트와 CI

프론트엔드 테스트가 0건이고 `.github/`가 없습니다.
Rust 단위 테스트만 존재합니다.

최소 구성:
- Vitest — 마크다운 렌더러, 텍스트 편집 유틸, 레이아웃 식별,
  구조화 데이터 파서
- GitHub Actions — `pnpm lint`, `tsc`, `vitest`, `cargo test`, 3-OS 빌드

---

## P3 — 신규 기능 제안

### 3.3에 넣기 좋은 것 (기존 구조 재활용)

| 기능 | 재사용 대상 | 비고 |
| --- | --- | --- |
| **자동 저장 + 로컬 버전 히스토리** | `files.last_content_hash`, 세션 DB | P0-1·P0-6과 함께 설계하면 스냅샷 테이블 하나로 해결 |
| **명령 팔레트 `Cmd+K`** | `CommandRegistry` | 이미 id·라벨·단축키가 등록되어 있어 UI만 필요. 메뉴 구멍(P1-6)도 우회됨 |
| **문서 아웃라인** | `data-source-line` 앵커 | 스크롤 동기화 로직 재사용 |
| **탭 바** | `openFiles` 배열 | P2-1 |
| **찾기/바꾸기 + 전역 검색** | `FindBar`, Rust 파일 순회 | P2-2 |

### 3.4 이후 — 문서 작성 경험

- **YAML front matter 인식** — 프리뷰에서 메타 블록으로 렌더하고
  속성 패널로 편집. 구조화 데이터 파서가 이미 YAML을 다룹니다.
- **표 GUI 편집기** — 마크다운 표는 손으로 정렬하기 가장 번거로운 부분입니다.
  블록 레이아웃이 이미 표를 블록으로 인식하므로 자연스러운 확장입니다.
- **HTML → Markdown 붙여넣기 변환** — `Cmd+Shift+V`.
  클립보드 이미지 처리가 이미 있어 짝이 맞습니다.
- **이미지 자동 최적화** — `.assets/` 복사 시 리사이즈·WebP 변환 옵션.
  `import_image_bytes_to_assets` 경로에 바로 얹힙니다.
- **위키링크 `[[문서]]` + 백링크** — 로컬 우선 에디터의 차별점.
  `.assets/` 워크플로와 철학이 같습니다.
- **스니펫과 문서 템플릿** — 헬퍼 모달 UI를 그대로 씁니다.

### 4.0 방향

- **깨진 링크·이미지 검사기** — 상대 경로 이미지가 자주 깨지는데
  현재 잡아줄 수단이 없습니다.
- **Git 상태 표시** — 트리에 변경/추가 배지, 저장 시 diff 미리보기.
  워크스페이스가 이미 폴더 기반이라 붙이기 쉽습니다.
- **HTML / DOCX 내보내기** — 벡터 PDF와 함께.
- **Zen / 타자기 스크롤 모드** — 스크롤 동기화 인프라 재사용.
- **OS 맞춤법 검사 연동** — `spellCheck` 토글부터.
- **플러그인 API 공개** — `SaekimFeature` 인터페이스가 이미
  플러그인 시스템에 가깝습니다. 외부 로딩 경로만 열면 됩니다.

---

## 마일스톤

### 3.2.1 — 데이터 안전성 핫픽스

가장 위험한 항목만 모았습니다. 셋 다 "사용자가 눈치채지 못한 채 데이터가
변형·유실되는" 유형이고 수정 난이도는 낮습니다.

| 항목 | 난이도 |
| --- | --- |
| P0-2 원자적 저장 | 하 |
| P0-3 CRLF 보존 | 하 |
| P0-8 SQLite WAL + busy_timeout | 하 |
| P0-7 `Cmd+W` 파일 닫기 연결 | 하 |
| **W-1 저장 시 워크스페이스 루트 고정** | 하 |
| **W-4 데스크톱 디바운스 60 → 250ms** | 하 |
| **W-6 상태바 파일 형식 교정** | 하 |
| **W-5 OS 최소 폭을 사이드바와 분리** | 하 |
| **U-2 Android 다크 모드 색상·시스템 바** | 하 |
| P0-1 닫기 시 저장 확인 | 중 |

W-1·W-4·W-5·W-6은 각각 몇 줄이고 체감이 즉시 옵니다. 특히 W-1은 워크스페이스를
쓰는 사람이면 매 저장마다 겪는 문제라 가장 먼저 잡을 값어치가 있습니다.

### 3.3 — 플랫폼 정리

| 항목 | 난이도 |
| --- | --- |
| P1-1 capability 스코프 + 우회 코드 제거 | 하 + 중 |
| P1-3 창 상태 복원 | 하 |
| P1-4 시스템 테마 추종 | 하 |
| P1-5 Linux 메뉴 접근 (최소안) | 하 |
| P1-7 `Cmd+P` 인쇄로 되돌리기 | 하 |
| **W-7 히스토리가 닫힌 파일도 다시 열도록** | 하 |
| P0-4 인코딩 왕복 | 중 |
| P0-6 세션 DB에서 본문 분리 | 중 |
| **U-4 태블릿 분할 뷰 최소 폭 가드** | 하 |
| **U-7 태블릿 뷰 모드 토글 복원** | 하 |
| **W-2 untitled 버퍼 도입** | 중 |
| **W-3 검색이 미로드 폴더를 찾도록** | 중 |

### 3.4 — 에디터 완성도

| 항목 | 난이도 |
| --- | --- |
| P2-1 탭 바 | 중 |
| P2-2 찾기/바꾸기 + 전역 검색 | 중 |
| P2-3 파일 조작 (휴지통 포함) | 중 |
| P2-4 아웃라인 | 중 |
| P3 명령 팔레트 | 중 |
| P1-8 키맵 테이블화 | 중 |
| **U-6 포커스 링 일괄 정비** | 중 |
| P0-5 파일 워처 | 상 |

### 3.5 — 태블릿과 모바일

작은 화면을 하나의 묶음으로 처리합니다. 지금 상태로는 Android가 "실험적"이라는
표기에 걸맞지만, 이 마일스톤을 끝내면 정식 지원이라 부를 수 있습니다.

| 항목 | 난이도 |
| --- | --- |
| U-8 스크롤바·overscroll·그리드 특이성 정리 | 하 |
| U-5 모바일 공간 낭비 (줄번호 토글, `100dvh`, 패딩) | 하 |
| U-1 모바일 파일 브라우저 복원 (오버레이 드로어) | 중 |
| U-3 터치 타깃 44px (`pointer: coarse` 분기) | 중 |

### 4.0 — 배포와 확장

| 항목 | 난이도 |
| --- | --- |
| P1-2 서명·노타라이즈·자동 업데이트 | 중 |
| P2-9 테스트 + CI | 중 |
| P1-6 macOS 네이티브 통합 | 중 |
| P2-7 벡터 PDF | 상 |
| P2-8 국제화 | 중 |
| P3 자동 저장 + 버전 히스토리 | 상 |

---

## 우선순위 근거

작업 순서를 정할 때 쓴 기준입니다.

1. **조용한 데이터 손실이 가장 비쌉니다.** 사용자가 알아채지 못하는 유실은
   신뢰를 잃는 방식이 다릅니다. P0-2·P0-3·P0-4가 여기 해당합니다.
2. **우회 코드를 낳는 근본 원인을 먼저 제거합니다.** P1-1은 수정 자체는
   설정 한 줄인데, 이것이 폴링 루프와 `eval` 주입을 없앱니다.
   기능을 추가하기 전에 정리하는 편이 쌉니다.
3. **이미 있는 인프라를 쓰는 기능을 먼저 만듭니다.** 명령 팔레트, 아웃라인,
   탭 바는 데이터 구조가 이미 있어 투자 대비 효과가 큽니다.
4. **배포를 막는 항목은 실제 배포 직전에 처리합니다.** 서명·업데이터는
   기술 난이도보다 인증서 조달이 병목이므로 일정을 따로 잡습니다.
5. **동선 마찰은 투자 대비 효과가 가장 큽니다.** W-1·W-4·W-5·W-6은 합쳐서
   수십 줄인데, 매일 쓰는 사람이 매번 부딪히는 지점입니다. 기능을 하나 더
   만드는 것보다 먼저 할 값어치가 있습니다.
6. **작은 화면은 묶어서 한 번에 처리합니다.** U 항목은 서로 얽혀 있습니다 —
   터치 타깃(U-3)과 모바일 드로어(U-1)는 같은 CSS 구조를 건드리고,
   둘 다 `pointer: coarse` 분기(U-0)가 먼저 있어야 깔끔합니다.
   흩어서 고치면 같은 파일을 세 번 열게 됩니다. 다만 Android 다크 모드
   색상(U-2)만은 독립적이고 눈에 띄는 결함이라 핫픽스로 앞당깁니다.
