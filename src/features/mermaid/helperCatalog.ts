import type { MermaidHelperItem } from '../../core/editor/helperTypes';

export const mermaidHelperItems: MermaidHelperItem[] = [
  {
    id: 'flowchart-td',
    title: '기본 순서도',
    category: 'Flowchart',
    keywords: ['순서도', '흐름도', 'flowchart', 'flow', 'td', '위아래'],
    template: `flowchart TD
  A[시작] --> B{조건 확인}
  B -->|참| C[작업 1]
  B -->|거짓| D[작업 2]
  C --> E[종료]
  D --> E`,
  },
  {
    id: 'flowchart-lr',
    title: '좌우 순서도',
    category: 'Flowchart',
    keywords: ['좌우', '가로', 'flowchart', 'lr', 'horizontal'],
    template: `flowchart LR
  A[요청] --> B[처리]
  B --> C[응답]`,
  },
  {
    id: 'sequence-basic',
    title: '시퀀스 다이어그램',
    category: 'Sequence',
    keywords: ['시퀀스', 'sequence', '메시지', 'api'],
    template: `sequenceDiagram
  participant User as 사용자
  participant App as 앱
  User->>App: 요청
  App-->>User: 응답`,
  },
  {
    id: 'sequence-alt',
    title: '조건 분기 시퀀스',
    category: 'Sequence',
    keywords: ['조건', '분기', 'alt', 'else', 'sequence'],
    template: `sequenceDiagram
  사용자->>서버: 로그인
  alt 성공
    서버-->>사용자: 토큰 반환
  else 실패
    서버-->>사용자: 오류 반환
  end`,
  },
  {
    id: 'class-basic',
    title: '클래스 다이어그램',
    category: 'Class',
    keywords: ['클래스', 'class', '객체', 'oop'],
    template: `classDiagram
  class User {
    +String name
    +login()
  }
  class Project {
    +String title
  }
  User --> Project`,
  },
  {
    id: 'state-basic',
    title: '상태 다이어그램',
    category: 'State',
    keywords: ['상태', 'state', '상태머신'],
    template: `stateDiagram-v2
  [*] --> 대기
  대기 --> 실행
  실행 --> 완료
  완료 --> [*]`,
  },
  {
    id: 'er-basic',
    title: 'ER 다이어그램',
    category: 'ERD',
    keywords: ['erd', 'er', '데이터베이스', '관계', 'database'],
    template: `erDiagram
  USER ||--o{ ORDER : places
  USER {
    string id
    string name
  }
  ORDER {
    string id
    date createdAt
  }`,
  },
  {
    id: 'gantt-basic',
    title: '간트 차트',
    category: 'Gantt',
    keywords: ['간트', 'gantt', '일정', 'schedule'],
    template: `gantt
  title 프로젝트 일정
  dateFormat  YYYY-MM-DD
  section 개발
  설계 :a1, 2026-01-01, 5d
  구현 :after a1, 10d`,
  },
  {
    id: 'pie-basic',
    title: '파이 차트',
    category: 'Chart',
    keywords: ['파이', 'pie', 'chart', '차트', '비율'],
    template: `pie showData
  title 점유율
  "A" : 40
  "B" : 35
  "C" : 25`,
  },
  {
    id: 'timeline-basic',
    title: '타임라인',
    category: 'Timeline',
    keywords: ['타임라인', 'timeline', '연표', '시간'],
    template: `timeline
  title 출시 계획
  2026-01 : 기획
  2026-02 : 개발
  2026-03 : 배포`,
  },
];
