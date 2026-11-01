import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Importing a portal file by hand (Phase 5 task 13): the admin downloads GOSI's test file (made from the dev
 * employees, development only) and the columns template, uploads the test file as a portal export, and reviews its
 * differences. Nothing is accepted: the review is where a person decides. */
test("a portal export uploaded by hand and reviewed", async ({ browser }) => {
  test.setTimeout(150_000); // the check runs on the Celery worker, which may still be busy with earlier tests' jobs
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=data");
  const read = admin.getByRole("region", { name: "قراءة ملف حكومي" });
  await read.locator('select[name="kind"]').selectOption({ label: "التأمينات: مشتركو المنشأة" });

  const template = admin.waitForEvent("download");
  await read.getByRole("button", { name: "تحميل نموذج الأعمدة" }).click();
  expect((await template).suggestedFilename()).toMatch(/^gosi_subscribers-template-.*\.xlsx$/);
  const sample = admin.waitForEvent("download");
  await read.getByRole("button", { name: "تحميل ملف تجريبي (بيئة التطوير)" }).click();
  const file = await (await sample).path();

  const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await read.locator('input[type="file"]').setInputFiles({ name: "gosi-subscribers.xlsx", mimeType: xlsx, buffer: readFileSync(file!) });
  await read.getByRole("button", { name: "رفع وفحص" }).click();
  const run = admin.getByRole("region", { name: "الملفات المقروءة" }).getByRole("row").filter({ hasText: "gosi-subscribers.xlsx" }).first();
  await expect(run).toContainText("جاهز", { timeout: 90_000 });
  await run.getByRole("button", { name: /^مراجعة/ }).click();
  const rows = admin.getByRole("table", { name: "الصفوف" });
  await expect(rows.getByRole("row").filter({ hasText: "مختلف" }).first()).toBeVisible(); // the test file's wage differences
  await expect(rows.getByRole("row").filter({ hasText: "2999999999" })).toContainText("ليس من موظفينا");
});
