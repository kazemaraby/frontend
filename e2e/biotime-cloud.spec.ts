import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** BioTime and BioStar 2 read by the cloud (Phase 3 tasks 9–10) against the mock servers (tools/mock_biotime.py,
 * tools/mock_biostar.py, started by Playwright):
 * hr@ sets up the connection (address, API user, password), tests it — the login and the two terminals — reads it now
 * and sees the read in its log, then switches it off so the schedule leaves it alone. A connection with punches is
 * never deleted: a rerun switches the same one on again (its kept password stays). */
const SERVERS = [
  {
    kind: "biotime",
    name: "BioTime السحابي (اختبار آلي)",
    url: "http://127.0.0.1:8091",
    user: "api",
    password: "api-pass",
    login: "JWT",
    terminal: "Main entrance",
  },
  {
    kind: "biostar",
    name: "BioStar السحابي (اختبار آلي)",
    url: "http://127.0.0.1:8092",
    user: "admin",
    password: "bs-pass",
    login: "bs-session-id",
    terminal: "BioStation 3 Lobby",
  },
] as const;

for (const {
  kind,
  name: NAME,
  url,
  user,
  password,
  login,
  terminal,
} of SERVERS)
  test(`HR connects ${kind} from the cloud, tests it and reads it`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const hr = await signedIn(browser, "hr@cactus.localhost");
    await hr.goto("/attendance?tab=devices");
    const list = hr.getByRole("list", { name: "روابط أجهزة البصمة" });
    await expect(list).toBeVisible();
    const row = list.getByRole("listitem").filter({ hasText: NAME });

    if (await row.count())
      await row.getByRole("button", { name: `تعديل ${NAME}` }).click();
    else await hr.getByRole("button", { name: "إضافة ربط" }).click();
    const dialog = hr.getByRole("dialog");
    await dialog.locator('input[name="name"]').fill(NAME);
    await dialog.locator('select[name="kind"]').selectOption(kind);
    await dialog.locator('select[name="mode"]').selectOption("cloud");
    await dialog.locator('input[name="base_url"]').fill(url);
    await dialog.locator('input[name="username"]').fill(user);
    if (
      !(await dialog
        .locator('input[name="password"]')
        .getAttribute("placeholder"))
    )
      await dialog.locator('input[name="password"]').fill(password);
    await dialog.getByLabel("مفعّل").check();
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();

    await row.getByRole("button", { name: "اختبار الاتصال" }).click();
    const tested = hr.getByRole("dialog", {
      name: `اختبار الاتصال بـ ${NAME}`,
    });
    await expect(tested).toContainText(`تم الدخول إلى الخادم (${login}).`);
    await expect(tested.getByRole("list", { name: "الأجهزة" })).toContainText(
      terminal,
    );
    await hr.keyboard.press("Escape");
    await expect(tested).toBeHidden();

    await row.getByRole("button", { name: "قراءة الآن" }).click();
    await expect(row).toContainText("قراءة ناجحة", { timeout: 30_000 });
    await row.getByText("قراءة ناجحة").click();
    const runs = hr.getByRole("dialog", { name: `سجل قراءات ${NAME}` });
    await expect(runs).toContainText("قراءة يدوية");
    await hr.keyboard.press("Escape");
    await expect(runs).toBeHidden();

    await row.getByRole("button", { name: `تعديل ${NAME}` }).click();
    await hr.getByRole("dialog").getByLabel("مفعّل").uncheck();
    await hr.getByRole("dialog").getByRole("button", { name: "حفظ" }).click();
    await expect(row).toContainText("موقوف");
  });
