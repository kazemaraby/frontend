import { type APIRequestContext, type Browser, type BrowserContextOptions, expect, type Page } from "@playwright/test";

export const PASSWORD = "ChangeMe-123";

/** Signs in on /login and waits for the dashboard. The form is filled only once it is ready, the values are checked
 * before submitting, and an attempt that failed without an error on the form (the page loaded slowly, the click was
 * lost) is tried once more: runs under load used to fail here now and then. */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.goto("/login");
      const emailBox = page.locator('input[name="email"]');
      const passwordBox = page.locator('input[name="password"]');
      await expect(emailBox).toBeEditable();
      await emailBox.fill(email);
      await passwordBox.fill(password);
      await expect(emailBox).toHaveValue(email);
      await expect(passwordBox).toHaveValue(password);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL("/", { timeout: attempt === 1 ? 10_000 : 20_000 });
      return;
    } catch (error) {
      // A real refusal (an error on the form) or a second failure is reported; a slow page or a lost click is
      // tried once more.
      if (attempt === 2 || (await page.getByRole("alert").count())) throw error;
    }
  }
}

/** A new browser context (its own session) signed in as `email`; `options` sets e.g. its location. */
export async function signedIn(browser: Browser, email: string, options: BrowserContextOptions = {}): Promise<Page> {
  const page = await (await browser.newContext(options)).newPage();
  await signIn(page, email);
  return page;
}

/** The demo head office's geofence centre (apps/attendance/demo.py DEMO_OFFICE: 200 m around it). */
export const DEMO_OFFICE = { latitude: 24.774265, longitude: 46.738586 };

/** A browser that says it is at `where`, with the location allowed. */
export const at = (where: { latitude: number; longitude: number }, accuracy = 15): BrowserContextOptions => ({
  geolocation: { ...where, accuracy },
  permissions: ["geolocation"],
});

/** A made-up national ID with a valid Luhn check digit, unique per run. */
export function nationalId(): string {
  const stem = `1${String(Date.now()).slice(-8)}`;
  const luhn = (n: string) =>
    [...n].reverse().reduce((sum, ch, i) => {
      let d = Number(ch);
      if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
      return sum + d;
    }, 0) % 10 === 0;
  return [..."0123456789"].map((d) => stem + d).find(luhn)!;
}

/** The latest link e-mailed to someone without an account (a candidate), read from the development-only outbox
 * (`/api/v1/dev/outbox`, routed when DEBUG) as the tenant's superuser qa@. */
export async function emailedLink(request: APIRequestContext, to: string, kind: string): Promise<string> {
  const login = await request.post("/api/v1/auth/login", { data: { email: "qa@cactus.localhost", password: PASSWORD } });
  const { access } = (await login.json()) as { access: string };
  const outbox = await request.get(`/api/v1/dev/outbox?to=${encodeURIComponent(to)}`, { headers: { Authorization: `Bearer ${access}` } });
  const found = ((await outbox.json()) as { kind: string; link: string }[]).find((m) => m.kind === kind);
  if (!found) throw new Error(`No ${kind} e-mail to ${to}`);
  return found.link;
}
