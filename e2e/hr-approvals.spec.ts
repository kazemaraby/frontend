import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** HR's changes go through approval (Phase 2 task 4): HR asks to suspend an employee of manager@'s team, the manager
 * and then the administrator approve, and only then the status changes. Then the same way back (reinstate). */
const EMPLOYEE = "كافي مروان"; // EMP-003, reports to manager@

async function openFile(page: Page) {
  await page.goto("/employees");
  await page.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill(EMPLOYEE);
  await page.getByRole("button", { name: `عرض ملف ${EMPLOYEE}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(EMPLOYEE);
}

async function ask(hr: Page, action: string, note = "") {
  await openFile(hr);
  await hr.getByRole("button", { name: "تغيير الحالة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.getByLabel("الإجراء").selectOption({ label: action });
  if (note) await dialog.getByLabel("ملاحظة (مطلوبة)").fill(note);
  await dialog.getByRole("button", { name: "إرسال للاعتماد" }).click();
  await expect(dialog).toBeHidden();
}

async function approve(page: Page, title: RegExp) {
  await page.goto("/approvals");
  const row = page.getByRole("row").filter({ hasText: title });
  await row.getByRole("button", { name: "موافقة", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(row).toHaveCount(0);
}

test("a suspension waits for the manager and the administrator before it happens", async ({ browser }) => {
  test.setTimeout(90_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const manager = await signedIn(browser, "manager@cactus.localhost");
  const admin = await signedIn(browser, "qa@cactus.localhost");

  await ask(hr, "إيقاف عن العمل", "تحقيق إداري (اختبار)");
  const waiting = hr.getByRole("region", { name: "بانتظار الاعتماد" });
  await expect(waiting).toContainText("تغيير الحالة إلى «موقوف»");
  await expect(waiting).toContainText("المدير المباشر");
  await expect(hr.getByRole("heading", { level: 1 }).locator("..")).not.toContainText("موقوف");

  await approve(manager, new RegExp(`موقوف: ${EMPLOYEE}`));
  await approve(admin, new RegExp(`موقوف: ${EMPLOYEE}`)); // HR asked, so another approver decides the HR step

  await hr.reload();
  await expect(hr.getByRole("region", { name: "بانتظار الاعتماد" })).toHaveCount(0);
  await expect(hr.getByText("موقوف").first()).toBeVisible();

  // Back to work, the same way.
  await ask(hr, "إعادة إلى العمل");
  await approve(manager, new RegExp(`نشط: ${EMPLOYEE}`));
  await approve(admin, new RegExp(`نشط: ${EMPLOYEE}`));
  await hr.reload();
  await expect(hr.getByRole("region", { name: "بانتظار الاعتماد" })).toHaveCount(0);
});
