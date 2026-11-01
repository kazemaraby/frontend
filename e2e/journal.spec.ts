import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Payroll journal (Phase 4 task 20): payroll settings → accounting — the journal's accounts and a cost center —
 * then the journal of an approved payroll: debit equals credit, and an ERPNext Journal Entry file is made and listed.
 * (The demo's approved payroll is January 2025's, locked by the payslips spec.) */
test("the journal of an approved payroll for ERPNext", async ({ browser }) => {
  const code = `E2E ${Date.now()} - CC`;
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/payroll?tab=accounting");
  const accounts = admin.getByRole("region", { name: "حسابات قيد الرواتب" });
  await accounts.locator('input[name="erp_company"]').fill("Cactus Co");
  await accounts.locator('input[name="payable_account"]').fill("2110 - Salaries Payable - CC");
  await accounts.locator('input[name="gosi_payable_account"]').fill("2120 - GOSI Payable - CC");
  await accounts.locator('input[name="expense_account"]').fill("5100 - Salaries - CC");
  await accounts.locator('input[name="deduction_account"]').fill("5100 - Salaries - CC");
  await accounts.getByRole("button", { name: "حفظ" }).click();
  await expect(accounts).toContainText("تم الحفظ.");

  const centers = admin.getByRole("region", { name: "مراكز التكلفة" });
  await centers.getByRole("button", { name: "إضافة مركز تكلفة" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.locator('input[name="code"]').fill(code);
  await dialog.locator('input[name="name_ar"]').fill("مركز اختبار");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(centers).toContainText(code);

  await admin.goto("/payroll?month=2025-01&currency=SAR");
  await admin.getByRole("button", { name: "القيد المحاسبي" }).click();
  const journal = admin.getByRole("dialog");
  const totals = journal.getByRole("status");
  await expect(totals).toContainText("مدين");
  const amounts = await totals.locator("span.font-semibold").allInnerTexts();
  expect(amounts[0]).toBe(amounts[1]); // debit = credit
  await journal.getByRole("button", { name: "إعداد الملف" }).click();
  await expect(journal.getByRole("row").filter({ hasText: "erpnext_csv" }).first()).toBeVisible();
});
