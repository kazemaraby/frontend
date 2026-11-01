import { expect, type Page, test } from "@playwright/test";

import { nationalId, signedIn } from "./helpers";

/** Phase 1 employee file against the real backend (`seed_demo`, cactus tenant): create an employee with the
 * wizard, field groups hidden for a line manager, upload and open a document. */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

const inFuture = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function openFile(page: Page, name: string) {
  await page.goto("/employees");
  await page.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill(name);
  await page.getByRole("button", { name: `عرض ملف ${name}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

test("HR creates an employee with the wizard: identity, job and contract, salary, a document, hired", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const idNumber = nationalId();
  const family = `الاختبار${idNumber.slice(-4)}`;

  await hr.goto("/employees");
  await hr.getByRole("button", { name: "إضافة موظف" }).click();
  await expect(hr).toHaveURL("/employees/new");

  // 1. Identity: a mistyped ID is caught before the server.
  await hr.getByLabel("الاسم الأول (عربي)").fill("ريم");
  await hr.getByLabel("اسم العائلة (عربي)").fill(family);
  await hr.getByLabel("الجنسية").selectOption("SA");
  await hr.getByLabel("نوع الهوية").selectOption("national_id");
  await hr.getByLabel("رقم الهوية / الإقامة").fill(idNumber.slice(0, 9) + ((Number(idNumber[9]) + 1) % 10));
  await hr.getByRole("button", { name: "التالي" }).click();
  await expect(hr.getByText("رقم الهوية غير صحيح (خانة التحقق). تأكد منه.")).toBeVisible();
  await hr.getByLabel("رقم الهوية / الإقامة").fill(idNumber);
  await hr.getByLabel("الجوال").fill("0551234567");
  await hr.getByRole("button", { name: "التالي" }).click();

  // 2. Job and contract.
  await hr.getByLabel("نوع العقد").selectOption({ label: "غير محدد المدة" });
  await hr.locator('input[name="start_date"]').fill(inFuture(7));
  await hr.getByLabel("فترة التجربة (أيام)").fill("90");
  await hr.getByRole("button", { name: "التالي" }).click();

  // 3. Salary and bank.
  await hr.getByLabel("الراتب الأساسي").fill("9000");
  await hr.getByLabel("رقم الآيبان").fill("SA03 8000 0000 6080 1016 7519");
  await hr.getByRole("button", { name: "التالي" }).click();

  // 4. A document with its file.
  await hr.getByRole("button", { name: "إضافة وثيقة" }).click();
  await hr.getByLabel("نوع الوثيقة").selectOption("national_id");
  await hr.getByLabel("رقم الوثيقة").fill(idNumber);
  await hr.locator('input[name="expiry_date"]').fill(inFuture(900));
  await hr.locator('input[type="file"]').setInputFiles({ name: "هوية.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(hr.getByText("هوية.pdf")).toBeVisible();
  await hr.getByRole("button", { name: "التالي" }).click();

  // 5. Review and create: the contract is signed and the hiring sent for approval (the employee stays pending).
  await expect(hr.getByRole("checkbox", { name: /توقيع العقد وإرسال التعيين للاعتماد/ })).toBeChecked();
  await hr.getByRole("button", { name: "إضافة الموظف" }).click();
  await expect(hr).toHaveURL(/\/employees\/\d+$/);
  await expect(hr.getByRole("heading", { level: 1 })).toHaveText(`ريم ${family}`);
  const waiting = hr.getByRole("region", { name: "بانتظار الاعتماد" });
  await expect(waiting).toContainText("تغيير الحالة إلى «تم التعيين»");
  await expect(waiting.getByRole("link", { name: "فتح الطلب" })).toBeVisible();

  await hr.getByRole("tab", { name: "العقود" }).click();
  await expect(hr.getByText("ساري", { exact: true })).toBeVisible();
  await hr.getByRole("tab", { name: "الوثائق" }).click();
  await expect(hr.getByRole("row").filter({ hasText: "الهوية الوطنية" })).toBeVisible();

  // Withdraw the hiring so test requests don't pile up in the approvers' inboxes (the pending record stays).
  await hr.getByRole("tab", { name: "نظرة عامة" }).click();
  await waiting.getByRole("link", { name: "فتح الطلب" }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(hr.getByRole("dialog")).toContainText("ملغى");
});

test("a line manager sees a team member's file without personal data or salary; their own file has it", async ({ browser }) => {
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await openFile(manager, "كافي مروان"); // EMP-003 reports to manager@ (EMP-002)

  const tabs = manager.getByRole("tablist", { name: "أقسام ملف الموظف" });
  await expect(tabs.getByRole("tab", { name: "الوظيفة" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "الراتب والبنك" })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: "البيانات الشخصية" })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: "الوثائق" })).toHaveCount(0);
  await expect(manager.getByRole("button", { name: "تغيير الحالة" })).toHaveCount(0);

  await manager.goto("/me");
  await expect(manager.getByRole("heading", { level: 1 })).toHaveText(/^خيري /); // EMP-002, their own file
  await manager.getByRole("tab", { name: "الراتب والبنك" }).click();
  await expect(manager.getByText("الراتب الأساسي")).toBeVisible();
});

test("HR uploads a passport with a Hijri expiry date and opens it through a signed link", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await openFile(hr, "عالية بهجت");
  await hr.getByRole("tab", { name: "الوثائق" }).click();
  const number = `P${Date.now().toString().slice(-7)}`;

  await hr.getByRole("button", { name: "رفع وثيقة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.getByLabel("نوع الوثيقة").selectOption("passport");
  await dialog.getByLabel("رقم الوثيقة").fill(number);
  await dialog.getByRole("group", { name: "تاريخ الانتهاء: التقويم" }).getByRole("button", { name: "هجري" }).click();
  await dialog.getByLabel("تاريخ الانتهاء", { exact: true }).fill("1450-01-01");
  await dialog.getByLabel("تاريخ الانتهاء", { exact: true }).press("Enter");
  await expect(dialog.getByText(/^بالميلادي: /)).toBeVisible(); // converted with the backend's Umm al-Qura
  await dialog.locator('input[type="file"]').setInputFiles({ name: "passport.pdf", mimeType: "application/pdf", buffer: PDF });
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();

  const row = hr.getByRole("row").filter({ hasText: number });
  await expect(row).toContainText("جواز السفر");
  await expect(row).toContainText("سارية");
  const [tab] = await Promise.all([hr.context().waitForEvent("page"), row.getByRole("button", { name: "عرض passport.pdf" }).click()]);
  await tab.waitForURL(/\/api\/v1\/files\//);
  const response = await tab.request.get(tab.url());
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
});
