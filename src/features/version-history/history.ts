import type { DocumentSnapshotSummary } from '../../types/metadata';

export const fiveMinutesInMilliseconds = 5 * 60 * 1_000;

export function snapshotAtOrBefore(
  snapshots: readonly DocumentSnapshotSummary[],
  timestamp: number,
): DocumentSnapshotSummary | null {
  return snapshots.find((snapshot) => snapshot.createdAt <= timestamp) ?? null;
}
