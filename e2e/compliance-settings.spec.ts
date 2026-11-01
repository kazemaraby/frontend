import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Compliance settings (Phase 5 task 0): the rules' numbers seeded "to confirm" with their sources, a Nitaqat activity
 * and a band threshold entered from the ministry's tables, and the company's practice. */
test("compliance settings: dated rules, Nitaqat thresholds, practice", async ({ browser }) => {
  const code = `E2E-${Date.now()}`;
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/compliance");
  const rules = admin.getByRole("region", { name: "أرقام القواعد النظامية" });
  const fullWage = rules.getByRole("row").filter({ hasText: "يُحتسب السعودي واحدًا من أجر (ريال)" });
  await expect(fullWage).toContainText("4,000");
  await expect(fullWage).toContainText("للتحقق");

  await admin.getByRole("tab", { name: "نطاقات" }).click();
  await admin.getByRole("button", { name: "إضافة نشاط" }).click();
  const activity = admin.getByRole("dialog");
  await activity.locator('input[name="code"]').fill(code);
  await activity.locator('input[name="name_ar"]').fill("نشاط اختبار");
  await activity.getByRole("button", { name: "حفظ" }).click();
  await expect(activity).toBeHidden();

  await admin.getByRole("button", { name: "إضافة حد" }).click();
  const threshold = admin.getByRole("dialog");
  await threshold.locator('select[name="activity"]').selectOption({ label: `${code} — نشاط اختبار` });
  await threshold.locator('input[name="m"]').fill("1.5");
  await threshold.locator('input[name="c"]').fill("12");
  await threshold.locator('input[name="valid_from"]').fill("2026-01-01");
  await threshold.getByRole("button", { name: "حفظ" }).click();
  await expect(threshold).toBeHidden();
  await expect(admin.getByRole("region", { name: "حدود النطاقات" }).getByRole("row").filter({ hasText: code })).toContainText("1.5 × ln(n) + 12");

  await admin.getByRole("tab", { name: "ممارسات المنشأة" }).click();
  await expect(admin.getByRole("region", { name: "ممارسات المنشأة" })).toContainText("تأشيرات الخروج والعودة التي تدفعها المنشأة");
});
