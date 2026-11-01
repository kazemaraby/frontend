import { expect, test } from "@playwright/test";

import { emailedLink, signedIn } from "./helpers";

/** Settings → Users and roles: hr@ creates a user with the employee role over their own records; the new user chooses
 * a password through the e-mailed link (read from the development-only outbox), which then no longer works, and
 * signs in; hr@ turns the account off again (so runs don't use up the plan's users). The rules themselves (no giving
 * more than you have, no changing your own access, company isolation) are in tests/test_users_roles.py. */
test("HR creates a user who chooses a password and signs in", async ({ browser, page, request }) => {
  test.setTimeout(150_000);
  const stamp = Date.now();
  const email = `user-${stamp}@example.com`;

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/settings");
  await hr.getByRole("link", { name: /المستخدمون والأدوار/ }).click();
  await expect(hr).toHaveURL(/\/settings\/users$/);
  await hr.getByRole("button", { name: "مستخدم جديد" }).click();
  const dialog = hr.getByRole("dialog", { name: "مستخدم جديد" });
  await dialog.locator('input[name="full_name_ar"]').fill("مستخدم تجريبي");
  await dialog.locator('input[name="full_name_en"]').fill("Test User");
  await dialog.locator('input[name="email"]').fill(email);
  await dialog.getByRole("checkbox").first().check(); // the first company
  await dialog.locator('select[name="role"]').selectOption({ label: "موظف" });
  await dialog.locator('select[name="company"]').selectOption({ index: 1 });
  await dialog.locator('select[name="scope"]').selectOption("own");
  await dialog.getByRole("button", { name: "إنشاء وإرسال الدعوة" }).click();
  await expect(dialog).toBeHidden();
  const row = hr.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("بانتظار اختيار كلمة المرور");
  await expect(row).toContainText("موظف · سجله فقط");

  // the new user chooses a password through the link
  const link = await emailedLink(request, email, "accounts.invitation");
  await page.goto(link);
  await expect(page.getByText(email)).toBeVisible();
  await page.locator('input[name="password"]').fill("Strong-Pass-2026");
  await page.locator('input[name="password_again"]').fill("Strong-Pass-2026");
  await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await expect(page.getByRole("status")).toContainText("حُفظت كلمة المرور");
  await page.goto(link);
  await expect(page.getByRole("alert")).toContainText("انتهت صلاحية هذا الرابط"); // used once

  const person = await browser.newPage();
  await person.goto("/login");
  await person.locator('input[name="email"]').fill(email);
  await person.locator('input[name="password"]').fill("Strong-Pass-2026");
  await person.locator('button[type="submit"]').click();
  await expect(person).toHaveURL("/");

  // HR sees the account active, then turns it off
  await hr.reload();
  await expect(row).toContainText("مفعّل");
  await row.getByRole("button", { name: "إدارة" }).click();
  const manage = hr.getByRole("dialog", { name: "مستخدم تجريبي" });
  await manage.getByRole("button", { name: "إيقاف الحساب" }).click();
  await expect(manage.getByRole("button", { name: "تفعيل الحساب" })).toBeVisible();
});
