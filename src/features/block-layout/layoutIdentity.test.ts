import { describe, expect, it } from 'vitest';
import {
  layoutIdentity,
  layoutIdentityForMatch,
  layoutIdentityMatchForElement,
  layoutWithIdentity,
} from './layoutIdentity';
import type { BlockLayout } from '../../types/metadata';

describe('layout identity', () => {
  it('serializes a stable block identity', () => {
    expect(layoutIdentity({ blockKind: 'image', blockKey: 'asset.png', occurrenceIndex: 2 }))
      .toBe('image:asset.png:2');
  });

  it('prefers preview box ids while retaining the legacy identity', () => {
    const element = document.createElement('div');
    element.dataset.previewBoxId = 'preview-box:stable';
    const match = layoutIdentityMatchForElement({
      element,
      blockKind: 'image',
      legacyBlockKey: 'asset.png',
      legacyOccurrenceIndex: 3,
    });

    expect(match.current).toEqual({ blockKind: 'image', blockKey: 'preview-box:stable', occurrenceIndex: 0 });
    expect(match.legacy).toEqual({ blockKind: 'image', blockKey: 'asset.png', occurrenceIndex: 3 });
    expect(layoutIdentityForMatch(match)).toBe('image:preview-box:stable:0');
  });

  it('updates only identity fields on an existing layout', () => {
    const layout = {
      filePath: '/docs/readme.md',
      blockKind: 'image',
      blockKey: 'old',
      occurrenceIndex: 0,
      widthValue: 75,
      widthUnit: '%',
      heightValue: null,
      heightUnit: 'auto',
      align: 'center',
    } satisfies BlockLayout;

    expect(layoutWithIdentity(layout, { blockKind: 'image', blockKey: 'new', occurrenceIndex: 1 }))
      .toMatchObject({ blockKey: 'new', occurrenceIndex: 1, widthValue: 75, align: 'center' });
  });
});
