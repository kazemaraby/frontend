import type { DayStatus } from "@/api/attendance";
import type { PillTone } from "@/design/Pill";

/** The pill tone of each day status (the record and the dashboard card). */
export const DAY_TONES: Record<DayStatus, PillTone> = {
  present: "green",
  late: "amber",
  early_leave: "orange",
  incomplete: "pink",
  absent: "salmon",
  working: "teal",
  not_started: "neutral",
  leave: "lavender",
  mission: "orange",
  trip: "sky",
  remote: "sky",
  holiday: "teal",
  off: "neutral",
  unscheduled: "neutral",
};
