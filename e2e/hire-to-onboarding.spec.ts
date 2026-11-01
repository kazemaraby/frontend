import { expect, test } from "@playwright/test";

import { emailedLink, nationalId, signedIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4 e2e CV");
const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};

/** From an application to a new employee with onboarding (Phase 6 tasks 2, 5, 6; the Phase 6 close): a visitor
 * applies on the careers page to the demo's customer support opening (50 places, so runs never close it); HR makes an
 * offer and qa@ approves it; the candidate opens the e-mailed link (read from the development-only outbox) and
 * accepts; HR hires with the contract's signing date, so the person is "hired" at once, and their onboarding tasks are
 * open on the new employee file. */
test("an applicant is offered, accepts, is hired and their onboarding starts", async ({ browser, page, request }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const tag = [...String(stamp).slice(-7)].map((d) => "ابتثجحخدذر"[Number(d)]).join(""); // a unique name, in letters
  const name = `سالم ${tag} عبدالله الحربي`;
  const email = `hire-${stamp}@example.com`;

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=openings");
  const href = await hr.getByRole("region", { name: "الوظائف الشاغرة" }).getByRole("row").filter({ hasText: "دعم العملاء" }).filter({ hasText: "منشورة" }).first().getByRole("link", { name: "صفحة الوظيفة" }).getAttribute("href");
  await page.goto(new URL(href!).pathname);
  const form = page.getByRole("region", { name: "التقديم على الوظيفة" });
  await form.locator('input[name="full_name"]').fill(name);
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="phone"]').fill(`055${String(stamp).slice(-7)}`);
  await form.locator('input[name="answer_q1"]').fill("6");
  await form.locator('select[name="answer_q2"]').selectOption("yes");
  await form.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByLabel(/قرأت إشعار الخصوصية/).check();
  await form.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("وصلنا طلبك");

  // the offer, approved
  await hr.goto("/recruitment?tab=pipeline");
  await hr.getByRole("region", { name: "تقدّم", exact: true }).getByRole("button", { name: new RegExp(name) }).click();
  await hr.getByRole("dialog", { name }).getByRole("button", { name: "إعداد عرض وظيفي" }).click();
  const offer = hr.getByRole("dialog", { name: "إعداد عرض وظيفي" });
  await offer.locator('select[name="contract_type"]').selectOption({ label: "غير محدد المدة" });
  await offer.locator('input[name="start_date"]').fill(day(14));
  await offer.locator('input[name="basic_salary"]').fill("8000");
  await offer.locator('input[name="housing_allowance"]').fill("2000");
  await offer.locator('input[name="valid_until"]').fill(day(7));
  await offer.getByRole("button", { name: "إرسال للاعتماد" }).click();
  await expect(offer).toBeHidden();
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/approvals");
  const row = admin.getByRole("row").filter({ hasText: `عرض وظيفي: ${name}` });
  await row.getByRole("button", { name: "موافقة", exact: true }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(row).toHaveCount(0);

  // the candidate accepts through the e-mailed link
  const link = await emailedLink(request, email, "recruitment.offer_to_candidate");
  await page.goto(link);
  await page.getByRole("button", { name: "أقبل العرض" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  // HR hires: the employee file, hired at once with the signing date
  await hr.goto("/recruitment?tab=pipeline");
  await hr.getByRole("region", { name: "العرض", exact: true }).getByRole("button", { name: new RegExp(name) }).click();
  await hr.getByRole("dialog", { name }).getByRole("button", { name: "تعيين", exact: true }).click();
  const hire = hr.getByRole("dialog", { name: new RegExp("تعيين المرشح") });
  await hire.locator('select[name="nationality"]').selectOption("SA");
  await hire.locator('select[name="id_type"]').selectOption("national_id");
  await hire.locator('input[name="id_number"]').fill(nationalId());
  await hire.locator('select[name="gender"]').selectOption("male");
  await hire.locator('input[name="date_of_birth"]').fill("1995-03-14");
  await hire.locator('select[name="manager"]').selectOption(""); // not manager@'s team: other specs count it
  await hire.locator('input[name="signed_on"]').fill(day(0));
  await hire.getByRole("button", { name: "إنشاء ملف الموظف" }).click();
  await expect(hr).toHaveURL(/\/employees\/\d+/);
  await expect(hr.getByText("تم التعيين").first()).toBeVisible();
  // the onboarding card of the new file: its tasks open, none done yet
  await expect(hr.getByRole("region", { name: "مهام التهيئة" })).toContainText(/أُنجز [0٠] من [1-9١-٩]/);
});
