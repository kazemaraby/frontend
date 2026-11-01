import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Leave requests (Phase 2 task 8): the employee asks for two days (the dialog counts them and shows the balance),
 * manager@ then hr@ approve, the balance goes down; HR reverses the leave and the days come back. */

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A Tuesday and Wednesday a few weeks ahead, in this leave year (the balance there is known), a different week
 * on each run. (The demo's own leave starts on Sundays.) */
function twoDays(): [string, string] {
  const today = new Date();
  const pick = (weeks: number) => {
    const day = new Date(today);
    day.setDate(day.getDate() + 7 * weeks + ((2 - day.getDay() + 7) % 7));
    return day;
  };
  const offset = Math.floor(Date.now() / 1000) % 8;
  // After the demo's own leave (next month): the latest of weeks 4…6+offset still in this year.
  let weeks = 6 + offset;
  while (weeks > 4 && pick(weeks).getFullYear() !== today.getFullYear()) weeks -= 1;
  const start = pick(weeks);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return [iso(start), iso(end)];
}

const PAGES = "التنقل بين الصفحات";
const pageLabel = (page: number) => `الصفحة ${page}`;

async function approve(page: Page, from: string) {
  await page.goto("/approvals");
  const row = page.getByRole("row").filter({ hasText: `رؤيا حاوي (${from})` }); // the title ends with the first day
  await row.getByRole("button", { name: "موافقة", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("an employee asks for leave, it is approved, and HR reverses it", async ({ browser }) => {
  test.setTimeout(90_000);
  const [from, to] = twoDays();
  const reason = `زيارة عائلية ${Date.now()}`;
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/leave");
  await employee.getByRole("button", { name: "طلب إجازة" }).click();
  const dialog = employee.getByRole("dialog");
  await dialog.locator('select[name="leave_type"]').selectOption({ label: "إجازة سنوية" });
  await dialog.locator('input[name="start_date"]').fill(from);
  await dialog.locator('input[name="end_date"]').fill(to);
  await expect(dialog.getByRole("status")).toContainText("2");
  await expect(dialog.getByRole("status")).toContainText("بعد هذه الإجازة");
  await dialog.locator('textarea[name="reason"]').fill(reason);
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();
  // the requests list is newest first (the leave list is by date and grows with every run)
  await employee.goto("/requests");
  const mine = employee.getByRole("row").filter({ hasText: "إجازة سنوية" }).filter({ hasText: "بانتظار" });
  await expect(mine.first()).toBeVisible();

  await approve(await signedIn(browser, "manager@cactus.localhost"), from);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await approve(hr, from);

  // HR reverses it from the first day: both days come back.
  const listed = hr.waitForResponse((r) => r.url().includes("/leave-requests") && r.request().method() === "GET");
  await hr.goto("/leave?tab=all");
  await listed;
  // The row of this leave: its dates as the app shows them ("8 – 9 ديسمبر 2026").
  const shown = (d: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", options).format(new Date(`${d}T00:00:00`));
  const dates = `${shown(from, { day: "numeric", month: "long" })} – ${shown(to, { day: "numeric", month: "long", year: "numeric" })}`;
  // still reversible: the earlier runs' rows of the same dates are reversed already; the list grows with every run,
  // so go through its pages
  const row = hr.getByRole("row").filter({ hasText: "رؤيا حاوي" }).filter({ hasText: dates })
    .filter({ has: hr.getByRole("button", { name: "إلغاء الإجازة" }) });
  await expect(hr.getByRole("row").filter({ hasText: "رؤيا حاوي" }).first()).toBeVisible(); // the first page is shown
  for (let page = 2; page <= 20 && (await row.count()) === 0; page += 1) {
    const next = hr.getByRole("navigation", { name: PAGES }).getByRole("button", { name: pageLabel(page), exact: true });
    if ((await next.count()) === 0) break;
    const loaded = hr.waitForResponse((r) => r.url().includes("/leave-requests") && r.url().includes(`page=${page}`));
    await next.click();
    await loaded;
  }
  await row.first().getByRole("button", { name: "إلغاء الإجازة" }).click();
  const reverse = hr.getByRole("dialog");
  await reverse.locator('input[name="from_date"]').fill(from);
  await reverse.locator('input[name="reason"]').fill("تغيّر موعد السفر");
  await reverse.getByRole("button", { name: "إلغاء الإجازة" }).click();
  await expect(reverse).toBeHidden();

  await employee.goto("/leave");
  await expect(employee.getByRole("row").filter({ hasText: "أُلغيت من" }).first()).toBeVisible();
});
