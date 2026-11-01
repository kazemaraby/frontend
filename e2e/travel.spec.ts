import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Business trips and air tickets (Phase 2 task 11): the employee's trip form shows the per diem from the company's
 * rates (demo: 600 SAR a day abroad), the request is sent and withdrawn; HR sees the rates and the ticket policy. */

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("an employee plans a business trip with its per diem, then withdraws it", async ({ page }) => {
  const start = new Date();
  start.setMonth(start.getMonth() + 8);
  start.setDate(start.getDate() + 7 * (Math.floor(Date.now() / 1000) % 10));
  const end = new Date(start);
  end.setDate(start.getDate() + 2);
  const purpose = `معرض تجاري ${Date.now()}`;

  await signIn(page, "employee@cactus.localhost");
  await page.goto("/requests");
  await page.getByRole("button", { name: /^طلب جديد/ }).click();
  await page.getByRole("button", { name: "رحلة عمل", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="start_date"]').fill(iso(start));
  await dialog.locator('input[name="end_date"]').fill(iso(end));
  await dialog.locator('select[name="country"]').selectOption("EG");
  await dialog.locator('input[name="city"]').fill("القاهرة");
  await dialog.locator('textarea[name="purpose"]').fill(purpose);
  await expect(dialog.getByRole("status")).toContainText("1,800"); // 3 days × 600
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "رحلة عمل" }).filter({ hasText: "بانتظار الموافقة" }).first();
  await row.getByRole("button").first().click(); // the title opens the request
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText(purpose);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});

test("HR sees the per diem rates and the ticket policy", async ({ page }) => {
  await signIn(page, "hr@cactus.localhost");
  await page.goto("/settings");
  await page.getByRole("link", { name: /بدلات السفر وتذاكر الطيران/ }).click();
  await expect(page.getByRole("textbox", { name: "كل الدرجات الأخرى · دول أخرى" })).toHaveValue("600.00");
  await expect(page.getByRole("list", { name: "سياسات تذاكر الطيران" })).toContainText("تذكرة كل 12 شهراً");
});
