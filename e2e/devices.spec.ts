import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Devices (Phase 3 task 4): hr@ makes a token for the "E2E BioStar" connection (created on the first run), the agent
 * sends a punch with it for an unknown device user, hr@ links that user to رؤيا حاوي and sees the punch as hers, then
 * unlinks it again (punches are never deleted: the test's ones stay on an old date, unlinked). */
test("a punch arrives through the agent's token and HR links its device user", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance?tab=devices");
  const connectors = hr.getByRole("list", { name: "روابط أجهزة البصمة" });
  await expect(connectors).toBeVisible();
  if ((await connectors.getByRole("listitem").filter({ hasText: "E2E BioStar" }).count()) === 0) {
    await hr.getByRole("button", { name: "إضافة ربط" }).click();
    const form = hr.getByRole("dialog");
    await form.locator('input[name="name"]').fill("E2E BioStar");
    await form.locator('select[name="kind"]').selectOption("biostar");
    await form.getByRole("button", { name: "حفظ" }).click();
    await expect(form).toBeHidden();
  }
  const row = connectors.getByRole("listitem").filter({ hasText: "E2E BioStar" });
  await row.getByRole("button", { name: /رمز/ }).click();
  const token = (await hr.getByRole("dialog").locator("code").textContent())!.trim();
  expect(token).toMatch(/^shr_/);
  await hr.getByRole("dialog").getByRole("button", { name: "إغلاق" }).last().click();

  // The agent's side: a batch with the token (no sign-in).
  const event = `e2e-${Date.now()}`;
  const sent = await hr.request.post("/api/v1/attendance/ingest", {
    headers: { Authorization: `Token ${token}` },
    data: { punches: [{ event_id: event, user_id: "E2E-77", time: "2026-01-05 08:03:00", kind: "in", name: "زائر الاختبار" }] },
  });
  expect(sent.status()).toBe(200);
  expect((await sent.json()).new).toBe(1);

  // HR links the unknown device user; the punch becomes رؤيا's.
  await hr.reload();
  const users = hr.getByRole("table", { name: "مستخدمو أجهزة البصمة" });
  await users.getByRole("button", { name: "ربط E2E-77" }).click();
  const link = hr.getByRole("dialog");
  await link.getByRole("searchbox").fill("رؤيا");
  await link.locator('select[name="employee"]').selectOption({ label: "رؤيا حاوي · EMP-004" });
  await link.getByRole("button", { name: "حفظ" }).click();
  await expect(link).toBeHidden();
  await hr.getByLabel("غير المربوطين فقط").uncheck();
  await hr.getByRole("searchbox", { name: "ابحث بالرقم أو الاسم" }).fill("E2E-77"); // earlier runs fill several pages
  const person = users.getByRole("row").filter({ hasText: "E2E-77" });
  await expect(person).toContainText("رؤيا حاوي");

  await hr.locator('select[name="source"]').selectOption("biostar");
  await expect(hr.getByRole("table", { name: "البصمات الواردة" }).getByRole("row").filter({ hasText: "رؤيا حاوي" }).first()).toBeVisible();

  // Back as it was: unlinked.
  await person.getByRole("button", { name: "تغيير" }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "إلغاء الربط" }).click();
  await expect(person).toContainText("غير مربوط");
});
