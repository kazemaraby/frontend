import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** HR dashboard (Phase 6 task 15): the cards show what /reports/hr-dashboard answers (the figures of
 * apps/reports/metrics, from the nightly pre-aggregation the demo seed builds); the period filter asks again and the
 * subtitles say what the figures cover; an employee without reports.view gets no dashboard. */
test("the HR dashboard shows the real figures and follows the period", async ({ browser }) => {
  test.setTimeout(120_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const first = hr.waitForResponse((r) => r.url().includes("/api/v1/reports/hr-dashboard") && r.ok());
  await hr.goto("/reports");
  const data = await (await first).json();
  const workforce = hr.getByRole("region", { name: "إجمالي تكلفة الرواتب والموظفين النشطين" });
  await expect(workforce).toContainText(String(data.workforce.active));
  await expect(workforce).toContainText(String(data.workforce.iqamas_expiring));
  if (data.workforce.nitaqat?.percent) await expect(workforce).toContainText("%");
  await expect(hr.getByRole("region", { name: "التعيينات الجديدة شهرياً" })).toContainText(data.hires.first.slice(0, 4));
  await expect(hr.getByRole("region", { name: "توجهات دوران واستبقاء الموظفين" }).getByRole("img")).toBeVisible();

  const week = hr.waitForResponse((r) => r.url().includes("period=d7") && r.ok());
  await hr.getByRole("tab", { name: "7 أيام" }).click();
  const weekly = await (await week).json();
  expect(weekly.period.key).toBe("d7");
  expect(weekly.turnover.points).toHaveLength(7); // a point a day
  await expect(hr.getByRole("region", { name: "توجهات دوران واستبقاء الموظفين" })).toContainText("–"); // a date range

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/reports");
  await expect(employee.getByText("ليست لديك صلاحية لعرض هذه الصفحة")).toBeVisible();
});
