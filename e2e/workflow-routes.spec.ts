import { expect, type Page, test } from "@playwright/test";

import { signIn } from "./helpers";

/** The route builder (/settings/workflows) on the cactus demo tenant: preview who approves, build a company route
 * with a role step, preview the draft, save it, see it tried first, delete it. */

async function previewFor(page: Page, name: string) {
  await page.getByRole("searchbox", { name: "ابحث عن موظف" }).fill(name);
  const select = page.locator('select[name="preview_employee"]');
  await expect(select.locator("option", { hasText: name })).toHaveCount(1);
  await select.selectOption({ label: (await select.locator("option", { hasText: name }).textContent())! });
  await page.getByRole("button", { name: "عرض المعتمدين" }).click();
  return page.getByRole("region", { name: "نتيجة المعاينة" });
}

test("HR builds a route, previews its approvers and removes it", async ({ page }) => {
  test.setTimeout(60_000);
  const name = `مسار اختبار ${Date.now()}`;
  await signIn(page, "hr@cactus.localhost");

  await page.goto("/settings");
  await page.getByRole("link", { name: /مسارات الاعتماد/ }).click();
  await expect(page.getByRole("list", { name: "المسارات" }).getByText("المسار الافتراضي")).toBeVisible();
  await page.goto("/settings/workflows?type=leave.request"); // the routes of leave requests (the list has many types)
  await expect(page.getByRole("list", { name: "المسارات" }).getByText("المسار الافتراضي")).toBeVisible();

  // Today: Ruya's request goes to her manager Khairy first.
  const today = await previewFor(page, "رؤيا");
  await expect(today).toContainText("خيري العمولي");

  // A company route straight to HR.
  await page.getByRole("button", { name: "مسار جديد" }).click();
  await page.locator('input[name="name_ar"]').fill(name);
  await page.locator('input[name="priority"]').fill(String(1 + (Date.now() % 30000)));
  await page.locator('input[name="step-0-name_ar"]').fill("اعتماد الموارد البشرية");
  await page.locator('select[name="step-0-approver"]').selectOption("role");
  await page.locator('select[name="step-0-role"]').selectOption({ label: "مدير الموارد البشرية" });
  const draft = await previewFor(page, "رؤيا");
  await expect(draft).toContainText("هذا المسار ينطبق");
  await expect(draft).toContainText("سارة القحطاني");

  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page).toHaveURL(/\/settings\/workflows\?type=/);
  const routes = page.getByRole("list", { name: "المسارات" });
  await expect(routes.getByRole("listitem").first()).toContainText(name); // the company's own route is tried first
  await expect(routes.getByRole("listitem").first()).toContainText("هذه الشركة");

  await routes.getByRole("button", { name: `حذف ${name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف", exact: true }).click();
  await expect(routes.getByText(name)).toHaveCount(0);
});
