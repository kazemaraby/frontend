// docs/design Reports screen.
export const monthlyHires = [3, 8, 16, 27, 84, 34, 42, 100, 45, 31, 28, 12];
export const peakHiresMonth = 7; // August (0-based)

export const leaveUsage = { permissionHours: 45, permissionHoursMax: 60, averageDailyHours: 2, usedFullBalancePct: 90, peakMonth: 7, peakMonthHours: 18 };

export const workforce = {
  payroll_cost: "1000000.63",
  active_employees: 150,
  saudization_pct: 34,
  nitaqat_band: "highGreen" as const,
  iqamas_expiring_30d: 6,
};

/** Retention vs turnover, August → October (chronological). Month labels only on the 1st point of each month. */
export const turnoverTrend: { month: number | null; retention: number; turnover: number }[] = [
  { month: 7, retention: 85, turnover: 87 },
  { month: null, retention: 87, turnover: 87 },
  { month: null, retention: 98, turnover: 86 },
  { month: null, retention: 80, turnover: 81 },
  { month: 8, retention: 52, turnover: 75 },
  { month: null, retention: 68, turnover: 74 },
  { month: null, retention: 93, turnover: 78 },
  { month: null, retention: 78, turnover: 84 },
  { month: 9, retention: 60, turnover: 88 },
];
