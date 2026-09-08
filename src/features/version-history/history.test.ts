import { describe, expect, it } from 'vitest';
import type { DocumentSnapshotSummary } from '../../types/metadata';
import { snapshotAtOrBefore } from './history';

const snapshot = (id: string, createdAt: number): DocumentSnapshotSummary => ({
  id,
  filePath: '/project/note.md',
  encoding: 'utf-8',
  eol: 'LF',
  source: 'autosave',
  characterCount: 10,
  createdAt,
});

describe('snapshotAtOrBefore', () => {
  it('returns the newest snapshot no later than the requested time', () => {
    expect(snapshotAtOrBefore([snapshot('new', 300), snapshot('target', 200), snapshot('old', 100)], 250)?.id).toBe('target');
  });

  it('returns null when all snapshots are newer than the requested time', () => {
    expect(snapshotAtOrBefore([snapshot('new', 300)], 250)).toBeNull();
  });
});
