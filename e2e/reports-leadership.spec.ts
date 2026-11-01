import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const OUT = process.env.SHOT_DIR;

/** Leadership dashboard (Phase 6 task 16): the tenant admin sees every company of the tenant and its branches side by
 * side with the totals, as /reports/leadership answers; HR (no reports.view_leadership) has no such tab. */
test("the leadership board lists every company with the totals", async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/reports");
  const answer = admin.waitForResponse((r) => r.url().includes("/api/v1/reports/leadership") && r.ok());
  await admin.getByRole("tab", { name: "لوحة القيادة" }).click();
  const data = await (await answer).json();
  const board = admin.getByRole("region", { name: "الشركات والفروع" });
  for (const company of data.companies) await expect(board.getByRole("row").filter({ hasText: company.name_ar }).first()).toBeVisible();
  const total = board.getByRole("row").filter({ hasText: "الإجمالي" });
  await expect(total).toContainText(String(data.totals.active));
  expect(data.companies.length).toBeGreaterThan(1);
  if (OUT) await admin.screenshot({ path: `${OUT}/leadership.png`, fullPage: true });

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/reports");
  await expect(hr.getByRole("tab", { name: "لوحة تحكم الأداء" })).toBeVisible();
  await expect(hr.getByRole("tab", { name: "لوحة القيادة" })).toHaveCount(0);
});
