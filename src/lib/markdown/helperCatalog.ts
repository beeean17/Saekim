export type KatexHelperItem = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  syntax: string;
  example: string;
  displayMode?: boolean;
};

export type MermaidHelperItem = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  template: string;
};

export const katexHelperItems: KatexHelperItem[] = [
  {
    id: 'fraction',
    title: '분수',
    category: '기본',
    keywords: ['분수', 'fraction', 'frac', '나누기'],
    syntax: '\\frac{분자}{분모}',
    example: '\\frac{a+b}{c+d}',
  },
  {
    id: 'power',
    title: '거듭제곱',
    category: '기본',
    keywords: ['제곱', '위첨자', 'power', 'superscript'],
    syntax: 'x^{n}',
    example: 'x^{2}+y^{2}=z^{2}',
  },
  {
    id: 'subscript',
    title: '아래첨자',
    category: '기본',
    keywords: ['아래첨자', 'subscript', 'index'],
    syntax: 'x_{n}',
    example: 'a_{n}=a_{1}+(n-1)d',
  },
  {
    id: 'sqrt',
    title: '제곱근',
    category: '기본',
    keywords: ['루트', '제곱근', 'sqrt', 'root'],
    syntax: '\\sqrt{x}',
    example: '\\sqrt{x^{2}+y^{2}}',
  },
  {
    id: 'times',
    title: '곱하기',
    category: '연산자',
    keywords: ['곱하기', '곱셈', 'times', 'multiply', 'multiplication', '곱'],
    syntax: '\\times',
    example: 'a \\times b',
  },
  {
    id: 'divide',
    title: '나누기',
    category: '연산자',
    keywords: ['나누기', '나눗셈', 'divide', 'division', 'div'],
    syntax: '\\div',
    example: 'a \\div b',
  },
  {
    id: 'plus-minus',
    title: '플러스 마이너스',
    category: '연산자',
    keywords: ['플러스마이너스', 'plus minus', 'pm', '오차'],
    syntax: '\\pm',
    example: 'x = -b \\pm \\sqrt{D}',
  },
  {
    id: 'sum',
    title: '합',
    category: '대형 연산자',
    keywords: ['합', '시그마', 'sum', 'sigma', 'summation'],
    syntax: '\\sum_{i=1}^{n}',
    example: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
    displayMode: true,
  },
  {
    id: 'integral',
    title: '적분',
    category: '미적분',
    keywords: ['적분', 'integral', 'int'],
    syntax: '\\int_{a}^{b}',
    example: '\\int_{0}^{1} x^2\\,dx = \\frac{1}{3}',
    displayMode: true,
  },
  {
    id: 'limit',
    title: '극한',
    category: '미적분',
    keywords: ['극한', '리미트', 'limit', 'lim'],
    syntax: '\\lim_{x \\to a}',
    example: '\\lim_{x \\to 0}\\frac{\\sin x}{x}=1',
    displayMode: true,
  },
  {
    id: 'alpha',
    title: '알파',
    category: '그리스 문자',
    keywords: ['알파', 'alpha', 'greek'],
    syntax: '\\alpha',
    example: '\\alpha + \\beta = \\gamma',
  },
  {
    id: 'theta',
    title: '세타',
    category: '그리스 문자',
    keywords: ['세타', 'theta', 'angle', '각도'],
    syntax: '\\theta',
    example: '\\sin \\theta',
  },
  {
    id: 'pi',
    title: '파이',
    category: '그리스 문자',
    keywords: ['파이', 'pi', '원주율'],
    syntax: '\\pi',
    example: 'A=\\pi r^2',
  },
  {
    id: 'matrix',
    title: '행렬',
    category: '행렬',
    keywords: ['행렬', 'matrix', 'pmatrix'],
    syntax: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    example: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}',
    displayMode: true,
  },
  {
    id: 'cases',
    title: '경우 나누기',
    category: '구조',
    keywords: ['케이스', '경우', 'cases', 'piecewise'],
    syntax: '\\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}',
    example: '|x| = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}',
    displayMode: true,
  },
  {
    id: 'arrow-right',
    title: '오른쪽 화살표',
    category: '화살표',
    keywords: ['화살표', '오른쪽', 'arrow', 'rightarrow'],
    syntax: '\\rightarrow',
    example: 'A \\rightarrow B',
  },
  {
    id: 'implies',
    title: '따라서/함의',
    category: '논리',
    keywords: ['따라서', '함의', 'implies', 'right arrow', '논리'],
    syntax: '\\Rightarrow',
    example: 'x>0 \\Rightarrow x^2>0',
  },
  {
    id: 'real',
    title: '실수 집합',
    category: '집합',
    keywords: ['실수', 'real', 'set', 'mathbb'],
    syntax: '\\mathbb{R}',
    example: 'x \\in \\mathbb{R}',
  },
  {
    id: 'text',
    title: '수식 안 텍스트',
    category: '텍스트',
    keywords: ['텍스트', '문자', 'text', 'korean'],
    syntax: '\\text{문자}',
    example: 'x = 1 \\quad \\text{일 때}',
  },
];

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
