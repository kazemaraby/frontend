import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4 e2e CV");

/** The pipeline (Phase 6 task 3): a visitor applies to the demo opening and agrees to the talent pool; HR finds the
 * card in "Applied" on the board, opens it (answers, CV link), moves it to screening and rejects it with a reason and
 * an e-mail; the history shows each move; the candidate is in the talent pool. */
test("HR moves an application through the pipeline and finds the candidate in the talent pool", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const name = `مرشح ${Date.now()}`;
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=openings");
  const href = await hr.getByRole("region", { name: "الوظائف الشاغرة" }).getByRole("row").filter({ hasText: "منشورة" }).first().getByRole("link", { name: "صفحة الوظيفة" }).getAttribute("href");

  await page.goto(new URL(href!).pathname);
  const form = page.getByRole("region", { name: "التقديم على الوظيفة" });
  await form.locator('input[name="full_name"]').fill(name);
  await form.locator('input[name="email"]').fill(`pipeline-${Date.now()}@example.com`);
  await form.locator('input[name="phone"]').fill(`055${String(Date.now()).slice(-7)}`);
  await form.locator('input[name="answer_q1"]').fill("5");
  await form.locator('select[name="answer_q2"]').selectOption("no");
  await form.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByLabel(/قرأت إشعار الخصوصية/).check();
  await form.getByLabel(/الاحتفاظ ببياناتي/).check();
  await form.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("وصلنا طلبك");

  await hr.goto("/recruitment?tab=pipeline");
  const applied = hr.getByRole("region", { name: "تقدّم", exact: true });
  await applied.getByRole("button", { name: new RegExp(name) }).click();
  const dialog = hr.getByRole("dialog");
  await expect(dialog.getByRole("region", { name: "إجابات أسئلة الفرز" })).toContainText("5");
  await expect(dialog.getByRole("button", { name: "السيرة الذاتية" })).toBeVisible();
  const moveTo = async (stage: string, extra?: () => Promise<void>) => {
    await dialog.locator('select[name="stage"]').selectOption({ label: stage });
    await extra?.();
    await dialog.getByRole("button", { name: "نقل", exact: true }).click();
  };
  await moveTo("الفرز");
  await expect(dialog.getByRole("region", { name: "سجل المراحل" })).toContainText("الفرز");
  await moveTo("مرفوض", async () => {
    await dialog.locator('select[name="reason"]').selectOption({ label: "لا يستوفي المتطلبات" });
  });
  const history = dialog.getByRole("region", { name: "سجل المراحل" });
  await expect(history).toContainText("لا يستوفي المتطلبات");
  await expect(history).toContainText("أُبلغ بالبريد");
  await dialog.getByRole("button", { name: /إغلاق/ }).first().click();
  await expect(hr.getByRole("region", { name: "مرفوض", exact: true }).getByRole("button", { name: new RegExp(name) })).toBeVisible();

  await hr.goto("/recruitment?tab=pool");
  const pool = hr.getByRole("region", { name: "المرشحون" });
  await pool.getByRole("searchbox").fill(name);
  await expect(pool.getByRole("row").filter({ hasText: name })).toContainText("مرفوض");
});
