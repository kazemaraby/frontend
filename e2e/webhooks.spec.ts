import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Webhooks (Phase 6 task 22): the tenant admin adds an endpoint (the signing secret shown once), sends a test ping
 * — here to a local address that refuses it (4xx), so the screen shows it didn't arrive — and sees it in the log; then
 * turns the endpoint off. (Dev allows http and local addresses; production only public https ones.) */
test("an endpoint is added, tested, logged and turned off", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/api?tab=webhooks");
  const card = admin.getByRole("region", { name: "الإشعارات البرمجية (Webhooks)" });
  await card.getByRole("button", { name: "عنوان جديد" }).click();
  const dialog = admin.getByRole("dialog", { name: "عنوان جديد" });
  const name = `ERP ${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(name);
  await dialog.locator('input[name="url"]').fill("http://127.0.0.1:8000/api/v1/health");
  await dialog.getByRole("checkbox", { name: /employee\.created/ }).check();
  await dialog.getByRole("group").nth(1).getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: "إضافة العنوان" }).click();
  const secret = admin.getByRole("dialog", { name: new RegExp(name) });
  await expect(secret.locator('input[name="webhook_secret"]')).toHaveValue(/^whsec_/);
  await secret.getByRole("button", { name: "نسخته" }).click();

  const row = card.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "تجربة" }).click();
  await expect(card.getByRole("status")).toContainText("لم يصل الحدث التجريبي");
  await row.getByRole("button", { name: "السجل" }).click();
  const log = admin.getByRole("dialog", { name: new RegExp(`سجل الإرسال: ${name}`) });
  await expect(log).toContainText("ping");
  await expect(log).toContainText(/HTTP 4\d\d/);
  await admin.keyboard.press("Escape");
  await row.getByRole("button", { name: "إيقاف" }).click();
  await expect(row).toContainText("متوقف");
});
