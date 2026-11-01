import { expect, type Locator, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Overtime request (Phase 3 task 14): employee@ (رؤيا حاوي) plans two hours on a coming Friday (a rest day: all of it
 * is overtime), the form counts it and the year's hours left, manager@ approves it. An approved request stays, so each
 * run takes a free two hours: the next Friday when one is taken (one request covers a time once). */
function friday(weeksAhead: number): string {
  const day = new Date();
  day.setDate(day.getDate() + ((5 - day.getDay() + 7) % 7 || 7) + 7 * weeksAhead);
  return day.toLocaleDateString("en-CA");
}

async function freeSlot(form: Locator): Promise<{ day: string; from: string }> {
  const hour = 8 + (Math.floor(Date.now() / 60_000) % 5) * 2; // 08, 10, 12, 14 or 16
  for (let week = 0; week < 10; week += 1) {
    const day = friday(week);
    const from = `${String(hour).padStart(2, "0")}:00`;
    const counted = form.getByRole("status").filter({ hasText: "في يوم راحة" });
    const taken = form.getByText("يوجد طلب عمل إضافي آخر لهذا الوقت.");
    await form.locator('input[name="date"]').fill(""); // the last week's answer goes away first
    await expect(counted.or(taken)).toHaveCount(0);
    await form.locator('input[name="date"]').fill(day);
    await form.locator('input[name="from_time"]').fill(from);
    await form.locator('input[name="to_time"]').fill(`${String(hour + 2).padStart(2, "0")}:00`);
    await expect(counted.or(taken)).toBeVisible();
    if (await counted.isVisible()) return { day, from };
  }
  throw new Error("no free Friday in ten weeks");
}

test("an employee plans overtime and the manager approves it", async ({ browser }) => {
  test.setTimeout(90_000);
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/approvals?tab=mine");
  await employee.getByRole("button", { name: /^طلب جديد/ }).click();
  await employee.getByRole("button", { name: "عمل إضافي", exact: true }).click();
  const form = employee.getByRole("dialog", { name: "عمل إضافي" });
  const { day, from } = await freeSlot(form);
  await expect(form.getByRole("status")).toContainText("2:00 ساعة · في يوم راحة");
  await expect(form.getByRole("status")).toContainText("يتبقى");
  await form.locator('textarea[name="reason"]').fill("جرد المستودع نهاية الشهر");
  await form.getByRole("button", { name: "إرسال" }).click();
  await expect(form).toBeHidden();
  const title = `${day} ${from}`;
  await expect(employee.getByRole("row").filter({ hasText: title }).first()).toContainText("بانتظار الموافقة");

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/approvals");
  const task = manager.getByRole("row").filter({ hasText: "عمل إضافي" }).filter({ hasText: title }).first();
  await task.getByRole("button", { name: "موافقة", exact: true }).click();
  await manager.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(task).toHaveCount(0);

  await employee.reload();
  await expect(employee.getByRole("row").filter({ hasText: title }).first()).toContainText("تمت الموافقة");
});
