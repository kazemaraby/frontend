import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Payroll settings (Phase 4 task 1): the tenant admin reads the payroll rules (daily wage ÷ 30, pay day 27), gives the
 * company its own pay day and takes it back, and sees the Labor Law's payroll numbers with their article and the
 * "to confirm" mark. */
test("the payroll rules and the Labor Law's payroll numbers", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings");
  await admin.getByRole("main").getByRole("link", { name: /قواعد الرواتب وأرقام نظام العمل/ }).click();
  await expect(admin).toHaveURL("/settings/payroll");

  const rules = admin.getByRole("table", { name: "قواعد الرواتب" });
  await expect(rules.getByRole("row", { name: /الأجر اليومي = الأجر الشهري ÷/ })).toContainText("30");
  const payDay = rules.getByRole("row", { name: /يوم صرف الرواتب من الشهر/ });
  await expect(payDay).toContainText("27");
  await payDay.getByRole("textbox", { name: /هذه الشركة/ }).fill("25");
  await admin.getByRole("button", { name: "حفظ قيم الشركة" }).click();
  await expect(payDay.getByRole("cell").last()).toHaveText("25");
  await payDay.getByRole("textbox", { name: /هذه الشركة/ }).fill("");
  await admin.getByRole("button", { name: "حفظ قيم الشركة" }).click();
  await expect(payDay.getByRole("cell").last()).toHaveText("27"); // back to the account's value

  await admin.getByRole("tab", { name: "قيم نظام العمل" }).click();
  const labor = admin.getByRole("table", { name: "أرقام نظام العمل للرواتب" });
  const cap = labor.getByRole("row", { name: /الاستقطاعات حتى/ });
  await expect(cap).toContainText("المادة 92");
  await expect(cap).toContainText("للتأكيد");
  await expect(cap.getByRole("cell").last()).toHaveText("50");
  await expect(labor.getByRole("row", { name: /الاستقالة: ثلثا المكافأة حتى/ })).toContainText("المادة 85");
});
