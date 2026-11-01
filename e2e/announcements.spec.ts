import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const OUT = process.env.SHOT_DIR;

/** Announcements (Phase 6 task 20): employee@ sees the pinned policy and their department's news on the dashboard,
 * opens the policy and confirms reading it (a later run finds it confirmed); HR sees who read and confirmed it. */
test("an employee reads and confirms an announcement, HR sees the receipts", async ({ browser }) => {
  test.setTimeout(120_000);
  const employee = await signedIn(browser, "employee@cactus.localhost");
  const widget = employee.getByRole("region", { name: "الإعلانات" });
  await expect(widget).toContainText("تحديث سياسة العمل عن بعد");
  await expect(widget).toContainText("اجتماع الفريق الشهري");
  if (OUT) await employee.screenshot({ path: `${OUT}/announcements-widget.png`, fullPage: true });
  await widget.getByRole("link", { name: /تحديث سياسة العمل عن بعد/ }).click();
  await expect(employee.getByRole("heading", { level: 1 })).toHaveText("تحديث سياسة العمل عن بعد");
  const confirm = employee.getByRole("button", { name: "اطّلعت على الإعلان" });
  if (await confirm.isVisible()) await confirm.click();
  await expect(employee.getByRole("status")).toContainText("أكّدت الاطلاع");

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/announcements");
  await hr.getByRole("link", { name: "تحديث سياسة العمل عن بعد" }).click();
  const receipts = hr.getByRole("region", { name: "الاطلاع" });
  await expect(receipts).toContainText(/أكّده [1-9]/);
  await expect(receipts).not.toContainText("employee@cactus.localhost"); // confirmed: not among those still to
});
