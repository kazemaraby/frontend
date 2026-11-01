import { expect, request, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** The public API (Phase 6 task 21): the tenant admin creates a client (the secret shown once), another system gets a
 * token with it and reads employees; the app's own endpoints refuse that token; revoking ends the client. */
test("an API client is created, used and revoked", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/api");
  await admin.getByRole("button", { name: "عميل جديد" }).click();
  const dialog = admin.getByRole("dialog", { name: "عميل جديد" });
  const name = `نظام التذاكر ${Date.now()}`;
  await dialog.locator('input[name="name"]').fill(name);
  await dialog.getByRole("checkbox", { name: /employees:read/ }).check();
  const companies = dialog.getByRole("group").nth(1).getByRole("checkbox");
  await companies.first().check();
  const role = dialog.locator('select[name="role"]');
  await role.selectOption({ label: "مدير الموارد البشرية" });
  await dialog.getByRole("button", { name: "إنشاء العميل" }).click();
  const secretDialog = admin.getByRole("dialog", { name: new RegExp(name) });
  const clientId = await secretDialog.locator('input[name="client_id"]').inputValue();
  const secret = await secretDialog.locator('input[name="client_secret"]').inputValue();
  expect(secret).toMatch(/^shs_/);
  await secretDialog.getByRole("button", { name: "نسخته" }).click();

  const outside = await request.newContext({ baseURL });
  const issued = await outside.post("/api/public/v1/oauth/token", { form: { grant_type: "client_credentials", client_id: clientId, client_secret: secret } });
  expect(issued.status()).toBe(200);
  const { access_token: token, scope } = await issued.json();
  expect(scope).toContain("employees:read");
  const auth = { Authorization: `Bearer ${token}` };
  const people = await outside.get("/api/public/v1/employees", { headers: auth });
  expect(people.status()).toBe(200);
  expect(people.headers()["api-version"]).toBe("1");
  expect((await people.json()).results.length).toBeGreaterThan(0);
  expect((await outside.get("/api/v1/employees", { headers: auth })).status()).toBe(401); // not the app's API
  expect((await outside.get("/api/public/v1/schema?format=json")).status()).toBe(200);

  const row = admin.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "إلغاء" }).click();
  await expect(row).toContainText("ملغى");
  expect((await outside.get("/api/public/v1/employees", { headers: auth })).status()).toBe(401);
});
