import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Phase 1 task 14: global search (#7), org chart (#37), company setup and branding (#15, #18). */
// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const searchBox = (page: Page) => page.getByRole("combobox", { name: "بحث" });

test("the top-bar search finds what the user may see and opens it", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await searchBox(hr).fill("كافي");
  await expect(hr.getByRole("option", { name: /^كافي مروان/ })).toBeVisible();
  await searchBox(hr).press("Enter");
  await expect(hr).toHaveURL(/\/employees\/\d+$/);
  await expect(hr.getByRole("heading", { level: 1 })).toHaveText("كافي مروان");

  // A line manager does not find someone outside their team.
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await searchBox(manager).fill("عالية");
  await expect(manager.getByRole("listbox")).toContainText("لا توجد نتائج");
  await searchBox(manager).fill("كافي");
  await expect(manager.getByRole("option", { name: /^كافي مروان/ })).toBeVisible();
});

test("the org chart shows departments and reporting lines", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/org-chart");
  await expect(hr.getByRole("heading", { level: 1 })).toHaveText("الهيكل التنظيمي");
  const departments = hr.getByRole("tree", { name: "الإدارات" });
  await expect(departments.getByRole("treeitem").first()).toBeVisible();

  await hr.getByRole("tab", { name: "التسلسل الإداري" }).click();
  const lines = hr.getByRole("tree", { name: "التسلسل الإداري" });
  // EMP-003 (Kafi) reports to EMP-002: he sits inside EMP-002's branch of the tree.
  const boss = lines.getByRole("treeitem").filter({ has: hr.getByRole("link", { name: /^خيري/ }) }).first();
  await expect(boss.getByRole("link", { name: /كافي مروان/ })).toBeVisible();
  await boss.getByRole("link", { name: /كافي مروان/ }).click();
  await expect(hr).toHaveURL(/\/employees\/\d+$/);
});

test("the tenant admin sets up the company: logo in the switcher, a branch, a department", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings");
  await admin.getByRole("link", { name: /إعداد الشركة/ }).click();
  await expect(admin).toHaveURL("/settings/setup");
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText("إعداد الشركة");

  await admin.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await admin.getByRole("button", { name: "حفظ" }).click();
  await expect(admin.getByText("تم الحفظ.")).toBeVisible();
  const logo = admin.getByRole("button", { name: /^تبديل الشركة أو الفرع/ }).locator("img");
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((img) => (img as unknown as { naturalWidth: number }).naturalWidth)).toBeGreaterThan(0); // it loads

  const suffix = Date.now().toString().slice(-6);
  await admin.getByRole("button", { name: "التالي" }).click(); // branches
  await admin.getByLabel("اسم الفرع (عربي)").fill(`فرع الدمام ${suffix}`);
  await admin.getByRole("button", { name: "إضافة" }).click();
  await expect(admin.getByRole("row").filter({ hasText: `فرع الدمام ${suffix}` })).toBeVisible();

  await admin.getByRole("button", { name: "التالي" }).click(); // departments
  await admin.getByLabel("اسم الإدارة (عربي)").fill(`الجودة ${suffix}`.replace(/\d/g, ""));
  await admin.getByLabel("الرمز").fill(`Q${suffix}`);
  await admin.getByRole("button", { name: "إضافة" }).click();
  await expect(admin.getByRole("row").filter({ hasText: `Q${suffix}` })).toBeVisible();

  await admin.getByRole("button", { name: "التالي" }).click(); // employees
  await expect(admin.getByRole("button", { name: "استيراد من Excel" })).toBeVisible();
});

test("HR manages job titles in settings; one in use cannot be deleted", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/settings");
  await expect(hr.getByRole("link", { name: /إعداد الشركة/ })).toHaveCount(0); // company setup is the admin's
  await hr.getByRole("link", { name: /المسميات والدرجات/ }).click();
  await expect(hr).toHaveURL("/settings/master-data");

  const code = `qa-${Date.now().toString().slice(-6)}`;
  await hr.getByRole("button", { name: "إضافة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.getByLabel("الرمز").fill(code);
  await dialog.getByLabel("الاسم (عربي)").fill("محلل جودة");
  await dialog.getByLabel("رمز المهنة (قوى / التأمينات)").fill("251201");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const row = hr.getByRole("row").filter({ hasText: code });
  await expect(row).toContainText("251201");
  await row.getByRole("button", { name: "حذف محلل جودة" }).click();
  await expect(row).toHaveCount(0); // not used by anyone: deleted

  // The CTO title is used by employees: refused, with the reason.
  const used = hr.getByRole("row").filter({ hasText: "cto" });
  await used.getByRole("button", { name: /^حذف/ }).click();
  await expect(hr.getByRole("alert")).toBeVisible();
  await expect(used).toHaveCount(1);
});
