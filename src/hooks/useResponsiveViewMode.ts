import { useMemo } from 'react';
import { useViewportProfile, type ViewportProfile, type ViewportProfileSnapshot } from './useViewportProfile';
import type { ViewMode } from '../types/workspace';

const FULL_VIEW_MODES: readonly ViewMode[] = ['edit', 'split', 'preview'];
const COMPACT_VIEW_MODES: readonly ViewMode[] = ['edit', 'preview'];
const MIN_SPLIT_VIEW_WIDTH = 688;

export interface ResponsiveViewModeSnapshot {
  viewportProfile: ViewportProfileSnapshot;
  availableViewModes: readonly ViewMode[];
  effectiveViewMode: ViewMode;
}

export function viewModesForViewportProfile(profile: ViewportProfile, width: number): readonly ViewMode[] {
  return profile === 'compact' || width < MIN_SPLIT_VIEW_WIDTH ? COMPACT_VIEW_MODES : FULL_VIEW_MODES;
}

export function effectiveViewModeForProfile(viewMode: ViewMode, profile: ViewportProfile, width: number): ViewMode {
  return viewModesForViewportProfile(profile, width).includes(viewMode) ? viewMode : 'edit';
}

export function useResponsiveViewMode(viewMode: ViewMode): ResponsiveViewModeSnapshot {
  const viewportProfile = useViewportProfile();
  const availableViewModes = useMemo(
    () => viewModesForViewportProfile(viewportProfile.profile, viewportProfile.width),
    [viewportProfile.profile, viewportProfile.width],
  );
  const effectiveViewMode = useMemo(
    () => effectiveViewModeForProfile(viewMode, viewportProfile.profile, viewportProfile.width),
    [viewMode, viewportProfile.profile, viewportProfile.width],
  );

  return {
    viewportProfile,
    availableViewModes,
    effectiveViewMode,
  };
}
