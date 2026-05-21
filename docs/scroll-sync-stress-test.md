# Scroll Sync Stress Test

이 문서는 split-view 스크롤 동기화와 하단 입력 안정성을 수동 검증하기 위한 테스트 문서다.

## 1. Top Section

첫 문단은 여러 줄 paragraph 렌더링을 확인하기 위한 내용이다. 편집기에서는 줄 단위로 표시되지만 preview에서는 창 너비에 따라 줄바꿈 높이가 달라진다. 이 상태에서 editor를 스크롤하면 preview가 같은 원본 문서 위치로 이동해야 한다.

> Blockquote 첫 줄
> Blockquote 둘째 줄
> Blockquote 셋째 줄

## 2. Nested List

- Alpha
  - Alpha one
  - Alpha two
    - Alpha two nested
- Beta
  1. Ordered one
  2. Ordered two
  3. Ordered three
- Gamma

## 3. Table

| 구간 | 입력 위치 | 기대 동작 |
| --- | --- | --- |
| top | 문서 상단 | preview 상단 유지 |
| middle | 문서 중간 | source line 기준 유지 |
| bottom | 문서 하단 | preview가 위로 튀지 않음 |

## 4. Long Paragraphs

아래 paragraph는 preview에서 여러 줄로 wrap되는 케이스다. 문장 길이가 길수록 editor의 물리적 line height와 preview의 rendered block height가 달라지므로 단순 scroll ratio만으로는 위치가 흔들릴 수 있다. source line anchor가 있으면 현재 줄 근처의 rendered block을 기준으로 안정적으로 이동해야 한다.

다시 긴 문단을 반복한다. 빠른 입력 중에도 caret가 튀지 않고, preview가 이전 섹션을 순간적으로 보여주거나 중간 섹션으로 이동하지 않아야 한다. 특히 마지막 줄에서 계속 입력할 때 preview는 현재 문서 끝 근처를 유지해야 한다.

## 5. Code Block

```ts
type Item = {
  id: string;
  title: string;
  done: boolean;
};

const items: Item[] = Array.from({ length: 24 }, (_, index) => ({
  id: `item-${index + 1}`,
  title: `Task ${index + 1}`,
  done: index % 3 === 0,
}));

export function summarize(list: Item[]): string {
  return list
    .filter((item) => !item.done)
    .map((item) => item.title)
    .join(', ');
}
```

## 6. Image Placeholder

![placeholder](https://example.com/image-placeholder.png)

## 7. Repeated Headings

### Section 7.1

짧은 본문.

### Section 7.2

짧은 본문.

### Section 7.3

짧은 본문.

### Section 7.4

짧은 본문.

### Section 7.5

짧은 본문.

### Section 7.6

짧은 본문.

### Section 7.7

짧은 본문.

### Section 7.8

짧은 본문.

### Section 7.9

짧은 본문.

### Section 7.10

짧은 본문.

## 8. Bottom Input Target

이 아래 줄에서 빠르게 연속 입력한다.

마지막 입력 줄:
