/**
 * KaTeX Helper Module
 * Provides searchable KaTeX syntax reference with Korean/English keywords
 */

const KatexHelperModule = {
    isOpen: false,
    dialog: null,
    searchInput: null,
    resultsContainer: null,
    suggestionsContainer: null,

    /**
     * KaTeX expressions database with Korean/English keywords
     * Each entry: { keywords: [], syntax: '', description: '', example: '' }
     */
    database: [
        // === Basic Operations ===
        {
            category: '기본 연산',
            keywords: ['분수', '나누기', 'fraction', 'divide', '나눗셈'],
            syntax: '\\frac{분자}{분모}',
            description: '분수 표현',
            example: '\\frac{1}{2}'
        },
        {
            category: '기본 연산',
            keywords: ['제곱', '거듭제곱', 'power', 'square', 'exponent', '지수'],
            syntax: 'x^{n}',
            description: '거듭제곱 (위 첨자)',
            example: 'x^{2}'
        },
        {
            category: '기본 연산',
            keywords: ['아래첨자', 'subscript', '하첨자', '인덱스', 'index'],
            syntax: 'x_{n}',
            description: '아래 첨자',
            example: 'a_{1}'
        },
        {
            category: '기본 연산',
            keywords: ['제곱근', '루트', 'sqrt', 'root', 'square root'],
            syntax: '\\sqrt{x}',
            description: '제곱근',
            example: '\\sqrt{2}'
        },
        {
            category: '기본 연산',
            keywords: ['n제곱근', 'n루트', 'nth root', '세제곱근', 'cube root'],
            syntax: '\\sqrt[n]{x}',
            description: 'n제곱근',
            example: '\\sqrt[3]{8}'
        },
        {
            category: '기본 연산',
            keywords: ['덧셈', '더하기', 'plus', 'add', 'addition'],
            syntax: '+',
            description: '덧셈',
            example: 'a + b'
        },
        {
            category: '기본 연산',
            keywords: ['뺄셈', '빼기', 'minus', 'subtract', 'subtraction'],
            syntax: '-',
            description: '뺄셈',
            example: 'a - b'
        },
        {
            category: '기본 연산',
            keywords: ['곱셈', '곱하기', 'times', 'multiply', 'multiplication', '곱'],
            syntax: '\\times',
            description: '곱셈 기호',
            example: 'a \\times b'
        },
        {
            category: '기본 연산',
            keywords: ['나눗셈기호', '나누기기호', 'divide symbol', 'division'],
            syntax: '\\div',
            description: '나눗셈 기호',
            example: 'a \\div b'
        },
        {
            category: '기본 연산',
            keywords: ['플러스마이너스', '더하기빼기', 'plus minus', 'pm'],
            syntax: '\\pm',
            description: '플러스/마이너스',
            example: 'x = \\pm 5'
        },

        // === Greek Letters ===
        {
            category: '그리스 문자',
            keywords: ['알파', 'alpha', '그리스'],
            syntax: '\\alpha',
            description: '알파 (소문자)',
            example: '\\alpha'
        },
        {
            category: '그리스 문자',
            keywords: ['베타', 'beta', '그리스'],
            syntax: '\\beta',
            description: '베타',
            example: '\\beta'
        },
        {
            category: '그리스 문자',
            keywords: ['감마', 'gamma', '그리스'],
            syntax: '\\gamma',
            description: '감마 (소문자)',
            example: '\\gamma'
        },
        {
            category: '그리스 문자',
            keywords: ['감마', 'gamma', '대문자', 'capital'],
            syntax: '\\Gamma',
            description: '감마 (대문자)',
            example: '\\Gamma'
        },
        {
            category: '그리스 문자',
            keywords: ['델타', 'delta', '그리스'],
            syntax: '\\delta',
            description: '델타 (소문자)',
            example: '\\delta'
        },
        {
            category: '그리스 문자',
            keywords: ['델타', 'delta', '대문자', 'capital'],
            syntax: '\\Delta',
            description: '델타 (대문자)',
            example: '\\Delta'
        },
        {
            category: '그리스 문자',
            keywords: ['엡실론', 'epsilon', '그리스'],
            syntax: '\\epsilon',
            description: '엡실론',
            example: '\\epsilon'
        },
        {
            category: '그리스 문자',
            keywords: ['제타', 'zeta', '그리스'],
            syntax: '\\zeta',
            description: '제타',
            example: '\\zeta'
        },
        {
            category: '그리스 문자',
            keywords: ['에타', 'eta', '그리스'],
            syntax: '\\eta',
            description: '에타',
            example: '\\eta'
        },
        {
            category: '그리스 문자',
            keywords: ['세타', 'theta', '그리스', '쎄타'],
            syntax: '\\theta',
            description: '세타 (소문자)',
            example: '\\theta'
        },
        {
            category: '그리스 문자',
            keywords: ['세타', 'theta', '대문자', 'capital'],
            syntax: '\\Theta',
            description: '세타 (대문자)',
            example: '\\Theta'
        },
        {
            category: '그리스 문자',
            keywords: ['람다', 'lambda', '그리스', '람다'],
            syntax: '\\lambda',
            description: '람다 (소문자)',
            example: '\\lambda'
        },
        {
            category: '그리스 문자',
            keywords: ['람다', 'lambda', '대문자', 'capital'],
            syntax: '\\Lambda',
            description: '람다 (대문자)',
            example: '\\Lambda'
        },
        {
            category: '그리스 문자',
            keywords: ['뮤', 'mu', '그리스'],
            syntax: '\\mu',
            description: '뮤',
            example: '\\mu'
        },
        {
            category: '그리스 문자',
            keywords: ['파이', 'pi', '그리스', '원주율'],
            syntax: '\\pi',
            description: '파이 (소문자)',
            example: '\\pi'
        },
        {
            category: '그리스 문자',
            keywords: ['파이', 'pi', '대문자', 'capital'],
            syntax: '\\Pi',
            description: '파이 (대문자) - 곱기호',
            example: '\\Pi'
        },
        {
            category: '그리스 문자',
            keywords: ['시그마', 'sigma', '그리스'],
            syntax: '\\sigma',
            description: '시그마 (소문자)',
            example: '\\sigma'
        },
        {
            category: '그리스 문자',
            keywords: ['시그마', 'sigma', '대문자', '합', 'sum'],
            syntax: '\\Sigma',
            description: '시그마 (대문자) - 합기호',
            example: '\\Sigma'
        },
        {
            category: '그리스 문자',
            keywords: ['타우', 'tau', '그리스'],
            syntax: '\\tau',
            description: '타우',
            example: '\\tau'
        },
        {
            category: '그리스 문자',
            keywords: ['파이', 'phi', '그리스', '피'],
            syntax: '\\phi',
            description: '파이 (소문자)',
            example: '\\phi'
        },
        {
            category: '그리스 문자',
            keywords: ['파이', 'phi', '대문자', 'capital'],
            syntax: '\\Phi',
            description: '파이 (대문자)',
            example: '\\Phi'
        },
        {
            category: '그리스 문자',
            keywords: ['오메가', 'omega', '그리스'],
            syntax: '\\omega',
            description: '오메가 (소문자)',
            example: '\\omega'
        },
        {
            category: '그리스 문자',
            keywords: ['오메가', 'omega', '대문자', 'capital'],
            syntax: '\\Omega',
            description: '오메가 (대문자)',
            example: '\\Omega'
        },

        // === Calculus ===
        {
            category: '미적분',
            keywords: ['적분', 'integral', '인테그랄', '부정적분'],
            syntax: '\\int',
            description: '적분 기호',
            example: '\\int f(x) dx'
        },
        {
            category: '미적분',
            keywords: ['정적분', 'definite integral', '적분', '범위'],
            syntax: '\\int_{a}^{b}',
            description: '정적분',
            example: '\\int_{0}^{1} x^2 dx'
        },
        {
            category: '미적분',
            keywords: ['이중적분', 'double integral', '중적분'],
            syntax: '\\iint',
            description: '이중 적분',
            example: '\\iint f(x,y) dA'
        },
        {
            category: '미적분',
            keywords: ['삼중적분', 'triple integral'],
            syntax: '\\iiint',
            description: '삼중 적분',
            example: '\\iiint f dV'
        },
        {
            category: '미적분',
            keywords: ['곡선적분', '경로적분', 'contour integral', 'oint'],
            syntax: '\\oint',
            description: '곡선 적분 (폐곡선)',
            example: '\\oint_C f ds'
        },
        {
            category: '미적분',
            keywords: ['미분', '도함수', 'derivative', '프라임'],
            syntax: "f'(x)",
            description: '도함수 (프라임 표기)',
            example: "f'(x)"
        },
        {
            category: '미적분',
            keywords: ['편미분', 'partial', 'partial derivative'],
            syntax: '\\partial',
            description: '편미분 기호',
            example: '\\frac{\\partial f}{\\partial x}'
        },
        {
            category: '미적분',
            keywords: ['미분', '디', 'd', 'differential'],
            syntax: '\\mathrm{d}',
            description: '미분 d (로만체)',
            example: '\\frac{\\mathrm{d}y}{\\mathrm{d}x}'
        },
        {
            category: '미적분',
            keywords: ['극한', 'limit', 'lim', '리밋'],
            syntax: '\\lim_{x \\to a}',
            description: '극한',
            example: '\\lim_{x \\to 0} \\frac{\\sin x}{x}'
        },
        {
            category: '미적분',
            keywords: ['무한대', 'infinity', '인피니티'],
            syntax: '\\infty',
            description: '무한대',
            example: '\\lim_{x \\to \\infty}'
        },
        {
            category: '미적분',
            keywords: ['나블라', 'nabla', '그래디언트', 'gradient', 'del'],
            syntax: '\\nabla',
            description: '나블라 (그래디언트)',
            example: '\\nabla f'
        },

        // === Summation and Product ===
        {
            category: '합과 곱',
            keywords: ['합', 'sum', '시그마', '총합', 'summation'],
            syntax: '\\sum_{i=1}^{n}',
            description: '합 (시그마)',
            example: '\\sum_{i=1}^{n} i^2'
        },
        {
            category: '합과 곱',
            keywords: ['곱', 'product', '파이', '곱기호', 'prod'],
            syntax: '\\prod_{i=1}^{n}',
            description: '곱 (파이)',
            example: '\\prod_{i=1}^{n} i'
        },

        // === Relations ===
        {
            category: '관계 기호',
            keywords: ['같다', 'equals', '등호', 'equal'],
            syntax: '=',
            description: '등호',
            example: 'a = b'
        },
        {
            category: '관계 기호',
            keywords: ['같지않다', 'not equal', '부등호', 'neq'],
            syntax: '\\neq',
            description: '같지 않음',
            example: 'a \\neq b'
        },
        {
            category: '관계 기호',
            keywords: ['근사', '약', 'approximately', 'approx', '대략'],
            syntax: '\\approx',
            description: '근사값',
            example: '\\pi \\approx 3.14'
        },
        {
            category: '관계 기호',
            keywords: ['작다', 'less than', '미만', 'lt'],
            syntax: '<',
            description: '작다',
            example: 'a < b'
        },
        {
            category: '관계 기호',
            keywords: ['크다', 'greater than', '초과', 'gt'],
            syntax: '>',
            description: '크다',
            example: 'a > b'
        },
        {
            category: '관계 기호',
            keywords: ['작거나같다', 'less than or equal', '이하', 'leq'],
            syntax: '\\leq',
            description: '작거나 같다',
            example: 'a \\leq b'
        },
        {
            category: '관계 기호',
            keywords: ['크거나같다', 'greater than or equal', '이상', 'geq'],
            syntax: '\\geq',
            description: '크거나 같다',
            example: 'a \\geq b'
        },
        {
            category: '관계 기호',
            keywords: ['비례', 'proportional', 'propto'],
            syntax: '\\propto',
            description: '비례',
            example: 'y \\propto x'
        },
        {
            category: '관계 기호',
            keywords: ['합동', 'congruent', '모듈로', 'equiv'],
            syntax: '\\equiv',
            description: '합동 / 항등',
            example: 'a \\equiv b \\pmod{n}'
        },
        {
            category: '관계 기호',
            keywords: ['훨씬작다', 'much less', 'll'],
            syntax: '\\ll',
            description: '훨씬 작다',
            example: 'a \\ll b'
        },
        {
            category: '관계 기호',
            keywords: ['훨씬크다', 'much greater', 'gg'],
            syntax: '\\gg',
            description: '훨씬 크다',
            example: 'a \\gg b'
        },

        // === Set Theory ===
        {
            category: '집합',
            keywords: ['원소', 'element', 'in', '포함', '속하다'],
            syntax: '\\in',
            description: '원소 (속함)',
            example: 'x \\in A'
        },
        {
            category: '집합',
            keywords: ['원소아님', 'not in', 'notin', '속하지않다'],
            syntax: '\\notin',
            description: '원소 아님',
            example: 'x \\notin A'
        },
        {
            category: '집합',
            keywords: ['부분집합', 'subset', '포함'],
            syntax: '\\subset',
            description: '부분집합',
            example: 'A \\subset B'
        },
        {
            category: '집합',
            keywords: ['부분집합같음', 'subset or equal', 'subseteq'],
            syntax: '\\subseteq',
            description: '부분집합 (같음 포함)',
            example: 'A \\subseteq B'
        },
        {
            category: '집합',
            keywords: ['상위집합', 'superset', 'supset'],
            syntax: '\\supset',
            description: '상위집합',
            example: 'A \\supset B'
        },
        {
            category: '집합',
            keywords: ['합집합', 'union', '유니온', '또는'],
            syntax: '\\cup',
            description: '합집합',
            example: 'A \\cup B'
        },
        {
            category: '집합',
            keywords: ['교집합', 'intersection', '인터섹션', '그리고'],
            syntax: '\\cap',
            description: '교집합',
            example: 'A \\cap B'
        },
        {
            category: '집합',
            keywords: ['공집합', 'empty set', 'emptyset', '빈집합'],
            syntax: '\\emptyset',
            description: '공집합',
            example: '\\emptyset'
        },
        {
            category: '집합',
            keywords: ['자연수', 'natural numbers', 'N'],
            syntax: '\\mathbb{N}',
            description: '자연수 집합',
            example: '\\mathbb{N}'
        },
        {
            category: '집합',
            keywords: ['정수', 'integers', 'Z'],
            syntax: '\\mathbb{Z}',
            description: '정수 집합',
            example: '\\mathbb{Z}'
        },
        {
            category: '집합',
            keywords: ['유리수', 'rational numbers', 'Q'],
            syntax: '\\mathbb{Q}',
            description: '유리수 집합',
            example: '\\mathbb{Q}'
        },
        {
            category: '집합',
            keywords: ['실수', 'real numbers', 'R'],
            syntax: '\\mathbb{R}',
            description: '실수 집합',
            example: '\\mathbb{R}'
        },
        {
            category: '집합',
            keywords: ['복소수', 'complex numbers', 'C'],
            syntax: '\\mathbb{C}',
            description: '복소수 집합',
            example: '\\mathbb{C}'
        },

        // === Logic ===
        {
            category: '논리',
            keywords: ['그리고', 'and', 'land', '논리곱'],
            syntax: '\\land',
            description: '논리곱 (AND)',
            example: 'p \\land q'
        },
        {
            category: '논리',
            keywords: ['또는', 'or', 'lor', '논리합'],
            syntax: '\\lor',
            description: '논리합 (OR)',
            example: 'p \\lor q'
        },
        {
            category: '논리',
            keywords: ['부정', 'not', 'neg', '논리부정'],
            syntax: '\\neg',
            description: '부정 (NOT)',
            example: '\\neg p'
        },
        {
            category: '논리',
            keywords: ['함의', 'implies', '이면', 'rightarrow'],
            syntax: '\\Rightarrow',
            description: '함의 (이면)',
            example: 'p \\Rightarrow q'
        },
        {
            category: '논리',
            keywords: ['동치', 'if and only if', 'iff', '필요충분'],
            syntax: '\\Leftrightarrow',
            description: '동치 (필요충분)',
            example: 'p \\Leftrightarrow q'
        },
        {
            category: '논리',
            keywords: ['전칭', 'for all', 'forall', '모든'],
            syntax: '\\forall',
            description: '전칭 기호 (모든)',
            example: '\\forall x \\in A'
        },
        {
            category: '논리',
            keywords: ['존재', 'exists', '어떤', '있다'],
            syntax: '\\exists',
            description: '존재 기호',
            example: '\\exists x \\in A'
        },
        {
            category: '논리',
            keywords: ['따라서', 'therefore', '그러므로'],
            syntax: '\\therefore',
            description: '따라서',
            example: '\\therefore x = 1'
        },
        {
            category: '논리',
            keywords: ['왜냐하면', 'because', '이유'],
            syntax: '\\because',
            description: '왜냐하면',
            example: '\\because x > 0'
        },

        // === Matrices ===
        {
            category: '행렬',
            keywords: ['행렬', 'matrix', '매트릭스', '괄호행렬'],
            syntax: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
            description: '행렬 (소괄호)',
            example: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}'
        },
        {
            category: '행렬',
            keywords: ['행렬', 'matrix', '대괄호행렬', 'bmatrix'],
            syntax: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
            description: '행렬 (대괄호)',
            example: '\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}'
        },
        {
            category: '행렬',
            keywords: ['행렬식', 'determinant', 'vmatrix', '판별식'],
            syntax: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}',
            description: '행렬식',
            example: '\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}'
        },
        {
            category: '행렬',
            keywords: ['벡터', 'vector', '열벡터'],
            syntax: '\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}',
            description: '열벡터',
            example: '\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}'
        },
        {
            category: '행렬',
            keywords: ['점', 'dots', '생략', 'cdots', '가로점'],
            syntax: '\\cdots',
            description: '가로 점 (중앙)',
            example: '1, 2, \\cdots, n'
        },
        {
            category: '행렬',
            keywords: ['점', 'dots', '생략', 'vdots', '세로점'],
            syntax: '\\vdots',
            description: '세로 점',
            example: '\\vdots'
        },
        {
            category: '행렬',
            keywords: ['점', 'dots', '생략', 'ddots', '대각점'],
            syntax: '\\ddots',
            description: '대각선 점',
            example: '\\ddots'
        },

        // === Brackets ===
        {
            category: '괄호',
            keywords: ['소괄호', 'parentheses', '괄호', '작은괄호'],
            syntax: '\\left( \\right)',
            description: '자동 크기 소괄호',
            example: '\\left( \\frac{a}{b} \\right)'
        },
        {
            category: '괄호',
            keywords: ['대괄호', 'brackets', '괄호', '꺾쇠'],
            syntax: '\\left[ \\right]',
            description: '자동 크기 대괄호',
            example: '\\left[ \\frac{a}{b} \\right]'
        },
        {
            category: '괄호',
            keywords: ['중괄호', 'braces', '괄호', '집합'],
            syntax: '\\left\\{ \\right\\}',
            description: '자동 크기 중괄호',
            example: '\\left\\{ x \\in A \\right\\}'
        },
        {
            category: '괄호',
            keywords: ['절댓값', 'absolute', '모듈러스', 'abs'],
            syntax: '\\left| \\right|',
            description: '절댓값',
            example: '\\left| x \\right|'
        },
        {
            category: '괄호',
            keywords: ['노름', 'norm', '크기'],
            syntax: '\\left\\| \\right\\|',
            description: '노름 (이중 절댓값)',
            example: '\\left\\| v \\right\\|'
        },
        {
            category: '괄호',
            keywords: ['바닥함수', 'floor', '내림'],
            syntax: '\\lfloor x \\rfloor',
            description: '바닥 함수 (내림)',
            example: '\\lfloor 3.7 \\rfloor = 3'
        },
        {
            category: '괄호',
            keywords: ['천장함수', 'ceiling', 'ceil', '올림'],
            syntax: '\\lceil x \\rceil',
            description: '천장 함수 (올림)',
            example: '\\lceil 3.2 \\rceil = 4'
        },
        {
            category: '괄호',
            keywords: ['홑화살괄호', 'angle bracket', '꺾쇠'],
            syntax: '\\langle x \\rangle',
            description: '꺾쇠 괄호',
            example: '\\langle v, w \\rangle'
        },

        // === Functions ===
        {
            category: '함수',
            keywords: ['사인', 'sin', 'sine', '삼각함수'],
            syntax: '\\sin',
            description: '사인 함수',
            example: '\\sin(x)'
        },
        {
            category: '함수',
            keywords: ['코사인', 'cos', 'cosine', '삼각함수'],
            syntax: '\\cos',
            description: '코사인 함수',
            example: '\\cos(x)'
        },
        {
            category: '함수',
            keywords: ['탄젠트', 'tan', 'tangent', '삼각함수'],
            syntax: '\\tan',
            description: '탄젠트 함수',
            example: '\\tan(x)'
        },
        {
            category: '함수',
            keywords: ['코탄젠트', 'cot', 'cotangent', '삼각함수'],
            syntax: '\\cot',
            description: '코탄젠트 함수',
            example: '\\cot(x)'
        },
        {
            category: '함수',
            keywords: ['시컨트', 'sec', 'secant', '삼각함수'],
            syntax: '\\sec',
            description: '시컨트 함수',
            example: '\\sec(x)'
        },
        {
            category: '함수',
            keywords: ['코시컨트', 'csc', 'cosecant', '삼각함수'],
            syntax: '\\csc',
            description: '코시컨트 함수',
            example: '\\csc(x)'
        },
        {
            category: '함수',
            keywords: ['아크사인', 'arcsin', 'inverse sine', '역삼각'],
            syntax: '\\arcsin',
            description: '아크사인 함수',
            example: '\\arcsin(x)'
        },
        {
            category: '함수',
            keywords: ['아크코사인', 'arccos', 'inverse cosine', '역삼각'],
            syntax: '\\arccos',
            description: '아크코사인 함수',
            example: '\\arccos(x)'
        },
        {
            category: '함수',
            keywords: ['아크탄젠트', 'arctan', 'inverse tangent', '역삼각'],
            syntax: '\\arctan',
            description: '아크탄젠트 함수',
            example: '\\arctan(x)'
        },
        {
            category: '함수',
            keywords: ['로그', 'log', 'logarithm', '상용로그'],
            syntax: '\\log',
            description: '로그 함수',
            example: '\\log_{10}(x)'
        },
        {
            category: '함수',
            keywords: ['자연로그', 'ln', 'natural log'],
            syntax: '\\ln',
            description: '자연로그',
            example: '\\ln(x)'
        },
        {
            category: '함수',
            keywords: ['지수함수', 'exp', 'exponential', '이'],
            syntax: '\\exp',
            description: '지수 함수',
            example: '\\exp(x)'
        },
        {
            category: '함수',
            keywords: ['최대', 'max', 'maximum'],
            syntax: '\\max',
            description: '최댓값',
            example: '\\max(a, b)'
        },
        {
            category: '함수',
            keywords: ['최소', 'min', 'minimum'],
            syntax: '\\min',
            description: '최솟값',
            example: '\\min(a, b)'
        },
        {
            category: '함수',
            keywords: ['상극한', 'sup', 'supremum'],
            syntax: '\\sup',
            description: '상한 (supremum)',
            example: '\\sup S'
        },
        {
            category: '함수',
            keywords: ['하극한', 'inf', 'infimum'],
            syntax: '\\inf',
            description: '하한 (infimum)',
            example: '\\inf S'
        },

        // === Arrows ===
        {
            category: '화살표',
            keywords: ['오른쪽화살표', 'right arrow', 'rightarrow', '이면'],
            syntax: '\\rightarrow',
            description: '오른쪽 화살표',
            example: 'a \\rightarrow b'
        },
        {
            category: '화살표',
            keywords: ['왼쪽화살표', 'left arrow', 'leftarrow'],
            syntax: '\\leftarrow',
            description: '왼쪽 화살표',
            example: 'a \\leftarrow b'
        },
        {
            category: '화살표',
            keywords: ['양방향화살표', 'left right arrow', 'leftrightarrow'],
            syntax: '\\leftrightarrow',
            description: '양방향 화살표',
            example: 'a \\leftrightarrow b'
        },
        {
            category: '화살표',
            keywords: ['위화살표', 'up arrow', 'uparrow'],
            syntax: '\\uparrow',
            description: '위쪽 화살표',
            example: '\\uparrow'
        },
        {
            category: '화살표',
            keywords: ['아래화살표', 'down arrow', 'downarrow'],
            syntax: '\\downarrow',
            description: '아래쪽 화살표',
            example: '\\downarrow'
        },
        {
            category: '화살표',
            keywords: ['대응', 'maps to', 'mapsto'],
            syntax: '\\mapsto',
            description: '대응 화살표',
            example: 'x \\mapsto f(x)'
        },

        // === Accents ===
        {
            category: '기호/장식',
            keywords: ['모자', 'hat', '추정량'],
            syntax: '\\hat{x}',
            description: '모자 기호',
            example: '\\hat{x}'
        },
        {
            category: '기호/장식',
            keywords: ['바', 'bar', '평균', '켤레'],
            syntax: '\\bar{x}',
            description: '바 기호 (평균)',
            example: '\\bar{x}'
        },
        {
            category: '기호/장식',
            keywords: ['벡터', 'vec', 'vector'],
            syntax: '\\vec{v}',
            description: '벡터 화살표',
            example: '\\vec{v}'
        },
        {
            category: '기호/장식',
            keywords: ['점', 'dot', '미분', '시간미분'],
            syntax: '\\dot{x}',
            description: '점 (시간 미분)',
            example: '\\dot{x}'
        },
        {
            category: '기호/장식',
            keywords: ['점두개', 'ddot', '이차미분'],
            syntax: '\\ddot{x}',
            description: '점 두 개',
            example: '\\ddot{x}'
        },
        {
            category: '기호/장식',
            keywords: ['틸드', 'tilde', '물결'],
            syntax: '\\tilde{x}',
            description: '틸드 (물결)',
            example: '\\tilde{x}'
        },
        {
            category: '기호/장식',
            keywords: ['오버라인', 'overline', '위선'],
            syntax: '\\overline{AB}',
            description: '위 선',
            example: '\\overline{AB}'
        },
        {
            category: '기호/장식',
            keywords: ['언더라인', 'underline', '밑줄'],
            syntax: '\\underline{x}',
            description: '밑줄',
            example: '\\underline{text}'
        },
        {
            category: '기호/장식',
            keywords: ['오버브레이스', 'overbrace', '위괄호'],
            syntax: '\\overbrace{a+b}^{n}',
            description: '위 괄호',
            example: '\\overbrace{1+2+\\cdots+n}^{n\\text{ terms}}'
        },
        {
            category: '기호/장식',
            keywords: ['언더브레이스', 'underbrace', '아래괄호'],
            syntax: '\\underbrace{a+b}_{n}',
            description: '아래 괄호',
            example: '\\underbrace{1+2+\\cdots+n}_{n\\text{ terms}}'
        },

        // === Misc Symbols ===
        {
            category: '기타',
            keywords: ['팩토리얼', 'factorial', '계승', '!'],
            syntax: 'n!',
            description: '팩토리얼',
            example: 'n!'
        },
        {
            category: '기타',
            keywords: ['조합', 'combination', 'choose', '이항계수', 'binomial'],
            syntax: '\\binom{n}{k}',
            description: '이항 계수 (조합)',
            example: '\\binom{n}{k}'
        },
        {
            category: '기타',
            keywords: ['퍼센트', 'percent', '%'],
            syntax: '\\%',
            description: '퍼센트',
            example: '50\\%'
        },
        {
            category: '기타',
            keywords: ['도', 'degree', '각도'],
            syntax: '^\\circ',
            description: '도 (각도)',
            example: '90^\\circ'
        },
        {
            category: '기타',
            keywords: ['텍스트', 'text', '문자열'],
            syntax: '\\text{문자}',
            description: '일반 텍스트 삽입',
            example: 'x \\text{ where } x > 0'
        },
        {
            category: '기타',
            keywords: ['볼드', 'bold', '굵은', '벡터'],
            syntax: '\\mathbf{x}',
            description: '굵은 글씨 (벡터)',
            example: '\\mathbf{v}'
        },
        {
            category: '기타',
            keywords: ['캘리그래피', 'calligraphy', '필기체', 'mathcal'],
            syntax: '\\mathcal{L}',
            description: '필기체',
            example: '\\mathcal{L}'
        },
        {
            category: '기타',
            keywords: ['스페이스', 'space', '공백', '띄어쓰기'],
            syntax: '\\,  \\;  \\quad  \\qquad',
            description: '공백 (작음 → 큼)',
            example: 'a \\quad b'
        },
        {
            category: '기타',
            keywords: ['케이스', 'cases', '조건', '경우'],
            syntax: '\\begin{cases} ... \\end{cases}',
            description: '조건별 정의',
            example: 'f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & x \\leq 0 \\end{cases}'
        },
        {
            category: '기타',
            keywords: ['정렬', 'align', '여러줄', '수식정렬'],
            syntax: '\\begin{aligned} ... \\end{aligned}',
            description: '수식 정렬',
            example: '\\begin{aligned} a &= b + c \\\\ &= d \\end{aligned}'
        }
    ],

    /**
     * Initialize the module
     */
    init() {
        this.createDialog();
        this.bindEvents();
        this.bindToolbarButton();
        console.log('[KatexHelper] Initialized with', this.database.length, 'entries');
    },

    /**
     * Bind toolbar button event
     */
    bindToolbarButton() {
        const btn = document.getElementById('btn-katex-helper');
        if (btn) {
            btn.addEventListener('click', () => this.toggle());
        }
    },

    /**
     * Create the dialog HTML
     */
    createDialog() {
        const dialog = document.createElement('div');
        dialog.id = 'katex-helper-dialog';
        dialog.className = 'katex-helper-dialog';
        dialog.style.display = 'none';

        dialog.innerHTML = `
            <div class="dialog-header">
                <h3>KaTeX 수식 도우미</h3>
                <button class="close-btn" id="katex-helper-close">&times;</button>
            </div>
            <div class="dialog-body">
                <div class="search-container">
                    <input type="text" id="katex-search" placeholder="검색어 입력 (예: 분수, fraction, 적분...)" autocomplete="off">
                    <div id="katex-suggestions" class="suggestions-container"></div>
                </div>
                <div id="katex-results" class="results-container">
                    <div class="results-placeholder">
                        <p>검색어를 입력하면 관련 KaTeX 문법이 표시됩니다.</p>
                        <p class="hint">한글 또는 영어로 검색할 수 있습니다.</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        this.dialog = dialog;
        this.searchInput = dialog.querySelector('#katex-search');
        this.resultsContainer = dialog.querySelector('#katex-results');
        this.suggestionsContainer = dialog.querySelector('#katex-suggestions');
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Close button
        const closeBtn = this.dialog.querySelector('#katex-helper-close');
        closeBtn.addEventListener('click', () => this.close());

        // Search input
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                this.showSuggestions(query);
                this.search(query);
            } else {
                this.clearSuggestions();
                this.showPlaceholder();
            }
        });

        // Handle keyboard navigation
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.focusNextSuggestion();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.focusPrevSuggestion();
            } else if (e.key === 'Enter') {
                const focused = this.suggestionsContainer.querySelector('.suggestion-item.focused');
                if (focused) {
                    e.preventDefault();
                    focused.click();
                }
            }
        });

        // Click outside to close
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.close();
            }
        });

        // Keyboard shortcut (Ctrl/Cmd + K to open)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k' && e.shiftKey) {
                e.preventDefault();
                this.toggle();
            }
        });
    },

    /**
     * Show autocomplete suggestions
     */
    showSuggestions(query) {
        const lowerQuery = query.toLowerCase();
        const suggestions = new Set();

        // Collect matching keywords
        this.database.forEach(item => {
            item.keywords.forEach(keyword => {
                if (keyword.toLowerCase().startsWith(lowerQuery) && keyword.toLowerCase() !== lowerQuery) {
                    suggestions.add(keyword);
                }
            });
        });

        // Render suggestions
        if (suggestions.size > 0) {
            const sortedSuggestions = Array.from(suggestions).slice(0, 8);
            this.suggestionsContainer.innerHTML = sortedSuggestions
                .map(s => `<div class="suggestion-item" data-value="${s}">${this.highlightMatch(s, query)}</div>`)
                .join('');
            this.suggestionsContainer.style.display = 'block';

            // Bind click events
            this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.searchInput.value = item.dataset.value;
                    this.clearSuggestions();
                    this.search(item.dataset.value);
                    this.searchInput.focus();
                });
            });
        } else {
            this.clearSuggestions();
        }
    },

    /**
     * Highlight matching part of suggestion
     */
    highlightMatch(text, query) {
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return text;
        return text.substring(0, index) +
               '<strong>' + text.substring(index, index + query.length) + '</strong>' +
               text.substring(index + query.length);
    },

    /**
     * Clear suggestions
     */
    clearSuggestions() {
        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.style.display = 'none';
    },

    /**
     * Focus next suggestion
     */
    focusNextSuggestion() {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        const focused = this.suggestionsContainer.querySelector('.suggestion-item.focused');
        if (focused) {
            focused.classList.remove('focused');
            const next = focused.nextElementSibling || items[0];
            next.classList.add('focused');
        } else {
            items[0].classList.add('focused');
        }
    },

    /**
     * Focus previous suggestion
     */
    focusPrevSuggestion() {
        const items = this.suggestionsContainer.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        const focused = this.suggestionsContainer.querySelector('.suggestion-item.focused');
        if (focused) {
            focused.classList.remove('focused');
            const prev = focused.previousElementSibling || items[items.length - 1];
            prev.classList.add('focused');
        } else {
            items[items.length - 1].classList.add('focused');
        }
    },

    /**
     * Search database
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        const results = [];

        this.database.forEach(item => {
            // Check if any keyword matches
            const matchScore = item.keywords.reduce((score, keyword) => {
                const lowerKeyword = keyword.toLowerCase();
                if (lowerKeyword === lowerQuery) return Math.max(score, 100);
                if (lowerKeyword.startsWith(lowerQuery)) return Math.max(score, 80);
                if (lowerKeyword.includes(lowerQuery)) return Math.max(score, 60);
                return score;
            }, 0);

            if (matchScore > 0) {
                results.push({ ...item, score: matchScore });
            }
        });

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        this.renderResults(results);
    },

    /**
     * Render search results
     */
    renderResults(results) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="no-results">
                    <p>검색 결과가 없습니다.</p>
                    <p class="hint">다른 키워드로 검색해 보세요.</p>
                </div>
            `;
            return;
        }

        // Group by category
        const grouped = {};
        results.forEach(item => {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        });

        let html = '';
        for (const [category, items] of Object.entries(grouped)) {
            html += `<div class="result-category"><h4>${category}</h4>`;
            items.forEach(item => {
                html += `
                    <div class="result-item" data-syntax="${this.escapeHtml(item.syntax)}">
                        <div class="result-info">
                            <span class="result-description">${item.description}</span>
                            <code class="result-syntax">${this.escapeHtml(item.syntax)}</code>
                        </div>
                        <div class="result-preview" id="preview-${this.hashCode(item.example)}"></div>
                        <div class="result-actions">
                            <button class="btn-copy" data-syntax="${this.escapeHtml(item.syntax)}">복사</button>
                            <button class="btn-insert" data-syntax="${this.escapeHtml(item.syntax)}">삽입</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        this.resultsContainer.innerHTML = html;

        // Render KaTeX previews
        results.forEach(item => {
            const previewEl = document.getElementById(`preview-${this.hashCode(item.example)}`);
            if (previewEl && typeof katex !== 'undefined') {
                try {
                    katex.render(item.example, previewEl, {
                        throwOnError: false,
                        displayMode: false
                    });
                } catch (e) {
                    previewEl.textContent = item.example;
                }
            }
        });

        // Bind button events
        this.resultsContainer.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyToClipboard(btn.dataset.syntax);
                btn.textContent = '복사됨!';
                setTimeout(() => btn.textContent = '복사', 1500);
            });
        });

        this.resultsContainer.querySelectorAll('.btn-insert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.insertSyntax(btn.dataset.syntax);
            });
        });

        // Click on result item to insert
        this.resultsContainer.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.insertSyntax(item.dataset.syntax);
            });
        });
    },

    /**
     * Show placeholder
     */
    showPlaceholder() {
        this.resultsContainer.innerHTML = `
            <div class="results-placeholder">
                <p>검색어를 입력하면 관련 KaTeX 문법이 표시됩니다.</p>
                <p class="hint">한글 또는 영어로 검색할 수 있습니다.</p>
            </div>
        `;
    },

    /**
     * Copy to clipboard
     */
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('[KatexHelper] Copied:', text);
        }).catch(err => {
            console.error('[KatexHelper] Copy failed:', err);
        });
    },

    /**
     * Insert syntax into editor
     */
    insertSyntax(syntax) {
        if (typeof EditorModule !== 'undefined' && EditorModule.insertText) {
            // Wrap with $ for inline math
            EditorModule.insertText(`$${syntax}$`);
            this.close();
        } else {
            // Fallback: copy to clipboard
            this.copyToClipboard(syntax);
            alert('에디터에 직접 삽입할 수 없습니다. 문법이 클립보드에 복사되었습니다.');
        }
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Simple hash code for unique IDs
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    },

    /**
     * Open dialog
     */
    open() {
        this.dialog.style.display = 'flex';
        this.isOpen = true;
        this.searchInput.value = '';
        this.showPlaceholder();
        this.clearSuggestions();
        setTimeout(() => this.searchInput.focus(), 100);
    },

    /**
     * Close dialog
     */
    close() {
        this.dialog.style.display = 'none';
        this.isOpen = false;
    },

    /**
     * Toggle dialog
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    KatexHelperModule.init();
});
