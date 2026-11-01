import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Exit re-entry visa (Phase 5 task 10): resident@ (EMP-006, a non-Saudi) asks for a single visa — the form shows who
 * pays and the fee — HR approves it, the compliance admin issues it in "Muqeem" with its number and dates, and the
 * employee is told. Approved visas stay, so each run picks its own dates; from the second run of a year the employee
 * pays, and pays directly. */
test("an exit re-entry visa is asked for, approved and issued", async ({ browser }) => {
  test.setTimeout(120_000);
  const iso = (d: Date) => d.toLocaleDateString("en-CA");
  const offset = 30 + (Math.floor(Date.now() / 1000) % 1500) * 5; // a different 5-day slot each second
  const leaving = new Date();
  leaving.setDate(leaving.getDate() + offset);
  const back = new Date(leaving);
  back.setDate(back.getDate() + 4);

  const resident = await signedIn(browser, "resident@cactus.localhost");
  await resident.goto("/requests");
  await resident.getByRole("button", { name: /^طلب جديد/ }).click();
  await resident.getByRole("button", { name: "تأشيرة خروج وعودة", exact: true }).click();
  const form = resident.getByRole("dialog");
  await form.locator('input[name="leave_on"]').fill(iso(leaving));
  await form.locator('input[name="back_on"]').fill(iso(back));
  const payer = form.getByText(/^هذه التأشيرة على المنشأة|^رسوم هذه التأشيرة عليك/);
  await expect(payer).toBeVisible();
  await expect(form).toContainText("الرسوم:");
  if ((await payer.textContent())?.startsWith("رسوم هذه التأشيرة عليك")) {
    await form.locator('select[name="pay_via"]').selectOption("direct");
  }
  await form.getByRole("button", { name: "إرسال" }).click();
  await expect(form).toBeHidden();

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/approvals");
  const row = hr.getByRole("row").filter({ hasText: "خروج وعودة مفردة: عالية بهجت" }).filter({ hasText: iso(leaving) });
  await row.getByRole("button", { name: "موافقة", exact: true }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(row).toHaveCount(0);

  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=muqeem");
  const toIssue = admin.getByRole("region", { name: "تأشيرات خروج وعودة بانتظار الإصدار" });
  const waiting = toIssue.getByRole("row").filter({ hasText: "عالية بهجت" }).first();
  await waiting.getByRole("button", { name: /^إصدار تأشيرة/ }).click();
  const issue = admin.getByRole("dialog");
  const number = `MQ-${Date.now()}`;
  await issue.locator('input[name="number"]').fill(number);
  await issue.locator('input[name="valid_until"]').fill(iso(back));
  await issue.getByRole("button", { name: "حفظ" }).click();
  await expect(issue).toBeHidden();
  await expect(admin.getByRole("region", { name: "التأشيرات" }).getByRole("row").filter({ hasText: number })).toContainText("صادرة");

  await resident.reload();
  await expect(resident.getByRole("button", { name: /^الإشعارات، [1-9]/ })).toBeVisible();
});
