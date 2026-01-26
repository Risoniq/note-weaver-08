export interface TourStepConfig {
  id: string;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for the element to spotlight
  position: "top" | "bottom" | "left" | "right" | "center";
  action?: "navigate" | "click" | "none";
  actionTarget?: string; // URL for navigate or selector for click
}

export const tourSteps: TourStepConfig[] = [
  {
    id: "welcome",
    title: "Willkommen beim Meeting Recorder!",
    description:
      "Diese kurze Tour zeigt dir, wie du deinen Kalender verbindest, damit der Bot automatisch deinen Meetings beitritt.",
    position: "center",
    action: "none",
  },
  {
    id: "calendar-nav",
    title: "Kalender-Seite",
    description: "Klicke hier, um zur Kalender-Verwaltung zu gelangen.",
    targetSelector: '[data-tour="calendar-nav"]',
    position: "bottom",
    action: "navigate",
    actionTarget: "/calendar",
  },
  {
    id: "calendar-connect",
    title: "Kalender verbinden",
    description:
      "Verbinde deinen Google- oder Microsoft-Kalender, um automatische Aufnahmen zu aktivieren.",
    targetSelector: '[data-tour="calendar-connection"]',
    position: "bottom",
    action: "none",
  },
  {
    id: "auto-record",
    title: "Automatische Aufnahme aktivieren",
    description:
      "Aktiviere diese Option, damit der Bot automatisch allen deinen Meetings beitritt.",
    targetSelector: '[data-tour="auto-record"]',
    position: "top",
    action: "none",
  },
];
