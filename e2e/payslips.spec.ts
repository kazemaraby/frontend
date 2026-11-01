import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Payslips (Phase 4 task 13): January 2025's payroll is made and approved once (approval locks it for good, so
 * later runs find it locked), its payslips are published, and the employee opens theirs from "قسائم راتبي" through
 * a signed link. */
const MONTH = "2025-01";

test("a locked payroll's payslips reach the employee", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto(`/payroll?month=${MONTH}`);
  const publish = admin.getByRole("button", { name: /نشر القسائم/ });
  await expect(admin.getByText(/لا يوجد مسير لهذا الشهر|حالة المسير/).first()).toBeVisible(); // the page has loaded
  if (!(await publish.isVisible())) {
    const remove = admin.getByRole("button", { name: "حذف المسير" });
    if (await remove.isVisible()) {
      await remove.click(); // left by an interrupted run
      await expect(admin.getByText("لا يوجد مسير لهذا الشهر")).toBeVisible();
    }
    await admin.getByRole("button", { name: "مسير رواتب جديد" }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "إنشاء واحتساب" }).click();
    await expect(admin.getByText("محتسب", { exact: true })).toBeVisible({ timeout: 30_000 });
    await admin.getByRole("button", { name: "إرسال للاعتماد" }).click();
    await expect(admin.getByText("المسير قيد الاعتماد", { exact: false })).toBeVisible();

    const hr = await signedIn(browser, "hr@cactus.localhost");
    await hr.goto("/approvals");
    const row = hr.getByRole("row").filter({ hasText: `مسير رواتب ${MONTH}` });
    await row.getByRole("button", { name: "موافقة", exact: true }).click();
    await hr.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
    await expect(hr.getByRole("dialog")).toBeHidden();
    await admin.reload();
  }
  await expect(admin.getByText("معتمد ومقفل").first()).toBeVisible();
  await publish.click();
  await expect(admin.getByRole("button", { name: /إعادة نشر القسائم/ })).toBeVisible({ timeout: 30_000 });

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/requests");
  await employee.getByRole("link", { name: "قسائم راتبي" }).click();
  await expect(employee).toHaveURL("/payslips");
  const slip = employee.getByRole("row").filter({ hasText: "يناير 2025" });
  const link = employee.waitForResponse((r) => /\/api\/v1\/payslips\/\d+\/download/.test(r.url()));
  const tab = employee.context().waitForEvent("page");
  await slip.getByRole("button", { name: "قسيمة يناير 2025" }).click();
  expect((await link).status()).toBe(200);
  await (await tab).close();
});
