/** Static sample data for Phase 0 screens. Shapes follow the backend (name_ar / name_en, decimal strings for money);
 * task 4 replaces these with API calls behind the same query hooks. */
import { parseDate } from "@/lib/format";

export type Named = { name_ar: string; name_en: string };

/** The design screenshots are dated 21 October 2026; mock data is anchored there so screens match them. */
export const MOCK_TODAY = parseDate("2026-10-21");

export const mockFetch = <T>(data: T) => () => Promise.resolve(data);
