import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** The devices screen (Phase 3 task 12), after the cloud-connector spec has read the mock servers: the header's
 * "last sync" pill, the sync log with its filters, each connection's terminals, and the people mapping imported from
 * Excel (a test person not linked to anyone: added on the first run, unchanged after). */
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const CONNECTION = "BioTime السحابي (اختبار آلي)";

test("HR reads the sync log, the terminals and the header's last sync", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance?tab=devices");
  await expect(hr.getByRole("status").filter({ hasText: /آخر مزامنة|لم تصل بصمات/ })).toBeVisible();

  const log = hr.getByRole("region", { name: "سجل المزامنة" });
  await expect(log.getByRole("table", { name: "سجل المزامنة" })).toContainText(CONNECTION);
  await log.locator('select[name="trigger"]').selectOption("manual");
  await expect(log.getByRole("table").getByRole("row").nth(1)).toContainText("قراءة يدوية");

  const row = hr.getByRole("list", { name: "روابط أجهزة البصمة" }).getByRole("listitem").filter({ hasText: CONNECTION });
  await row.getByRole("button", { name: "الأجهزة" }).click();
  const terminals = hr.getByRole("dialog", { name: `أجهزة ${CONNECTION}` });
  await expect(terminals).toContainText("Main entrance");
  await expect(terminals).toContainText("آخر بصمة");
});

test("HR maps device people to employees from Excel", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance?tab=devices");
  await hr.getByRole("button", { name: "استيراد الربط من Excel" }).click();
  await expect(hr).toHaveURL("/attendance/import-people");
  const [template] = await Promise.all([hr.waitForEvent("download"), hr.getByRole("button", { name: "تنزيل النموذج" }).click()]);
  expect(template.suggestedFilename()).toMatch(/^device_users-template-.*\.xlsx$/);
  await hr.locator('input[type="file"]').setInputFiles(fixture("device-people.xlsx"));
  await hr.getByRole("button", { name: "فحص الملف" }).click();
  await expect(hr.getByText("جاهز للاستيراد").first()).toBeVisible({ timeout: 20_000 });
  await hr.getByRole("button", { name: /^استيراد/ }).last().click();
  await expect(hr.getByText("تم الاستيراد.")).toBeVisible({ timeout: 20_000 });
});
