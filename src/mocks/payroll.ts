import type { Named } from ".";

export type PayrollRow = Named & {
  id: number;
  employee_no: string;
  basic: string;
  allowances: string;
  deductions: string;
  net: string;
  end_of_service: boolean;
};

// docs/design Payroll screen. Net = basic + allowances − deductions, computed by the backend (never in the UI).
export const payrollRows: PayrollRow[] = [
  { id: 1, employee_no: "EMP-001", name_ar: "جبر صقر", name_en: "Jabr Saqr", basic: "16000.00", allowances: "6400.00", deductions: "1560.00", net: "20840.00", end_of_service: true },
  { id: 2, employee_no: "EMP-002", name_ar: "خيري العمولي", name_en: "Khairy Al-Amouli", basic: "24000.00", allowances: "9600.00", deductions: "0.00", net: "33600.00", end_of_service: false },
  { id: 3, employee_no: "EMP-003", name_ar: "كافي مروان", name_en: "Kafi Marwan", basic: "12000.00", allowances: "4800.00", deductions: "1170.00", net: "15630.00", end_of_service: true },
  { id: 4, employee_no: "EMP-004", name_ar: "رؤيا حاوي", name_en: "Ruya Hawi", basic: "9000.00", allowances: "3600.00", deductions: "400.00", net: "12200.00", end_of_service: true },
  { id: 5, employee_no: "EMP-005", name_ar: "حكيم أحمد", name_en: "Hakim Ahmed", basic: "10000.00", allowances: "4000.00", deductions: "975.00", net: "13025.00", end_of_service: true },
  { id: 6, employee_no: "EMP-006", name_ar: "عالية بناجيا", name_en: "Aliya Banajia", basic: "24000.00", allowances: "9600.00", deductions: "0.00", net: "33600.00", end_of_service: false },
  { id: 7, employee_no: "EMP-007", name_ar: "سلسبيل علي", name_en: "Salsabil Ali", basic: "16000.00", allowances: "6400.00", deductions: "1560.00", net: "20840.00", end_of_service: false },
];

export const payrollSummary = {
  period: "2026-10-01",
  net_total: "149735.00",
  gosi_employer: "12840.00",
  headcount: 7,
  status: "draft" as const,
};

export const payrollPeriods = ["2026-10-01", "2026-09-01", "2026-08-01"];
