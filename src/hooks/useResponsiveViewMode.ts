import { useMemo } from 'react';
import { useViewportProfile, type ViewportProfile, type ViewportProfileSnapshot } from './useViewportProfile';
import type { ViewMode } from '../types/workspace';

const FULL_VIEW_MODES: readonly ViewMode[] = ['edit', 'split', 'preview'];
const COMPACT_VIEW_MODES: readonly ViewMode[] = ['edit', 'preview'];

export interface ResponsiveViewModeSnapshot {
  viewportProfile: ViewportProfileSnapshot;
  availableViewModes: readonly ViewMode[];
  effectiveViewMode: ViewMode;
}

export function viewModesForViewportProfile(profile: ViewportProfile): readonly ViewMode[] {
  return profile === 'compact' ? COMPACT_VIEW_MODES : FULL_VIEW_MODES;
}

export function effectiveViewModeForProfile(viewMode: ViewMode, profile: ViewportProfile): ViewMode {
  return viewModesForViewportProfile(profile).includes(viewMode) ? viewMode : 'edit';
}

export function useResponsiveViewMode(viewMode: ViewMode): ResponsiveViewModeSnapshot {
  const viewportProfile = useViewportProfile();
  const availableViewModes = useMemo(
    () => viewModesForViewportProfile(viewportProfile.profile),
    [viewportProfile.profile],
  );
  const effectiveViewMode = useMemo(
    () => effectiveViewModeForProfile(viewMode, viewportProfile.profile),
    [viewMode, viewportProfile.profile],
  );

  return {
    viewportProfile,
    availableViewModes,
    effectiveViewMode,
  };
}
