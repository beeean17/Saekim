# Saekim 기능 명세

Saekim 3.2.0 기준으로 현재 구현되어 있는 기능을 전부 정리한 문서입니다.
설계 원칙은 [platform-architecture.md](platform-architecture.md)를 참고하세요.

- **런타임**: Tauri 2 / React 18.3.1 / TypeScript 5.8.3 / Rust stable
- **상태 관리**: zustand 5 (workspace / ui / settings + 기능별 store)
- **코드 규모**: TS·TSX·Rust 약 20,300줄

---

## 1. 플랫폼 지원 매트릭스

플랫폼별 동작은 `src/platform/*/`의 **플랫폼 프로필**이 결정합니다. 프로필은
백엔드 어댑터, capability 집합, 프리뷰 서피스 정책, 창 크롬 정책을 묶습니다.

| 프로필 | 파일 | 셸 런타임 | 상태 |
| --- | --- | --- | --- |
| macOS | `desktop/macos/macosPlatformProfile.ts` | `desktop` | 주 지원 |
| Windows | `desktop/windows/windowsPlatformProfile.ts` | `desktop` | 주 지원 |
| Linux | `desktop/linux/linuxPlatformProfile.ts` | `desktop` | 부분 지원 |
| Android | `android/androidPlatformProfile.ts` | `android` | 실험적 |
| Browser | `browser/browserPlatformProfile.ts` | `browser` | 개발용 |

### Capability 집합

기능은 capability 유무로 켜지고 꺼집니다 (`src/platform/common/capabilityTypes.ts`).

| Capability | Desktop | Android | Browser |
| --- | :-: | :-: | :-: |
| `file.open` / `file.save` | O | O | - |
| `folder.open` / `folder.tree` | O | O | - |
| `image.pick` | O | O | - |
| `image.copyToAssets` | O | O | - |
| `image.importBytesToAssets` | O | O | - |
| `image.downloadToAssets` | O | O | - |
| `externalFile.open` | O | O | - |
| `metadata.sqlite` | O | O | - |
| `pdf.save` | O | - | - |
| `window.chrome` | O | - | - |
| `native.menu` | O | - | - |

### 창 크롬 정책

| 프로필 | 인앱 메뉴바 | 타이틀바 클래스 | 네이티브 색 동기화 |
| --- | :-: | --- | :-: |
| macOS | 없음 (네이티브 메뉴 사용) | - | O |
| Windows | 있음 | `windows-titlebar menu-titlebar` | O |
| Linux | 없음 | - | O |
| Android | 없음 | - | - |

---

## 2. 기능 레지스트리

`src/app/featureRegistry.ts`가 11개 기능을 선언하고, 앱 시작 시 capability와
의존성을 검사해 활성 목록을 결정합니다.

| 기능 ID | 의존 | 필요 capability | 기여 항목 |
| --- | --- | --- | --- |
| `file-workspace` | - | `file.open`, `file.save` | - |
| `markdown` | - | - | preview, editor, fileTypes |
| `mermaid` | `markdown` | - | preview, editor |
| `katex` | `markdown` | - | editor |
| `structured-data` | - | - | preview x2, fileTypes x5 |
| `html-preview` | - | - | preview, fileTypes |
| `image-assets` | `markdown` | image.* 4종 | editor |
| `metadata` | - | `metadata.sqlite` | - |
| `block-layout` | `markdown`, `metadata` | `metadata.sqlite` | preview, metadata |
| `pdf-export` | - | `pdf.save` | commands, pdf |
| `search` | - | - | editor, commands |

### 선택 알고리즘

1. `hasRequiredCapabilities`로 required capability가 없는 기능을 제거
2. `dependsOn`이 살아남지 못한 기능을 반복 제거 (고정점에 도달할 때까지)
3. `validateFeatureGraph`가 누락 의존성·미충족 capability·순환 의존을 검사하고
   위반 시 예외를 던져 앱을 중단

### 기여(contribution) 종류

`src/app/feature.ts`가 정의하는 확장 포인트입니다.

- **`preview`** — `match` / `priority` / `render` / `afterRender` / `cleanup` /
  `head` / `supportsBlockLayouts`
- **`fileTypes`** — 확장자, 라벨, 언어, `previewKind` 매핑
- **`editor`** — 툴바 항목, 오버레이 컴포넌트, 헬퍼 모달, 이벤트 핸들러,
  이미지 액션
- **`commands`** — id, 기본 단축키, 메뉴 배치, 실행 함수
- **`metadata`** — 블록 레이아웃 읽기/쓰기
- **`pdf`** — 현재 문서 내보내기

---

## 3. 파일 및 워크스페이스

### 3.1 지원 파일 형식

**프리뷰가 있는 형식** (`featureRegistry.ts`의 `fileTypes`)

| 확장자 | 라벨 | previewKind |
| --- | --- | --- |
| `md` `markdown` `mdown` `mkd` | md | `markdown` |
| `html` `htm` | html | `html` |
| `json` | json | `structured-data` |
| `yml` `yaml` | yaml | `structured-data` |
| `toml` | toml | `structured-data` |
| `csv` | csv | `tabular-data` |
| `tsv` | tsv | `tabular-data` |

**열 수 있는 텍스트 확장자** (`src-tauri/src/core/text_file.rs`, 45종)

```
md markdown mdown mkd txt log html htm json yml yaml toml env
css js jsx ts tsx xml csv tsv ini conf config sql
sh bash zsh fish py rs go java c h cpp hpp cs rb php swift kt kts
```

**확장자 없이 이름으로 인식** — `.env` 계열, `.gitignore`, `.gitattributes`,
`.npmrc`, `.nvmrc`, `Dockerfile`, `Makefile`, `README`, `LICENSE`, `CHANGELOG`

**차단되는 바이너리 확장자** — 이미지·동영상·오디오·압축·실행파일·폰트·DB 등 50여종

### 3.2 텍스트 판정 파이프라인

1. `fs::metadata`로 실제 파일인지, 20MB(`MAX_TEXT_FILE_BYTES`) 이하인지 확인
2. `BINARY_EXTENSIONS`에 걸리면 즉시 거부
3. 알려진 텍스트 확장자/파일명이면 통과
4. 아니면 앞 8KB(`SNIFF_BYTES`)를 읽어 스니핑
   - NUL 바이트가 있으면 바이너리
   - 제어문자 비율이 30%를 넘으면 바이너리
   - 디코딩에 실패하면 바이너리

### 3.3 인코딩 디코딩

`decode_text_bytes`가 BOM을 보고 분기합니다.

| BOM | 처리 |
| --- | --- |
| `EF BB BF` | UTF-8 BOM 제거 후 디코딩 |
| `FF FE` | UTF-16 LE 디코딩 |
| `FE FF` | UTF-16 BE 디코딩 |
| 없음 | UTF-8 디코딩 |

> 저장은 항상 BOM 없는 UTF-8입니다. 원본 인코딩은 왕복되지 않습니다.

### 3.4 워크스페이스 트리

- 폴더 열기 시 깊이 2단계까지 선로딩, 이후 펼칠 때 `read_folder_children`으로
  지연 로딩
- 노드에 `modifiedAt`, `isOpen`, `isLoaded` 상태 보관
- `.assets` 폴더를 트리에 노출
- 최근 워크스페이스 목록 유지 (macOS 네이티브 메뉴의 Open Recent Workspace와 연동)
- 앞/뒤 이동 히스토리 (`history.back` / `history.forward`)

> 열린 파일을 **닫는 경로가 없습니다.** `useWorkspaceStore.closeFile`은
> `workspace.ts:147`에 구현되어 있지만 호출하는 코드가 없고, 단축키도
> 닫기 버튼도 연결되어 있지 않습니다. `openFiles`는 계속 누적됩니다.

### 3.5 파일 열기 경로

| 경로 | 구현 |
| --- | --- |
| 다이얼로그 | `open_file_dialog` / `open_folder_dialog` (tauri-plugin-dialog) |
| OS 파일 연결 | 실행 인자 파싱 → `queue_open_files` |
| macOS Open With | `RunEvent::Opened` + `platform::macos::open_documents` |
| 드래그 앤 드롭 | `WindowEvent::DragDrop` / `WebviewEvent::DragDrop` |
| 두 번째 인스턴스 | `tauri-plugin-single-instance` → 기존 창으로 전달 후 포커스 |
| Android | `content://` URI + SAF |

열린 파일은 `pending_open_files` 큐에 쌓이고, 프론트엔드가
`take_pending_open_files`로 가져갑니다. 이벤트 전달은 3중화되어 있습니다 —
전역 emit, 창 타깃 emit, `window.eval` 기반 DOM CustomEvent. 여기에 1.5초 폴링과
포커스·visibility 이벤트 플러시가 더해집니다.

### 3.6 Rust 커맨드 목록

| 커맨드 | 역할 |
| --- | --- |
| `open_file_dialog` / `open_folder_dialog` | 네이티브 선택 다이얼로그 |
| `read_file` / `read_folder` / `read_folder_children` | 읽기 |
| `save_file` / `save_file_as` | 저장 |
| `take_pending_open_files` | 외부 열기 큐 소비 |
| `pick_image_path` | 이미지 선택 |
| `resolve_image_src` | 이미지 경로 → 표시 가능한 src |
| `copy_image_to_assets` | 원본 복사 |
| `import_image_bytes_to_assets` | 클립보드/드롭 바이트 저장 |
| `download_image_to_assets` | 원격 이미지 내려받기 |
| `pick_pdf_export_path` / `write_pdf_export` | PDF 저장 |
| `import_pdf` | 3.x에서 비활성 (2.x 안내 메시지 반환) |
| `load_session` / `save_session` / `load_workspace_session` | 세션 |
| `load_block_layouts` / `save_block_layout` / `save_block_layouts` | 레이아웃 |
| `open_new_window` / `set_window_min_size` / `start_window_drag` | 창 |
| `open_external_url` | 외부 링크 (http/https/mailto/tel/file 허용) |
| `log_frontend_event` | 프론트엔드 로그를 stderr로 |

---

## 4. 편집기

`<textarea>` 기반 편집기입니다 (`src/components/editor/EditorPane.tsx`).

### 4.1 구성

- 좌측 줄번호 거터 — `useLineNumberSync`가 래핑된 줄의 실제 높이를 측정해
  줄번호 칸 높이를 개별 지정
- 현재 줄 강조, 선택 영역에 해당하는 줄번호 강조
- `document.selectionchange` + `blur`로 선택 상태 추적
- 상태바에 커서 행·열, 파일 형식, 인코딩·EOL 표시
- `spellCheck={false}`, `wrap="soft"` 고정

### 4.2 텍스트 편집 유틸 (`src/core/editor/textEditing.ts`)

- `insertTextAtSelection` — `document.execCommand('insertText')`를 먼저 시도해
  **네이티브 undo 스택을 보존**하고, 실패 시 값 직접 설정으로 폴백
- `indentSelectedLines` — 4칸 들여쓰기/내어쓰기, 다중 줄 선택 지원,
  선택 범위를 정확히 재계산
- `insertHardLineBreak` — 공백 2칸 + 개행
- `replaceTextRange` — 선택 위치 보정 포함 범위 치환
- `setTextareaValue` — React 제어 컴포넌트에서도 동작하도록
  프로토타입 value setter를 직접 호출

### 4.3 편집기 단축키

| 키 | 동작 |
| --- | --- |
| `Tab` | 들여쓰기 |
| `Shift+Tab` | 내어쓰기 |
| `Cmd/Ctrl+]` | 들여쓰기 |
| `Cmd/Ctrl+[` | 내어쓰기 |
| `Shift+Enter` | 하드 라인브레이크 |

### 4.4 헬퍼 모달

툴바에서 여는 검색형 삽입 모달입니다 (`EditorHelperModal.tsx`).
검색 → 미리보기 → 삽입 흐름이 세 카탈로그 모두 동일합니다.

| 카탈로그 | 항목 수 | 내용 |
| --- | :-: | --- |
| Markdown | 21 | 제목·목록·표·인용·링크·이미지·문단 도구 |
| KaTeX | 19 | 수식 기호·구조 |
| Mermaid | 10 | 다이어그램 유형별 스켈레톤 |

Markdown 카탈로그의 이미지 항목에서는 원본 경로 링크 삽입과
`.assets` 복사 삽입을 바로 실행할 수 있습니다.

---

## 5. 미리보기 파이프라인

### 5.1 렌더 흐름

```
파일 내용
  → fileType 판정 (previewKind)
  → PreviewContribution 중 match() 통과 + priority 최대 선택
  → render() → PreviewResult { kind: 'html' | 'react', scene? }
  → DOM 마운트
  → 모든 afterRender() 실행 (AbortSignal 전달)
  → cleanup()은 언마운트 시
```

우선순위: `mermaid.preview-enhancement`(40) < `markdown.preview`(50) <
`html-preview.preview`(60). Mermaid는 렌더러가 아니라 `afterRender` 단계의
**후처리 기여**입니다.

### 5.2 렌더 씬 모델

`PreviewRenderScene`이 프리뷰를 박스 목록으로 추상화합니다
(`src/core/preview/`). 블록 종류별 렌더 오브젝트가 있습니다 —
`TextBox`, `ImageRenderBlock`, `TableRenderBlock`, `KatexRenderBlock`,
`MarkdownRenderBlock`.

### 5.3 서피스 정책

플랫폼마다 `PreviewSurfaceAdapter`를 제공합니다
(`src/core/preview/surfacePolicy.ts`).

- **렌더 예산** — `maxMountedBoxes`, `maxInteractiveBoxes`, `overscanPx`,
  `debounceMs`
- **포인터 정책** — `resizeHandlePx`, `dragActivationPx`,
  `longPressArrangeMs`, `commitBoundsOnPointerUp`
- **상호작용 모드** — `view` / `arrange`

서피스 종류는 현재 `dom-backed-canvas` 하나입니다.

### 5.4 스크롤 동기화

`useScrollSync`가 편집기와 프리뷰를 양방향 동기화합니다.

- Markdown 렌더러가 블록마다 `data-source-line` / `data-source-end-line`을
  붙여 **원본 줄 기준**으로 앵커를 잡음
- `measureEditorLineMetrics`로 래핑 포함 줄 높이를 실측
- 프로그래매틱 스크롤 보호창 120ms
- 입력 직후 렌더 반영 대기창 700ms
- 하단 48px 이내면 "바닥 고정" 유지
- 입력 자동 스크롤 임계 160px
- 분할 뷰 + `syncScroll` 켜짐일 때만 활성

---

## 6. Markdown

### 6.1 markdown-it 설정

```js
{ html: false, linkify: true, typographer: true, breaks: false }
```

`html: false`이므로 원본의 raw HTML은 렌더되지 않습니다.
기본 `code` 규칙(들여쓰기 코드블록)은 비활성화되어 fenced code block만 인식합니다.

### 6.2 커스텀 규칙

| 규칙 | 역할 |
| --- | --- |
| `saekim_safe_br_tag` | `<br>` 태그만 안전하게 허용 |
| `saekim_mark` | `==하이라이트==` → `<mark>` |
| `saekim_source_lines` | 블록마다 원본 줄 번호 속성 부여 |
| `saekim_task_lists` | `- [ ]` / `- [x]` 체크박스 |
| `saekim_typographic_arrows` | `->` `<-` `^|` `v|` → 방향 화살표 |

각주(footnote) 정의·참조 처리도 렌더러에 포함되어 있습니다.

### 6.3 코드 하이라이팅

Shiki를 **동적 import로 지연 로딩**하고 `codeToHtml`로 렌더합니다.
언어 라벨과 원본 줄 앵커가 붙고, 복사 버튼과 선택 영역 보정
(`codeBlockCopyEnhancement.ts`, `codeBlockSelectionEnhancement.ts`)이 적용됩니다.
테마는 앱 테마(`default`/`dark`/`nord`)를 light/dark로 매핑합니다.

일반 텍스트 코드블록의 ASCII 박스·흐름도는 선 연결 문자로 다듬어 렌더합니다.

### 6.4 Mermaid

- fence renderer가 `mermaid` 언어를 `<div class="mermaid-block">`로 변환
  (원본은 `data-source`에 URI 인코딩 보관)
- `afterRender`에서 mermaid를 동적 import 후 `securityLevel: 'strict'`로 렌더
- 테마 연동, `AbortSignal`로 렌더 중 취소 지원
- 실패 시 `data-rendered="false"` 표시

### 6.5 KaTeX

- `markdown-it-katex` 플러그인 + 커스텀 블록 분할기
- 옵션: `throwOnError: false`, `errorColor: '#cc3344'`, `strict: false`
- 매크로: `\implies` → `\Rightarrow`, `\impliedby` → `\Leftarrow`
- 블록 수식은 개별 수식으로 쪼개 각각 안정 키를 부여 → 블록 레이아웃 적용 가능
- 수식 전용 컨트롤(`math-equation-tools`) 제공

---

## 7. 확장 프리뷰

### 7.1 HTML 프리뷰

두 가지 모드를 세그먼트 컨트롤로 전환합니다.

**브라우저 모드** — `srcDoc` + `sandbox="allow-same-origin"` iframe.
아래 태그를 제거합니다.

```
base button embed form frame frameset iframe input
noscript object option script select textarea template
```

**안전 모드** — 기존 프리뷰 DOM 안에 렌더. 약 60개 태그의 **허용 목록** 방식이며,
허용 목록 밖 태그는 자식만 남기고 언랩합니다. 속성도 허용 목록으로 제한합니다.

| 그룹 | 허용 속성 |
| --- | --- |
| 전역 | `aria-label` `aria-labelledby` `aria-describedby` `class` `dir` `id` `lang` `role` `title` |
| 표 | `align` `colspan` `rowspan` `scope` |
| 이미지 | `alt` `decoding` `height` `loading` `src` `width` |
| 링크 | `href` `rel` `target` |

`on*` 이벤트 속성, `srcdoc`, `integrity`는 두 모드 모두에서 제거됩니다.

### 7.2 구조화 데이터 프리뷰

| 형식 | 파서 | 표현 |
| --- | --- | --- |
| JSON | `JSON.parse` | 접기/펼치기 트리 |
| YAML | `yaml` | 접기/펼치기 트리 |
| TOML | `smol-toml` | 접기/펼치기 트리 |
| CSV | `papaparse` | 표 (최대 1000행) |
| TSV | `papaparse` | 표 (최대 1000행) |

- OpenAPI v3 문서를 자동 감지해 API 문서 형태로 렌더
- 파싱 실패 시 에러 메시지와 원본 보기로 폴백
- CSV 인용부호 오류는 별도 실패로 처리

---

## 8. 블록 레이아웃

프리뷰에서 블록의 크기·정렬·열 배치를 직접 조정하고 SQLite에 저장하는 기능입니다.
Saekim의 가장 큰 차별 기능입니다.

### 8.1 데이터 모델 (`src/types/metadata.ts`)

```ts
interface BlockLayout {
  filePath: string;
  blockKind: 'text'|'image'|'table'|'list'|'blockquote'|'code'|'mermaid'|'katex';
  blockKey: string;
  occurrenceIndex: number;
  boxId, boxKind, flow;              // 'document-flow' | 'freeform'
  xValue, yValue;
  widthValue, widthUnit;             // 'px' | '%' | 'auto'
  heightValue, heightUnit;
  align;                             // 'left' | 'center' | 'right'
  zIndex, sourceLine, sourceEndLine;
  contentHash, identityHash;
  layoutJson;
}
```

### 8.2 블록 식별

문서를 편집해도 레이아웃이 유지되도록 다층 식별자를 씁니다.

- `blockKey` + `occurrenceIndex` — 같은 내용 블록의 n번째
- `legacyBlockKey` / `legacyOccurrenceIndex` — 구버전 키 마이그레이션
- `contentHash` / `identityHash` — 내용 기반 대조
- `sourceLine` / `sourceEndLine` — 원본 줄 범위

### 8.3 상호작용

`arrange` 모드에서만 활성화됩니다.

- **드래그 핸들** — 오른쪽 끝으로 끌면 2열 그룹 생성, 그룹에서 끌어내면 1열 복귀
- **드롭 프리뷰** — 놓일 위치를 실시간 표시 (`layoutDropPreview.ts`)
- **이미지 리사이즈 핸들** — 이미지 블록 크기 직접 조절
- **선택 상태** — 블록 클릭으로 선택, 그룹 단위 조작
- **2열 / 3열 그룹** — `groupColumns`, `groupIndex`, 수동 그룹(`groupMode: manual`)

`view` 모드로 돌아가면 모든 상호작용 크롬(`preview-layout-tools`,
드롭존, 리사이즈 핸들, 수식 도구)이 DOM에서 제거됩니다.

### 8.4 저장

- `load_block_layouts` / `save_block_layout` / `save_block_layouts`
- 파일 경로 기준으로 SQLite에 보관
- `metadata` 기능(= `metadata.sqlite` capability)이 없으면 블록 레이아웃 기능
  자체가 비활성화됨

---

## 9. 이미지 에셋

문서 옆 `.assets/` 폴더에 이미지를 모으는 워크플로입니다.

### 9.1 삽입 경로

| 경로 | 동작 |
| --- | --- |
| 파일 선택 → 링크 | 원본 절대 경로를 그대로 참조 |
| 파일 선택 → 복사 | `.assets/`로 복사 후 상대 경로 삽입 |
| 클립보드 붙여넣기 | 스크린샷 등 이미지 바이트를 `.assets/`에 저장 |
| 파일 드롭 | 로컬 이미지 파일을 `.assets/`로 복사 |
| URL 드롭 | 원격 이미지를 내려받아 `.assets/`에 저장 |

`복사` 모드는 현재 문서가 저장된 상태여야 동작하고, 아니면 안내 후 중단합니다.

### 9.2 제한과 보호

- 드롭 이미지 최대 20MB (`MAX_DROPPED_IMAGE_BYTES`)
- 원격 다운로드 SSRF 차단
  - `localhost` 및 `*.localhost` 거부
  - IPv4 loopback / private / link-local / broadcast / unspecified 거부
  - IPv6 loopback / unspecified / ULA(`fc00::/7`) / link-local(`fe80::/10`) 거부
  - 리다이렉트 정책 적용, `Content-Length` / `Content-Type` 확인
- 다운로드 진행률을 `image-download-progress` 이벤트로 스트리밍
- **원자적 쓰기** — 임시 파일에 쓴 뒤 `fs::rename`으로 교체, 실패 시 임시 파일 정리

### 9.3 에셋 프로토콜 스코프

`tauri.conf.json`이 허용하는 경로입니다.

```
$HOME/** $PICTURE/** $DESKTOP/** $DOCUMENT/** $DOWNLOAD/**
(각각 /.assets/** 포함)
```

---

## 10. 검색

- `Cmd/Ctrl+F`로 파일 내 찾기 바 열기
- 전체 일치 개수 표시, 이전/다음 순환 이동
- 일치 항목을 편집기에서 선택 상태로 표시
- 명령 ID `search.openFind`, Edit 메뉴에 `Find`로 등록

> 바꾸기, 정규식, 대소문자 구분, 워크스페이스 전체 검색은 아직 없습니다.

---

## 11. PDF 내보내기

프리뷰 DOM을 html2canvas로 래스터화한 뒤 jsPDF로 A4 문서를 만듭니다.

### 11.1 페이지 구성

- A4 기준 794px 폭 / 595.28pt x 841.89pt
- 페이지 경계에서 잘리면 안 되는 요소를 회피 대상으로 지정
  (제목, 문단, 목록, 표, 이미지, `pre`, 인용, `.shiki`, `.preview-layout-block`,
  `.preview-layout-group`, `.mermaid-block`, `.math-block`, `.katex-display`)
- 제목은 다음 블록과 붙여 유지 (`PAGE_BREAK_HEADING_KEEP_WITH_NEXT_PX = 220`)
- 최대 유지 비율 72%를 넘으면 분리 허용
- 분할점 역추적 140px, 반복 한도 3회
- 페이지 하단 여백의 흰 영역을 자동으로 잘라냄
  (휘도 임계 235, 잉크 비율 0.012 이하를 "빈 줄"로 판정)

### 11.2 호환 처리

html2canvas가 지원하지 않는 최신 CSS 색 함수(`color()`, `color-mix()`,
`lab()`, `lch()`, `oklab()`, `oklch()`)를 감지해 안전한 색으로 치환합니다.
이미지 인라인화 타임아웃은 5초입니다.

### 11.3 상태

`usePdfExportStore`가 `idle` / `exporting` / `done` / `error`를 관리하고
상태바에 표시합니다. 완료 3초, 실패 4초 뒤 자동 복귀.

### 11.4 저장

`pick_pdf_export_path`로 경로를 받고 `write_pdf_export`가 base64를 디코딩해
파일로 씁니다. 각 단계가 stderr에 로그를 남깁니다.

---

## 12. 세션과 메타데이터

### 12.1 저장 위치

```
{config_dir}/Saekim/metadata.sqlite3
```

- macOS: `~/Library/Application Support/Saekim/`
- Windows: `%APPDATA%/Saekim/`
- Linux: `~/.config/Saekim/`
- Android: Tauri `app_config_dir()`

### 12.2 스키마 (버전 2)

| 테이블 | 내용 |
| --- | --- |
| `metadata_kv` | 레거시 키-값 (마이그레이션 경로) |
| `workspaces` | 워크스페이스 루트 |
| `workspace_views` | 워크스페이스 내 뷰(하위 루트) + 트리 JSON |
| `workspace_windows` | 창별 활성 워크스페이스·뷰·파일, UI/설정 JSON |
| `files` | 파일 레코드 + `last_content_hash` + 최근 열람 시각 |
| `file_view_state` | 레거시 열린 파일 상태 |
| `window_file_view_state` | 창별 열린 파일 상태 (`state_json`, 순서, 활성 여부) |

`PRAGMA foreign_keys = ON`. 창별로 세션이 분리되어 창마다 다른 워크스페이스를
띄울 수 있습니다.

### 12.3 저장되는 내용

| 범주 | 항목 |
| --- | --- |
| 워크스페이스 | 루트 경로, 트리, 열린 파일 목록, 활성 파일 |
| 최근 항목 | 최근 워크스페이스 (id, 경로, 이름, 열람 시각, 창 id) |
| UI | 사이드바 모드·폭, 뷰 모드, 분할 비율, 편집기 폭, 스크롤 동기화 |
| 설정 | 테마, 글자 크기, 글꼴, HTML 프리뷰 모드 |

400ms 디바운스로 저장합니다.

### 12.4 레거시 마이그레이션

- `localStorage`의 `saekim-ui` / `saekim-settings`를 읽어 최초 1회 이관 후 삭제
- SQLite 안에서도 `metadata_kv` → `workspace_windows` 경로로 폴백 지원
- 세션 버전 1 / 2 동시 처리

---

## 13. 셸 UI

### 13.1 레이아웃

```
Header (타이틀바 / 메뉴 / 뷰 모드 / 설정)
Sidebar | 리사이저 | EditorPane | 리사이저 | PreviewPane
StatusBar
```

CSS 변수로 폭을 제어합니다 — `--sidebar-w`, `--sidebar-current-w`,
`--editor-fr`, `--preview-fr`, `--editor-w`.

### 13.2 뷰 모드

`edit` / `split` / `preview` 세 가지. 리사이저를 끝까지 끌면 모드가 전환됩니다.

### 13.3 반응형 프로필

| 프로필 | 폭 | 사용 가능 뷰 모드 |
| --- | --- | --- |
| `compact` | ~599px | `edit`, `preview` |
| `medium` | 600~839px | 전체 |
| `expanded` | 840px~ | 전체 |

`compact`에서는 분할 뷰와 사이드바 리사이저가 비활성화되고,
`split` 상태였다면 `edit`으로 자동 강등됩니다.
`window.visualViewport`를 우선 사용해 모바일 키보드에도 대응합니다.

### 13.4 크기 제약

| 항목 | 값 |
| --- | --- |
| 창 기본 | 1280 x 820 |
| 창 최소 | 622 x 640 |
| 사이드바 | 180 ~ 420px (기본 248, 접힘 56) |
| 편집기 폭 | 240 ~ 1600px |
| 분할 비율 | 0.25 ~ 0.75 |

`useWindowSizeConstraints`가 현재 레이아웃에 맞춰
`set_window_min_size`로 OS 창 최소 크기를 동적으로 갱신합니다.

### 13.5 테마와 글꼴

| 테마 | 파일 |
| --- | --- |
| `default` | `styles/themes/default.css` |
| `dark` | `styles/themes/dark.css` |
| `nord` | `styles/themes/nord.css` |

글자 크기 3단계 — 작게 12px / 중간 13.5px / 크게 16px.
글꼴 8종 — Pretendard Variable, Pretendard, IBM Plex Sans KR, JetBrains Mono,
SFMono-Regular, Menlo, Monaco, ui-monospace.

테마 변경 시 `--bg-surface` 값을 읽어 네이티브 타이틀바 색을 동기화합니다.

### 13.6 macOS 네이티브 메뉴

| 메뉴 | 항목 |
| --- | --- |
| Saekim | About, Services, Hide, Hide Others, Quit |
| File | New File, New Window, Open File, Open Folder, Open Recent Workspace, Save, Save As, Export PDF, Close Window |
| Edit | Undo, Redo, Cut, Copy, Paste, Select All |
| View | Enter Full Screen |
| Window | Minimize, Maximize, Close Window |
| Help | *(비어 있음)* |

최근 워크스페이스가 바뀌면 `refresh_menu`가 메뉴를 다시 만듭니다.

Windows/Linux는 `SidebarMenu` / `Header`가 그리는 인앱 메뉴를 사용합니다
(`appMenus.ts`가 File / Edit / View / Window / Help를 공통 정의).

### 13.7 전역 단축키

| 단축키 | 동작 |
| --- | --- |
| `Cmd/Ctrl+N` | 새 파일 |
| `Cmd/Ctrl+Shift+N` | 새 창 |
| `Cmd/Ctrl+O` | 파일 열기 |
| `Cmd/Ctrl+Shift+O` | 폴더 열기 |
| `Cmd/Ctrl+S` | 저장 |
| `Cmd/Ctrl+Shift+S` | 다른 이름으로 저장 |
| `Cmd/Ctrl+F` | 찾기 |
| `Cmd/Ctrl+P` | PDF 내보내기 |

### 13.8 상태바

파일 형식, 커서 행·열, 인코딩·EOL, PDF 내보내기 상태, 읽기 시간
(`core/format/readingTime.ts`), 상대 시각(`relativeTime.ts`).

---

## 14. 창 관리

- **멀티 윈도우** — `open_new_window`가 기본 창 설정을 복제해
  `window{timestamp}` 라벨로 새 창 생성
- **활성 창 추적** — `AppState.active_window_label`이 포커스된 창을 기억하고,
  메뉴 이벤트와 외부 파일 열기를 그 창으로 보냄
- **커스텀 타이틀바** — `titleBarStyle: "Overlay"`, `hiddenTitle: true`,
  트래픽 라이트 위치 (13, 19). `start_window_drag`로 드래그 영역 구현
- **단일 인스턴스** — macOS / Windows / Linux에서
  두 번째 실행을 기존 창으로 전달하고 unminimize → show → focus

---

## 15. Android 지원 (실험적)

- Kotlin 플러그인 2종
  - `AndroidDocumentMetadataPlugin` — SAF 기반 폴더/문서 접근, 표시 이름 조회
  - 이미지 피커 플러그인
- `content://` URI를 1급 경로로 처리 (읽기·쓰기·표시 경로 변환)
- `tauri-plugin-fs`를 통한 SAF 쓰기
- 미지원: PDF 내보내기, 네이티브 메뉴, 커스텀 창 크롬
- 빌드: `pnpm tauri:build:android`, `tauri:build:android:arm64`

---

## 16. 빌드와 패키징

### 16.1 스크립트

| 명령 | 대상 |
| --- | --- |
| `pnpm tauri:dev` | 개발 실행 |
| `pnpm build` | 프론트엔드 빌드 (`tsc && vite build`) |
| `pnpm tauri:build:macos` | macOS `.app` + `.dmg` |
| `pnpm tauri:build:windows` | Windows (NSIS) |
| `pnpm tauri:build:android` | Android APK |
| `pnpm lint` | ESLint 10 + typescript-eslint |

### 16.2 설정 분기

| 파일 | 역할 |
| --- | --- |
| `tauri.conf.json` | 공통 |
| `tauri.macos.conf.json` | dev 포트 1421 |
| `tauri.windows.conf.json` | `.md` 연결 + NSIS `text-file-association.nsh` 훅 |

### 16.3 파일 연결

- 공통: `.md` `.markdown` `.mdown` `.mkd` (UTI `net.daringfireball.markdown`),
  `.txt` (`public.plain-text`) — 둘 다 `role: Editor`
- Windows: `.txt`는 앱 아이콘 대신 시스템 텍스트 아이콘을 쓰는
  별도 Open With ProgID로 등록

### 16.4 Rust 의존성

`base64` `dirs` `futures-util` `reqwest` `rusqlite`(bundled) `serde`
`serde_json` `tauri`(protocol-asset) `tauri-plugin-dialog`
`tauri-plugin-fs` `tauri-plugin-opener` `url`
+ 데스크톱 `tauri-plugin-single-instance`, macOS `objc2`

---

## 17. 테스트 현황

| 영역 | 상태 |
| --- | --- |
| Rust 단위 테스트 | 있음 — 파일 인자 파싱, 텍스트 판정, BOM 디코딩, 레이아웃 메타데이터 |
| 프론트엔드 테스트 | 없음 |
| E2E | 없음 |
| CI | 없음 (`.github/` 부재) |
| 수동 테스트 문서 | `docs/3.0.0-scroll-sync-manual-test.md` |
