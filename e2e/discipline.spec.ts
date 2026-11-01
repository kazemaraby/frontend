import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Disciplinary actions (Phase 4 task 10): HR files a written warning about an employee from the discipline tab of
 * their file — the regulation's penalty for the time is filled in, the hearing (Art. 71) is required — sees it
 * waiting, then withdraws it from their own requests. */
test("HR files a disciplinary action after hearing the employee", async ({ browser }) => {
  const what = `زوار في مكان العمل ${Date.now()}`;
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("رؤيا حاوي");
  await hr.getByRole("button", { name: "عرض ملف رؤيا حاوي" }).click();
  await hr.getByRole("tab", { name: "الجزاءات" }).click();
  await hr.getByRole("button", { name: "رفع جزاء" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('select[name="violation"]').selectOption({ label: "استقبال زائرين في غير أمور عمل المنشأة في أماكن العمل دون إذن من الإدارة" });
  await expect(dialog).toContainText("الجزاء في اللائحة");
  await dialog.locator('textarea[name="description"]').fill(what);
  await dialog.locator('select[name="penalty_type"]').selectOption("warning");
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog.locator('textarea[name="statement"]').locator("..")).toContainText("المادة 71"); // no statement yet
  await dialog.locator('textarea[name="statement"]').fill("لم أعلم بالتعليمات");
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();
  const row = hr.getByRole("row").filter({ hasText: what });
  await expect(row).toContainText("بانتظار الاعتماد");

  await hr.goto("/requests");
  const mine = hr.getByRole("row").filter({ hasText: "إنذار كتابي" }).filter({ hasText: "بانتظار" }).first();
  await mine.getByRole("button").first().click();
  const detail = hr.getByRole("dialog");
  await expect(detail).toContainText(what);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
