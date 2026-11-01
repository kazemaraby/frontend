import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const OUT = process.env.SHOT_DIR;

/** Training (Phase 6 task 19): employee@ sees their enrolment and asks for a course (a second run finds it already
 * asked: the request is listed either way); manager@ sees the nomination they made; HR sees the catalog with its
 * sessions, the enrolments with the records export, and the department budget with what is taken. */
test("asking for a course, nominations and HR's view", async ({ browser }) => {
  test.setTimeout(150_000);
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/training");
  await expect(employee.getByRole("region", { name: "دوراتي" })).toContainText("التميز في خدمة العملاء");
  await employee.getByRole("button", { name: "طلب دورة" }).first().click();
  const dialog = employee.getByRole("dialog", { name: "طلب دورة" });
  const course = dialog.locator('select[name="course"]');
  await course.selectOption((await course.locator("option").filter({ hasText: "السلامة المهنية" }).getAttribute("value")) ?? "");
  const session = dialog.locator('select[name="session"]');
  await session.selectOption({ index: 1 });
  await dialog.locator('textarea[name="reason"]').fill("متطلب لموقع العمل");
  const sent = employee.waitForResponse((r) => r.url().endsWith("/api/v1/training-requests") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "إرسال الطلب" }).click();
  if ((await sent).ok()) {
    await expect(dialog).toBeHidden();
  } else {
    await expect(dialog).toContainText("لدى هذا الموظف طلب أو تسجيل في هذه الدورة بالفعل."); // an earlier run asked
    await employee.keyboard.press("Escape");
  }
  await employee.getByRole("tab", { name: "طلبات التدريب" }).click();
  await expect(employee.getByRole("region", { name: "طلبات التدريب" }).getByRole("row").filter({ hasText: "السلامة المهنية" }).first()).toContainText("بانتظار الاعتماد");

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/training?tab=requests");
  await expect(manager.getByRole("region", { name: "طلبات التدريب" }).getByRole("row").filter({ hasText: "إكسل المتقدم" })).toContainText("رشّحه");

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.setViewportSize({ width: 1440, height: 1000 });
  await hr.goto("/training?tab=catalog");
  await expect(hr.getByRole("region", { name: "الدورات" }).getByRole("row").filter({ hasText: "السلامة المهنية" })).toContainText("مقعد");
  if (OUT) await hr.screenshot({ path: `${OUT}/training-catalog.png`, fullPage: true });
  await hr.getByRole("tab", { name: "المسجلون" }).click();
  const enrolled = hr.getByRole("region", { name: "المسجلون" });
  await expect(enrolled.getByRole("row").filter({ hasText: "التميز في خدمة العملاء" }).first()).toBeVisible();
  const xlsx = hr.waitForEvent("download");
  await enrolled.getByRole("button", { name: "تصدير Excel" }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/^training-.*\.xlsx$/);
  await hr.getByRole("tab", { name: "الميزانية" }).click();
  await expect(hr.getByRole("region", { name: "الميزانية" })).toContainText("15,000");
});
