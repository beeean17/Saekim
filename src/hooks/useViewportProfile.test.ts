import { describe, expect, it } from 'vitest';
import { viewportProfileForViewport } from './useViewportProfile';

describe('viewport profiles', () => {
  it('keeps Android phones compact in both orientations', () => {
    expect(viewportProfileForViewport(412, 915, true)).toBe('compact');
    expect(viewportProfileForViewport(915, 412, true)).toBe('compact');
  });

  it('keeps tablet-sized Android viewports in desktop layouts', () => {
    expect(viewportProfileForViewport(800, 1280, true)).toBe('medium');
    expect(viewportProfileForViewport(1280, 800, true)).toBe('medium');
  });

  it('continues to classify desktop windows by width', () => {
    expect(viewportProfileForViewport(1000, 500)).toBe('expanded');
    expect(viewportProfileForViewport(599, 1000)).toBe('compact');
  });
});
