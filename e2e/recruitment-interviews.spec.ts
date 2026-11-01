import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4 e2e CV");

/** Interviews (Phase 6 task 4): a visitor applies; HR schedules an interview with manager@ (who has no recruitment
 * role beyond the line manager's) using the demo scorecard; the application moves to "interview"; manager@ finds it on
 * "My interviews" with the calendar file, and the demo interview held yesterday shows its scorecard form; HR cancels
 * the new interview again so test interviews don't pile up. */
test("HR schedules an interview and the interviewer finds it with its scorecard", async ({ browser, page }) => {
  test.setTimeout(150_000);
  const name = `مرشح مقابلة ${Date.now()}`;
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=openings");
  const href = await hr.getByRole("region", { name: "الوظائف الشاغرة" }).getByRole("row").filter({ hasText: "منشورة" }).first().getByRole("link", { name: "صفحة الوظيفة" }).getAttribute("href");
  await page.goto(new URL(href!).pathname);
  const form = page.getByRole("region", { name: "التقديم على الوظيفة" });
  await form.locator('input[name="full_name"]').fill(name);
  await form.locator('input[name="email"]').fill(`interview-${Date.now()}@example.com`);
  await form.locator('input[name="phone"]').fill(`055${String(Date.now()).slice(-7)}`);
  await form.locator('input[name="answer_q1"]').fill("4");
  await form.locator('select[name="answer_q2"]').selectOption("yes");
  await form.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByLabel(/قرأت إشعار الخصوصية/).check();
  await form.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("وصلنا طلبك");

  await hr.goto("/recruitment?tab=pipeline");
  await hr.getByRole("region", { name: "تقدّم", exact: true }).getByRole("button", { name: new RegExp(name) }).click();
  const dialog = hr.getByRole("dialog", { name });
  await dialog.getByRole("button", { name: "جدولة مقابلة" }).click();
  const schedule = hr.getByRole("dialog", { name: "جدولة مقابلة" });
  const when = new Date();
  when.setDate(when.getDate() + 3);
  when.setHours(11, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  await schedule.locator('input[name="starts_at"]').fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T11:00`);
  await schedule.locator('select[name="template"]').selectOption({ label: "مقابلة فنية" });
  await schedule.locator('input[name="location"]').fill("قاعة الاختبار");
  await schedule.getByRole("searchbox").fill("manager");
  await schedule.getByRole("button", { name: /manager@cactus/ }).click();
  await expect(schedule.getByRole("list", { name: "المقابِلون" }).getByRole("listitem")).toHaveCount(1);
  await schedule.getByRole("button", { name: "حفظ وإرسال الدعوات" }).click();
  await expect(schedule).toBeHidden();
  const interviews = dialog.getByRole("region", { name: "المقابلات" });
  await expect(interviews).toContainText("مجدولة");
  await expect(dialog.getByRole("region", { name: "سجل المراحل" })).toContainText("المقابلة");

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/interviews");
  const mine = manager.getByRole("region", { name: new RegExp(name) });
  await expect(mine).toContainText("يُرسل التقييم بعد موعد المقابلة");
  const download = manager.waitForEvent("download");
  await mine.getByRole("button", { name: "إضافة إلى التقويم" }).click();
  expect((await download).suggestedFilename()).toMatch(/^interview-\d+\.ics$/);
  const held = manager.getByRole("region", { name: /مرشح للفرز/ });
  await expect(held.getByRole("region", { name: "تقييمي" }).or(held.getByRole("group", { name: "التقييمات" }))).toBeVisible();

  await interviews.getByRole("button", { name: "إلغاء المقابلة" }).click();
  await expect(interviews).toContainText("ملغاة");
});
