import { expect, test } from "@playwright/test";

/** Profile update requests (Phase 2 task 12): from their own file an employee (manager@: employee@ has the demo request waiting) asks to change the emergency
 * contact; it waits for HR in their requests; they withdraw it (the demo file stays the same). */
test("an employee asks HR to update their emergency contact", async ({ page }) => {
  const name = `خالد ${Date.now() % 100000}`;
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("manager@cactus.localhost");
  await page.locator('input[name="password"]').fill("ChangeMe-123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL("/");

  await page.goto("/me");
  await page.getByRole("button", { name: "تحديث بياناتي" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="emergency_contact_name"]').fill(name);
  await expect(dialog.getByRole("status")).toContainText("تغيير واحد");
  await dialog.getByRole("button", { name: "إرسال للاعتماد" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/requests");
  const row = page.getByRole("row").filter({ hasText: "تحديث بياناتي" }).filter({ hasText: "بانتظار الموافقة" }).first();
  await row.getByRole("button").first().click(); // the title opens the request
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText(name);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
