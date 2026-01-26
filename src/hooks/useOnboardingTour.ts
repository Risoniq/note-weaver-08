import { useEffect, useCallback } from "react";
import { useTourContext, STORAGE_KEY_COMPLETED, STORAGE_KEY_SKIPPED } from "@/components/onboarding/TourProvider";

export function useOnboardingTour() {
  const context = useTourContext();

  const shouldShowTour = useCallback(() => {
    const completed = localStorage.getItem(STORAGE_KEY_COMPLETED);
    const skipped = localStorage.getItem(STORAGE_KEY_SKIPPED);
    return !completed && !skipped;
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
    localStorage.removeItem(STORAGE_KEY_SKIPPED);
    context.startTour();
  }, [context]);

  const startTourIfFirstVisit = useCallback(() => {
    if (shouldShowTour()) {
      // Small delay to ensure the page is fully rendered
      setTimeout(() => {
        context.startTour();
      }, 500);
    }
  }, [shouldShowTour, context]);

  return {
    ...context,
    shouldShowTour,
    resetTour,
    startTourIfFirstVisit,
  };
}

// Hook to auto-start tour on first visit
export function useAutoStartTour() {
  const { startTourIfFirstVisit } = useOnboardingTour();

  useEffect(() => {
    startTourIfFirstVisit();
  }, [startTourIfFirstVisit]);
}
