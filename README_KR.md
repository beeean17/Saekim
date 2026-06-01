# 새김 Saekim

![Version](https://img.shields.io/badge/version-3.1.0-555555.svg)
![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.5.0-24C8DB.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6.svg)
![Rust](https://img.shields.io/badge/Rust-stable-B7410E.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)

새김은 Markdown과 텍스트 기반 문서를 위한 로컬 우선 데스크톱 에디터입니다.
Tauri 2, React, TypeScript, Rust 기반으로 동작하며, 편집기와 미리보기를
나란히 두고 문서를 작성하는 흐름에 초점을 맞춥니다.

[English README](README.md)

---

## 주요 기능

- 편집, 미리보기, 분할 보기 모드를 갖춘 Markdown 에디터
- 표, 이미지, 인용문, 체크리스트, 코드블럭, Mermaid 다이어그램, KaTeX
  수식을 렌더링하는 실시간 Markdown 미리보기
- 언어가 명시된 코드블럭의 Shiki 기반 문법 하이라이트
- 편집기와 미리보기 사이의 스크롤 동기화
- Tauri 기반 네이티브 파일/폴더 열기, 저장, 다른 이름 저장, 드래그 앤 드롭,
  OS 기본 앱 파일 열기 처리
- macOS와 Windows 패키징에서 Markdown/text 기본 앱 연결 지원
- 렌더링된 미리보기 기준 PDF 내보내기
- 문서 옆 `.assets/` 이미지 워크플로우:
  - 원본 경로로 이미지 연결
  - 현재 문서 옆 `.assets/` 폴더로 이미지 복사 후 상대 경로 삽입
  - 클립보드 스크린샷을 `.assets/`에 저장하고 Markdown 이미지 문법 자동 삽입
  - 워크스페이스 트리에서 `.assets` 이미지 표시
- HTML 파일의 브라우저 방식/안전 방식 미리보기
- JSON, YAML, TOML, CSV, TSV, OpenAPI 문서의 구조화 미리보기
- 이미지, 표, 리스트, 코드, Mermaid, KaTeX 블럭의 크기/정렬/2열/3열
  그룹 metadata 저장
- OS Application Support 경로에 저장되는 SQLite 기반 metadata/session 저장소

---

## 지원 파일

새김은 알려진 텍스트 파일 형식을 직접 열 수 있고, 알려지지 않은 확장자라도
UTF-8 텍스트로 판정되면 일반 텍스트 모드로 열 수 있습니다.

| 파일 형식 | 편집 | 미리보기 |
| --- | --- | --- |
| `.md`, `.markdown`, `.mdown`, `.mkd` | Markdown | 렌더링된 Markdown |
| `.txt`, `.log`, `.env` | 일반 텍스트 | 일반 텍스트 |
| `.html`, `.htm` | HTML | 브라우저 방식 iframe 또는 안전 렌더링 |
| `.json` | JSON | Tree/API/Raw 미리보기 |
| `.yml`, `.yaml` | YAML | Tree/API/Raw 미리보기 |
| `.toml` | TOML | Tree/Raw 미리보기 |
| `.csv`, `.tsv` | 구분자 텍스트 | Table/Raw 미리보기 |

---

## 요구사항

- Node.js와 Corepack
- Corepack으로 관리되는 pnpm 9.15.4
- Rust stable toolchain
- OS별 Tauri 2 개발/빌드 필수 구성 요소

macOS와 Windows 데스크톱 번들을 만들려면 Tauri의 플랫폼별 설정 안내에 따라
컴파일러, SDK, 네이티브 의존성을 준비해야 합니다.

---

## 개발 실행

의존성 설치:

```bash
corepack enable
corepack pnpm install
```

Tauri 앱 개발 실행:

```bash
corepack pnpm tauri:dev
```

npm entrypoint를 사용할 수도 있습니다:

```bash
npm run tauri dev
```

프론트엔드 빌드:

```bash
corepack pnpm build
```

데스크톱 번들 빌드:

```bash
corepack pnpm tauri:build
```

macOS app 전용 빌드와 DMG 빌드:

```bash
corepack pnpm tauri:build:app
corepack pnpm tauri:build:dmg
```

---

## 릴리즈 배포

새김은 GitHub Releases를 통해 macOS와 Windows용 배포 파일을 따로 올리는
방식으로 배포합니다.

권장 릴리즈 흐름:

1. `package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`의 버전을
   릴리즈 버전에 맞게 정리합니다.
2. 대상 OS별로 앱을 빌드하고 실행 검증합니다.
3. `v3.1.0` 같은 Git tag를 생성합니다.
4. 생성된 데스크톱 번들을 GitHub Release에 업로드합니다.

macOS 배포 파일은 macOS에서 빌드합니다:

```bash
corepack pnpm tauri:build:app
corepack pnpm tauri:build:dmg
```

Windows 배포 파일은 Windows 환경에서 빌드하는 것을 기준으로 합니다:

```bash
corepack pnpm tauri:build
```

일반적인 릴리즈 산출물:

| OS | 산출물 |
| --- | --- |
| macOS | `.app` bundle, `.dmg` installer |
| Windows | Tauri가 생성하는 `.msi` 또는 `.exe` installer |

macOS 앱을 개발 머신 밖에 공개 배포하려면 Release에 올리기 전에 code signing과
notarization을 처리해야 합니다.

---

## 프로젝트 구조

```text
.
├── src/                  # React 프론트엔드 소스
├── src-tauri/            # Tauri/Rust 데스크톱 백엔드
├── public/fonts/         # Vite가 제공하는 번들 웹폰트
├── Licenses/             # 프로젝트 라이선스와 서드파티 고지
├── _bmad-output/         # 기획/구현 산출물
├── private/              # private 기획/아카이브 submodule, legacy source 포함
├── package.json
├── pnpm-lock.yaml
└── vite.config.ts
```

현재 3.x 앱의 실제 실행 경로는 React/Tauri 코드입니다. PyQt/Python legacy
파일은 마이그레이션 이력과 legacy 기능 참고를 위해
`private/legacy/pyqt-src/`에 보관되어 있습니다.

---

## 라이선스

새김은 GNU Affero General Public License v3.0(AGPL-3.0)으로 배포됩니다.
자세한 내용은 [Licenses/LICENSE](Licenses/LICENSE)를 확인하세요.

서드파티 의존성 고지는 [Licenses/LICENSES.md](Licenses/LICENSES.md)에 정리되어
있습니다. 현재 3.x 앱은 주로 MIT, Apache-2.0, BSD-3-Clause, ISC, OFL-1.1,
public-domain 구성 요소를 사용합니다. 다만 legacy Python/PDF import 코드가
AGPL-3.0 라이선스의 PyMuPDF를 참조하므로 프로젝트 라이선스는 AGPL-3.0을
유지합니다.

---

## 참고

- 설정, 세션, 최근 파일, metadata는 OS Application Support 경로에 저장됩니다.
- 문서와 함께 관리되는 이미지는 현재 문서 옆 `.assets/` 폴더에 저장됩니다.
- 전체 변경 내역은 [CHANGELOG.md](CHANGELOG.md)를 확인하세요.
