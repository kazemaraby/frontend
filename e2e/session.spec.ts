import { expect, type Page, test } from "@playwright/test";

/** Demo data from `python manage.py seed_demo` (cactus tenant). */
const PASSWORD = "ChangeMe-123";
const MAIN = "شركة العميل";
const TRADING = "شركة العميل للتجارة";

type Me = { companies: { id: number; name_ar: string }[] };

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

const switcher = (page: Page) => page.getByRole("button", { name: /^تبديل الشركة أو الفرع/ });

test("log in to cactus, switch company, see the dashboard", async ({ page }) => {
  await page.goto("/login");
  const meResponse = page.waitForResponse((r) => r.url().endsWith("/api/v1/me") && r.ok());
  await signIn(page, "hr@cactus.localhost");
  const me = (await (await meResponse).json()) as Me;

  // Dashboard with the user's name from /me, in the default company.
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مرحبًا، سارة");
  await expect(switcher(page)).toHaveAccessibleName(new RegExp(`${MAIN}$`));

  // Switch to the second company (all branches).
  await switcher(page).click();
  await page.getByRole("group", { name: TRADING }).getByRole("button", { name: "كل الفروع" }).click();
  await expect(switcher(page)).toHaveAccessibleName(new RegExp(TRADING));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مرحبًا، سارة");
  // hr@ has no employee file in this company: no balances, the rest of the dashboard is there.
  await expect(page.getByRole("heading", { name: "إجراءات سريعة" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "رصيد إجازاتك" })).toHaveCount(0);

  // Company data now comes from the chosen company: the request carries its id and the list shows its staff.
  const tradingId = me.companies.find((c) => c.name_ar === TRADING)!.id;
  const employeesRequest = page.waitForRequest((r) => r.url().includes("/api/v1/employees?"));
  await page.getByRole("link", { name: "إدارة الموظفين" }).first().click();
  const request = await employeesRequest;
  expect(request.headers()["x-company-id"]).toBe(String(tradingId));
  expect(request.headers()["authorization"]).toMatch(/^Bearer /);
  await expect(page.getByRole("cell", { name: "EMP-101" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "EMP-001" })).toHaveCount(0);
});

test("protected pages send you to sign in and back; a wrong password is reported", async ({ page }) => {
  await page.goto("/employees");
  await expect(page).toHaveURL(/\/login\?next=%2Femployees$/);

  await signIn(page, "manager@cactus.localhost", "not-the-password");
  await expect(page.getByRole("alert")).toHaveText("البريد الإلكتروني أو كلمة المرور غير صحيحة.");

  await signIn(page, "manager@cactus.localhost");
  await expect(page).toHaveURL("/employees");
  // Line manager: own record and four direct reports (EMP-003, EMP-004, the new hire EMP-008 and the probation
  // demo hire from Phase 6), only in the company they belong to.
  await expect(page.getByRole("row")).toHaveCount(6); // header + 5
});

test("items the user has no permission for are hidden, and their URL shows no access", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "employee@cactus.localhost");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مرحبًا، رؤيا");

  const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" }).first();
  await expect(rail.getByRole("link", { name: "إدارة الموظفين" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "إدارة الرواتب" })).toHaveCount(0);
  await expect(rail.getByRole("link", { name: "التقارير" })).toHaveCount(0);

  await page.goto("/payroll");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("لا تملك صلاحية");
  await expect(page.getByRole("button", { name: "مسير رواتب جديد" })).toHaveCount(0);
});

test("the session survives a reload and sign-out ends it", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "qa@cactus.localhost");
  await expect(page).toHaveURL("/");
  await page.goto("/reports"); // full page load: the session must come back from the refresh cookie
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("التقارير");

  await page.reload(); // access token is in memory only; the refresh cookie restores it
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("التقارير");

  await page.getByRole("button", { name: /^حساب / }).click();
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL("/login"); // no ?next=: the next person to sign in starts on the dashboard
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login\?next=%2Freports$/);
});
