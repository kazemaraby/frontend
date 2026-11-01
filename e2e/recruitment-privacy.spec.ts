import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4 e2e CV");

/** Candidates' data (Phase 6 task 7, PDPL): a visitor applies, then asks the careers page for a link to their data
 * (the answer is the same whether or not we hold any); HR sees the day the candidate's data will be erased and
 * erases it now (e.g. asked by phone); the candidate is gone from the list. The retention setting shows in Settings. */
test("a candidate asks for their data and HR erases it", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const name = `مرشح بيانات ${Date.now()}`;
  const email = `privacy-${Date.now()}@example.com`;
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=openings");
  const href = await hr.getByRole("region", { name: "الوظائف الشاغرة" }).getByRole("row").filter({ hasText: "منشورة" }).first().getByRole("link", { name: "صفحة الوظيفة" }).getAttribute("href");
  await page.goto(new URL(href!).pathname);
  const form = page.getByRole("region", { name: "التقديم على الوظيفة" });
  await form.locator('input[name="full_name"]').fill(name);
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="phone"]').fill(`055${String(Date.now()).slice(-7)}`);
  await form.locator('input[name="answer_q1"]').fill("2");
  await form.locator('select[name="answer_q2"]').selectOption("yes");
  await form.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByLabel(/قرأت إشعار الخصوصية/).check();
  await form.getByLabel(/الاحتفاظ ببياناتي/).check();
  await form.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("وصلنا طلبك");

  await page.getByRole("link", { name: "بياناتك لدينا" }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "أرسل الرابط" }).click();
  await expect(page.getByRole("status")).toContainText("إن كانت لدينا بيانات بهذا البريد");
  await page.goto("/careers/my-data/not-a-real-link");
  await expect(page.getByRole("alert")).toContainText("لم يعد صالحاً");

  await hr.goto("/recruitment?tab=pool");
  const pool = hr.getByRole("region", { name: "المرشحون" });
  await pool.getByRole("searchbox").fill(name);
  const row = pool.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText(String(new Date().getFullYear() + 2)); // kept 24 months after the last activity
  await row.getByRole("button", { name: "حذف البيانات" }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "حذف نهائي" }).click();
  await expect(pool.getByRole("row").filter({ hasText: name })).toHaveCount(0);

  await hr.goto("/recruitment?tab=settings");
  await expect(hr.getByRole("region", { name: "مدة الاحتفاظ ببيانات المرشحين" })).toContainText("24");
});
