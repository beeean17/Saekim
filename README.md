# 새김 (Saekim) - 마크다운 에디터

> 코드와 다이어그램을 자유롭게 다루는 개발자를 위한 로컬 마크다운 에디터

## 프로젝트 개요

**새김**은 개발자와 학생들을 위한 강력한 로컬 마크다운 에디터입니다.
"새겨 쓰다"라는 순우리말에서 이름을 따왔으며, 정교하고 체계적인 문서 작성을 지원합니다.

## 빠른 시작

### 설치 요구사항

- Python 3.10 이상
- 4GB RAM 이상 권장
- Windows 10/11, macOS 10.15+, Linux

### 설치 방법

```bash
# 저장소 클론
git clone https://github.com/yourusername/saekim.git
cd saekim

# 가상환경 생성 및 활성화
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 애플리케이션 실행
python src/main.py
```

## 개발 현황

### Week 1: 프로젝트 기초 구축 ✅

- ✅ 프로젝트 저장소 생성
- ✅ 개발 환경 설정
- ✅ 기본 프로젝트 구조 생성
- ✅ PyQt6 기본 윈도우 생성
- 📝 QWebEngineView 통합 (다음 단계)

## 주요 기능

- ✅ 실시간 마크다운 미리보기
- ✅ 코드 하이라이팅 (Highlight.js)
- ✅ 다이어그램 렌더링 (Mermaid.js)
- ✅ 수학 수식 렌더링 (KaTeX)
- ✅ 파일 열기/저장
- ✅ 자동 저장
- ✅ 라이트/다크 테마
- ⏳ PDF/DOCX 변환 (개발 중)

## 라이선스

이 프로젝트는 **GNU General Public License v3.0 (GPL-3.0)** 하에 배포됩니다.

- **이유**: PyQt6가 GPL-3.0 라이선스를 사용하므로, 본 프로젝트도 GPL-3.0을 따라야 합니다.
- **오픈소스 기여**: 모든 사용 라이브러리와 라이선스 정보는 [LICENSES.md](Licenses/LICENSES.md)에서 확인할 수 있습니다.
- **상업적 사용**: 상업적/독점적 사용을 원할 경우 PyQt6 대신 PySide6 (LGPL-3.0) 사용을 고려하거나, Qt 상업 라이선스를 구매하세요.

자세한 내용은 [LICENSE](Licenses/LICENSE) 파일을 참고하세요.
