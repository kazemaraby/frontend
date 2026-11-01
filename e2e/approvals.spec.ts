import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** One request through the whole route: employee → line manager → HR → approved, with notifications on the way.
 * Uses the seed_demo users of the cactus tenant. */

const row = (page: Page, subject: string) => page.getByRole("row").filter({ hasText: subject });

/** Ends manager@'s delegations left over by a run that stopped half-way (they would send the tasks to IT). */
async function endLeftoverDelegations(manager: Page) {
  await manager.goto("/approvals");
  await manager.waitForLoadState("networkidle"); // the banner loads after the page
  const end = manager.getByRole("list", { name: "التفويضات" }).getByRole("button", { name: "إنهاء التفويض" });
  for (let left = await end.count(); left > 0; left -= 1) {
    await end.first().click();
    await expect(end).toHaveCount(left - 1); // wait for the list to refresh before the next one
  }
}

async function decide(page: Page, subject: string, button: "موافقة" | "إعادة" | "رفض", comment = "") {
  await page.goto("/approvals");
  await row(page, subject).getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (comment) await dialog.getByRole("textbox").fill(comment);
  await dialog.getByRole("button", { name: button === "إعادة" ? "إعادة للتعديل" : button, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, subject)).toHaveCount(0); // left my inbox
}

test("a request goes from the employee to the manager to HR and back to the employee", async ({ browser }) => {
  test.setTimeout(60_000);
  await endLeftoverDelegations(await signedIn(browser, "manager@cactus.localhost"));
  const subject = `شهادة خبرة ${Date.now()}`;

  // Employee submits.
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/approvals?tab=mine");
  await employee.getByRole("button", { name: /^طلب جديد/ }).click();
  await employee.getByRole("button", { name: "طلب عام", exact: true }).click();
  await employee.getByRole("dialog").locator('input[name="subject"]').fill(subject);
  await employee.getByRole("dialog").locator('textarea[name="details"]').fill("مطلوبة للسفارة");
  await employee.getByRole("dialog").getByRole("button", { name: "إرسال" }).click();
  await expect(row(employee, subject)).toContainText("بانتظار الموافقة");
  await expect(row(employee, subject)).toContainText("المدير المباشر");

  // Manager: the bell and the inbox show it; returning needs a reason.
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await expect(manager.getByRole("button", { name: /^الإشعارات، [1-9]/ })).toBeVisible();
  await manager.goto("/approvals");
  await row(manager, subject).getByRole("button", { name: "إعادة", exact: true }).click();
  await expect(manager.getByRole("dialog").getByRole("button", { name: "إعادة للتعديل" })).toBeDisabled();
  await manager.getByRole("dialog").getByRole("button", { name: "إلغاء" }).click();
  await decide(manager, subject, "موافقة");

  // HR approves last.
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await decide(hr, subject, "موافقة", "تمت المراجعة");

  // The employee is told, and the request shows its history.
  await employee.goto("/approvals?tab=mine");
  await expect(row(employee, subject)).toContainText("تمت الموافقة");
  await employee.getByRole("button", { name: /^الإشعارات/ }).click();
  await expect(employee.getByRole("button", { name: new RegExp(`تمت الموافقة على طلبك: ${subject}`) })).toBeVisible();
  await employee.getByRole("button", { name: new RegExp(`تمت الموافقة على طلبك: ${subject}`) }).click();
  const dialog = employee.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: subject })).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveCount(4); // submitted, approved, approved, all approvals done
});

test("a manager delegates their approvals and the delegate approves on their behalf", async ({ browser }) => {
  test.setTimeout(60_000);
  const subject = `تعريف بالراتب ${Date.now()}`;
  const today = new Date().toLocaleDateString("en-CA");

  // Manager delegates today's approvals to IT (ending any delegation left over from an earlier run).
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await endLeftoverDelegations(manager);
  const banner = manager.getByRole("list", { name: "التفويضات" });
  try {
    await manager.getByRole("button", { name: "تفويض اعتماداتي" }).click();
    const form = manager.getByRole("dialog");
    await form.getByRole("searchbox").fill("it@");
    await expect(form.locator('select[name="delegate"] option')).toHaveCount(2); // placeholder + IT
    await form.locator('select[name="delegate"]').selectOption({ index: 1 });
    await form.locator('input[name="end_date"]').fill(today);
    await form.getByRole("button", { name: "تفويض", exact: true }).click();
    await expect(form).toBeHidden();
    await expect(banner).toContainText("اعتماداتك تذهب إلى");

    // The employee's new request reaches IT on behalf of the manager.
    const employee = await signedIn(browser, "employee@cactus.localhost");
    await employee.goto("/approvals?tab=mine");
    await employee.getByRole("button", { name: /^طلب جديد/ }).click();
    await employee.getByRole("button", { name: "طلب عام", exact: true }).click();
    await employee.getByRole("dialog").locator('input[name="subject"]').fill(subject);
    await employee.getByRole("dialog").getByRole("button", { name: "إرسال" }).click();
    await expect(row(employee, subject)).toContainText("بانتظار الموافقة");

    const it = await signedIn(browser, "it@cactus.localhost");
    await it.goto("/approvals");
    await expect(it.getByRole("list", { name: "التفويضات" })).toContainText("تعتمد نيابةً عن");
    await expect(row(it, subject)).toContainText("نيابةً عن");
    await decide(it, subject, "موافقة");

    // The request now waits for HR: the employee withdraws it so test requests don't pile up.
    await employee.goto("/approvals?tab=mine");
    await row(employee, subject).getByRole("button").first().click();
    await employee.getByRole("dialog").getByRole("button", { name: "إلغاء الطلب" }).click();
    await expect(employee.getByRole("dialog")).toContainText("ملغى");

    // Ending the delegation clears the banner.
    await manager.reload();
    await banner.getByRole("button", { name: "إنهاء التفويض" }).click();
    await expect(banner).toBeHidden();
  } finally {
    // Even when a step above fails: a delegation left on would send every later test's approvals to IT.
    await endLeftoverDelegations(manager).catch(() => undefined);
  }
});
