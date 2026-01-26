import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  endTour: () => void;
  goToStep: (step: number) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const STORAGE_KEY_COMPLETED = "onboarding:tour_completed";
const STORAGE_KEY_SKIPPED = "onboarding:tour_skipped";
const TOTAL_STEPS = 4;

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Tour completed
      localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
      localStorage.removeItem(STORAGE_KEY_SKIPPED);
      setIsActive(false);
      setCurrentStep(0);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_SKIPPED, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  const endTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_COMPLETED, "true");
    localStorage.removeItem(STORAGE_KEY_SKIPPED);
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: TOTAL_STEPS,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        endTour,
        goToStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTourContext must be used within a TourProvider");
  }
  return context;
}

export { STORAGE_KEY_COMPLETED, STORAGE_KEY_SKIPPED };
