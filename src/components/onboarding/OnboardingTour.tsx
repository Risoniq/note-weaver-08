import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useTourContext } from "./TourProvider";
import { tourSteps, TourStepConfig } from "./TourStep";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  const { isActive, currentStep, totalSteps, nextStep, prevStep, skipTour, endTour } = useTourContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStepConfig: TourStepConfig | undefined = tourSteps[currentStep];

  const calculatePositions = useCallback(() => {
    if (!currentStepConfig) return;

    if (currentStepConfig.position === "center" || !currentStepConfig.targetSelector) {
      setSpotlight(null);
      // Center the tooltip
      const tooltipWidth = tooltipRef.current?.offsetWidth || 400;
      const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
      setTooltipPosition({
        top: Math.max(20, (window.innerHeight - tooltipHeight) / 2),
        left: Math.max(20, (window.innerWidth - tooltipWidth) / 2),
      });
      return;
    }

    const target = document.querySelector(currentStepConfig.targetSelector);
    if (!target) {
      // Element not found, might need navigation
      setSpotlight(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 8;

    // Set spotlight
    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position based on step config
    const tooltipWidth = tooltipRef.current?.offsetWidth || 400;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (currentStepConfig.position) {
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    // Keep tooltip within viewport
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));

    setTooltipPosition({ top, left });
  }, [currentStepConfig]);

  // Handle navigation for steps that require it
  useEffect(() => {
    if (!isActive || !currentStepConfig) return;

    // Check if we need to navigate for this step
    if (currentStepConfig.action === "navigate" && currentStepConfig.actionTarget) {
      const targetPath = currentStepConfig.actionTarget;
      if (location.pathname !== targetPath) {
        // We're on step 1 (calendar-nav), user sees the nav item highlighted
        // Don't navigate automatically, let them click or press next
      }
    }
  }, [isActive, currentStepConfig, location.pathname]);

  // Recalculate positions when step changes or window resizes
  useEffect(() => {
    if (!isActive) return;

    // Small delay to allow DOM updates
    const timer = setTimeout(calculatePositions, 100);

    const handleResize = () => calculatePositions();
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [isActive, currentStep, calculatePositions, location.pathname]);

  const handleNext = () => {
    // If current step requires navigation, do it before moving to next step
    if (currentStepConfig?.action === "navigate" && currentStepConfig.actionTarget) {
      const targetPath = currentStepConfig.actionTarget;
      if (location.pathname !== targetPath) {
        navigate(targetPath);
        // Small delay before advancing to allow navigation to complete
        setTimeout(() => nextStep(), 300);
        return;
      }
    }
    nextStep();
  };

  const handlePrev = () => {
    prevStep();
  };

  if (!isActive || !currentStepConfig) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop with spotlight cutout */}
      <div className="absolute inset-0 pointer-events-auto">
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotlight && (
                <rect
                  x={spotlight.left}
                  y={spotlight.top}
                  width={spotlight.width}
                  height={spotlight.height}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight glow effect */}
        {spotlight && (
          <div
            className="absolute rounded-xl ring-4 ring-primary/50 ring-offset-2 ring-offset-transparent animate-pulse pointer-events-none"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
            }}
          />
        )}
      </div>

      {/* Tooltip Card */}
      <div
        ref={tooltipRef}
        className="absolute z-10 w-[360px] max-w-[calc(100vw-40px)] transition-all duration-300 ease-out"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <GlassCard className="p-5 shadow-2xl border-primary/20">
          {/* Close button */}
          <button
            onClick={skipTour}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header with icon */}
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg leading-tight">
                {currentStepConfig.title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            {currentStepConfig.description}
          </p>

          {/* Progress and Navigation */}
          <div className="flex items-center justify-between">
            {/* Progress indicator */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    i === currentStep
                      ? "w-6 bg-primary"
                      : i < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Zurück
                </Button>
              )}
              {isFirstStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                >
                  Überspringen
                </Button>
              )}
              <Button
                size="sm"
                onClick={isLastStep ? endTour : handleNext}
                className="gap-1"
              >
                {isLastStep ? "Fertig" : "Weiter"}
                {!isLastStep && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
