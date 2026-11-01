import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Leave balances (Phase 2 task 7): the employee sees their balances and ledger; HR adjusts a balance with a note
 * (and takes it back, so the demo stays the same). */

const figure = async (page: Page) =>
  Number((await annualCard(page).locator(".text-3xl").textContent())!.replace(/[^\d.-]/g, ""));
const annualCard = (page: Page) => page.getByRole("list", { name: "أرصدة الإجازات" }).getByRole("listitem").filter({ hasText: "إجازة سنوية" });

/** The ledger row with `note`: newest dates come first, so future-dated leave from other specs can push today's entry
 * to a later page. */
async function ledgerRow(hr: Page, note: string) {
  const row = hr.getByRole("row").filter({ hasText: note });
  await expect(hr.getByRole("table", { name: "سجل الإجازات" }).getByRole("row").nth(1)).toBeVisible();
  // The table refetches after a change: give page 1 time to show the new row before looking further.
  await row.waitFor({ timeout: 5_000 }).catch(() => undefined);
  for (let page = 2; page <= 10 && !(await row.isVisible()); page += 1) {
    const button = hr.getByRole("button", { name: `الصفحة ${page}`, exact: true });
    if (!(await button.isVisible())) break;
    // Wait for the page's own rows (earlier test runs leave identical rows, so the text can't tell pages apart).
    const loaded = hr.waitForResponse((r) => r.url().includes("/leave-entries") && r.url().includes(`page=${page}`));
    await button.click();
    await loaded;
    await expect(button).toHaveAttribute("aria-current", "page");
  }
  return row;
}

async function adjust(hr: Page, days: string, note: string) {
  await hr.getByRole("button", { name: "تعديل الرصيد" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('select[name="leave_type"]').selectOption({ label: "إجازة سنوية" });
  await dialog.locator('input[name="days"]').fill(days);
  await dialog.locator('input[name="note"]').fill(note);
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
}

test("the employee sees their leave balance; HR adjusts it with a note", async ({ browser }) => {
  const note = `تعويض عمل يوم العيد ${Date.now()}`;
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/me");
  await employee.getByRole("tab", { name: "الإجازات" }).click();
  await expect(annualCard(employee)).toContainText("افتتاحي");
  await expect(employee.getByRole("button", { name: "تعديل الرصيد" })).toHaveCount(0); // employees only read
  const before = await figure(employee);

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("رؤيا حاوي");
  await hr.getByRole("button", { name: "عرض ملف رؤيا حاوي" }).click();
  await hr.getByRole("tab", { name: "الإجازات" }).click();
  await adjust(hr, "2", note);
  await expect(await ledgerRow(hr, note)).toContainText("+2");

  await employee.reload();
  await expect.poll(() => figure(employee)).toBeCloseTo(before + 2, 2);

  await adjust(hr, "-2", `${note} (إلغاء)`);
  await employee.reload();
  await expect.poll(() => figure(employee)).toBeCloseTo(before, 2);
});
