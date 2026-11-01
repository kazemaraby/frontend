import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Mudad / WPS tracking (Phase 5 task 8): the admin records an upload to Mudad for the demo data's approved month
 * (August 2026) — the day, Mudad's reference, its result and a percentage below the 80 % threshold — and the month
 * shows as uploaded and below the threshold. The record is cleared at the end. */
test("WPS months: record an upload to Mudad and see the status", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=wps");
  const card = admin.getByRole("region", { name: "مدد / حماية الأجور" });
  // the row starts with its month (July's row also says "10 أغسطس 2026": its deadline)
  const august = card.getByRole("row", { name: /^أغسطس 2026 7-1234567/ });
  await expect(august).toBeVisible();
  const record = async (values: { day: string; reference: string; result: string; percent: string }) => {
    await august.getByRole("button", { name: /^تسجيل حماية الأجور/ }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.locator('input[name="uploaded_on"]').fill(values.day);
    await dialog.locator('input[name="mudad_reference"]').fill(values.reference);
    await dialog.locator('select[name="result"]').selectOption(values.result);
    await dialog.locator('input[name="mudad_percent"]').fill(values.percent);
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();
  };
  await record({ day: "2026-09-08", reference: "MD-E2E", result: "partial", percent: "75" });
  await expect(august).toContainText("مرفوع");
  await expect(august).toContainText("أقل من 80٪");
  await expect(august).toContainText("MD-E2E");
  await record({ day: "", reference: "", result: "", percent: "" }); // back as it was
  await expect(august).not.toContainText("MD-E2E");
});
