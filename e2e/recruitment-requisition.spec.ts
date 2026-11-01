import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Manpower requisition (Phase 6 task 1): manager@ asks for three people in their department — the form shows the
 * headcount budget check and the Nitaqat band before and after — and sends it; it waits for HR, who sees it with the
 * budget line and the demo budget in its tab; then manager@ withdraws it so test requests don't pile up. */
test("a requisition shows its budget and Nitaqat effect, and goes for approval", async ({ browser }) => {
  test.setTimeout(120_000);
  const start = new Date();
  start.setDate(start.getDate() + 40);
  const note = `e2e ${Date.now()}`;

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/recruitment");
  await manager.getByRole("button", { name: "طلب توظيف", exact: true }).click();
  const form = manager.getByRole("dialog");
  await form.locator('select[name="department"]').selectOption({ label: "تطوير البرمجيات" });
  await form.locator('select[name="job_title"]').selectOption({ index: 1 });
  await form.locator('input[name="positions"]').fill("3");
  await form.locator('input[name="target_start"]').fill(start.toLocaleDateString("en-CA"));
  await form.locator('input[name="basic_min"]').fill("7000");
  await form.locator('input[name="basic_max"]').fill("9000");
  await form.locator('input[name="housing"]').fill("1750");
  await form.locator('textarea[name="justification"]').fill(note);
  const effect = form.getByRole("region", { name: "أثر الطلب" });
  await expect(effect).toContainText(/ضمن الميزانية|تتجاوز الميزانية/);
  await expect(effect).toContainText("في الإدارة");
  await expect(effect).toContainText(/يحافظ على النطاق|يخفض النطاق|لم يُحسب/);
  await form.getByRole("button", { name: "إرسال" }).click();
  await expect(form).toBeHidden();
  const mine = manager.getByRole("region", { name: "طلبات التوظيف" }).getByRole("row").filter({ hasText: "تطوير البرمجيات" }).filter({ hasText: "3" });
  await expect(mine.first()).toContainText("بانتظار الموافقة");

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=budgets");
  await expect(hr.getByRole("region", { name: "ميزانية القوى العاملة" }).getByRole("row").filter({ hasText: "تطوير البرمجيات" })).toBeVisible();
  await hr.goto("/approvals");
  await expect(hr.getByRole("row").filter({ hasText: /طلب توظيف: .* × 3 · تطوير البرمجيات/ }).first()).toBeVisible();

  await manager.goto("/approvals?tab=mine");
  const request = manager.getByRole("row").filter({ hasText: /طلب توظيف: .* × 3 · تطوير البرمجيات/ }).first();
  await request.getByRole("button").first().click();
  const detail = manager.getByRole("dialog");
  await expect(detail).toContainText(note);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
