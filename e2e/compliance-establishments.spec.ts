import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Establishments and how employees count (Phase 5 task 2): the company's establishment under its MHRSD number, an
 * employee marked as working flexibly and then set back, so the dev data keeps its state. */
test("establishments and the employees' compliance facts", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=establishments");
  const main = admin.getByRole("region", { name: "المنشآت" }).getByRole("row").filter({ hasText: "7-1234567" });
  await expect(main).toContainText("منشأة الشركة");

  await admin.getByRole("tab", { name: "الموظفون" }).click();
  const people = admin.getByRole("region", { name: "الموظفون وطريقة احتسابهم" });
  await people.getByRole("searchbox").fill("EMP-004");
  const row = people.getByRole("row").filter({ hasText: "EMP-004" });
  await expect(row).toContainText("7-1234567");
  await expect(row).toContainText("سعودي"); // the admin sees the nationality

  const toggle = async (on: boolean) => {
    await row.getByRole("button", { name: /^تعديل احتساب/ }).click();
    const dialog = admin.getByRole("dialog");
    const flexible = dialog.getByRole("checkbox", { name: "عمل مرن (بالساعة)" });
    if (on) {
      await flexible.check();
      await dialog.locator('input[name="flexible_hours"]').fill("96");
    } else await flexible.uncheck();
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();
  };
  await toggle(true);
  await expect(row).toContainText("مرن: 96 ساعة شهريًا");
  await toggle(false);
  await expect(row).not.toContainText("مرن");
});
