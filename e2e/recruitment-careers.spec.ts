import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4 e2e CV");

/** The careers page (Phase 6 task 2): a visitor (not signed in) finds the demo opening, answers its screening
 * questions, uploads a CV, agrees to the privacy notice and applies; HR sees the application counted on the
 * opening. HR also makes a draft opening from the approved requisition and deletes it again (nothing piles up). */
test("a visitor applies on the careers page and HR sees the application", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=openings");
  const openings = hr.getByRole("region", { name: "الوظائف الشاغرة" });
  const published = openings.getByRole("row").filter({ hasText: "منشورة" }).first();
  await expect(published).toBeVisible();
  const count = async () => Number(((await published.getByRole("cell").nth(4).textContent()) ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, ""));
  const before = await count();
  const href = await published.getByRole("link", { name: "صفحة الوظيفة" }).getAttribute("href");

  await page.goto("/careers");
  await expect(page.getByRole("heading", { name: "الوظائف المتاحة" })).toBeVisible();
  await page.goto(new URL(href!).pathname);
  const form = page.getByRole("region", { name: "التقديم على الوظيفة" });
  await form.locator('input[name="full_name"]').fill("زائر الاختبار");
  await form.locator('input[name="email"]').fill(`visitor-${Date.now()}@example.com`);
  await form.locator('input[name="phone"]').fill(`055${String(Date.now()).slice(-7)}`);
  await form.locator('select[name="nationality"]').selectOption("SA");
  await form.locator('input[name="answer_q1"]').fill("3");
  await form.locator('select[name="answer_q2"]').selectOption("yes");
  await form.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  const send = form.getByRole("button", { name: "إرسال الطلب" });
  await expect(send).toBeDisabled(); // not before agreeing to the privacy notice
  await form.getByLabel(/قرأت إشعار الخصوصية/).check();
  await send.click();
  await expect(page.getByRole("status")).toContainText("وصلنا طلبك");

  await hr.reload();
  await expect.poll(count).toBe(before + 1);

  await openings.getByRole("button", { name: "وظيفة شاغرة جديدة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('select[name="requisition"]').selectOption({ index: 1 });
  await dialog.locator('input[name="title_ar"]').fill("مسودة اختبار");
  await dialog.locator('textarea[name="description_ar"]').fill("وصف");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const draft = openings.getByRole("row").filter({ hasText: "مسودة اختبار" }).first();
  await expect(draft).toContainText("مسودة");
  await draft.getByRole("button", { name: /^حذف/ }).click();
  await expect(openings.getByRole("row").filter({ hasText: "مسودة اختبار" })).toHaveCount(0);
});
