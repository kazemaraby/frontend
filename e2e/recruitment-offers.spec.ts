import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const PDF = Buffer.from("%PDF-1.4 e2e CV");

/** Job offers (Phase 6 task 5): a visitor applies; HR makes an offer — the form works the package out by the salary
 * structure — and sends it for approval; nothing is sent before qa@ (the account admin, as the route's fallback)
 * approves it; then the offer waits for the candidate with its letter; HR withdraws it again. A forged link shows
 * nothing. (Accepting and declining are covered by the backend tests: the link only reaches the candidate's e-mail.) */
test("an offer is worked out, approved and sent, and a forged link shows nothing", async ({ browser, page }) => {
  test.setTimeout(150_000);
  const name = `مرشح عرض ${Date.now()}`;
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/recruitment?tab=openings");
  const href = await hr.getByRole("region", { name: "الوظائف الشاغرة" }).getByRole("row").filter({ hasText: "منشورة" }).first().getByRole("link", { name: "صفحة الوظيفة" }).getAttribute("href");
  await page.goto(new URL(href!).pathname);
  const form = page.getByRole("region", { name: "التقديم على الوظيفة" });
  await form.locator('input[name="full_name"]').fill(name);
  await form.locator('input[name="email"]').fill(`offer-${Date.now()}@example.com`);
  await form.locator('input[name="phone"]').fill(`055${String(Date.now()).slice(-7)}`);
  await form.locator('input[name="answer_q1"]').fill("6");
  await form.locator('select[name="answer_q2"]').selectOption("yes");
  await form.locator('input[type="file"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByLabel(/قرأت إشعار الخصوصية/).check();
  await form.getByRole("button", { name: "إرسال الطلب" }).click();
  await expect(page.getByRole("status")).toContainText("وصلنا طلبك");

  await hr.goto("/recruitment?tab=pipeline");
  await hr.getByRole("region", { name: "تقدّم", exact: true }).getByRole("button", { name: new RegExp(name) }).click();
  const dialog = hr.getByRole("dialog", { name });
  await dialog.getByRole("button", { name: "إعداد عرض وظيفي" }).click();
  const offer = hr.getByRole("dialog", { name: "إعداد عرض وظيفي" });
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString("en-CA");
  };
  await offer.locator('select[name="contract_type"]').selectOption({ label: "غير محدد المدة" });
  await offer.locator('input[name="start_date"]').fill(day(40));
  await offer.locator('input[name="basic_salary"]').fill("8000");
  await offer.locator('input[name="housing_allowance"]').fill("2000");
  await offer.locator('input[name="valid_until"]').fill(day(7));
  const breakdown = offer.getByRole("region", { name: "تفاصيل الراتب حسب هيكل الرواتب" });
  await expect(breakdown).toContainText("الراتب الأساسي");
  await expect(breakdown).toContainText("10,000");
  await offer.getByRole("button", { name: "إرسال للاعتماد" }).click();
  await expect(offer).toBeHidden();
  const offers = dialog.getByRole("region", { name: "العروض الوظيفية" });
  await expect(offers).toContainText("بانتظار الموافقة");
  await expect(offers).not.toContainText("بانتظار رد المرشح"); // nothing sent before approval

  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/approvals");
  const row = admin.getByRole("row").filter({ hasText: `عرض وظيفي: ${name}` });
  await row.getByRole("button", { name: "موافقة", exact: true }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(row).toHaveCount(0);

  await hr.reload();
  await hr.getByRole("region", { name: "العرض", exact: true }).getByRole("button", { name: new RegExp(name) }).click();
  const sent = hr.getByRole("dialog", { name }).getByRole("region", { name: "العروض الوظيفية" });
  await expect(sent).toContainText("بانتظار رد المرشح");
  await expect(sent.getByRole("button", { name: "خطاب العرض" })).toBeVisible();
  await sent.getByRole("button", { name: "سحب العرض" }).click();
  const withdraw = hr.getByRole("dialog", { name: /سحب العرض/ });
  await withdraw.locator('textarea[name="reason"]').fill("اختبار");
  await withdraw.getByRole("button", { name: "سحب العرض" }).click();
  await expect(sent).toContainText("سُحب");

  await page.goto("/offer/forged-link");
  await expect(page.getByRole("alert")).toContainText("هذا الرابط غير صالح");
});
