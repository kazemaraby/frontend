import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Attendance correction (Phase 3 task 13): employee@ (رؤيا حاوي) gives the real check-in of last Wednesday with a
 * proof; manager@ (her manager) opens the proof from the request and approves; HR's record of that day then starts at
 * 08:00 (the device's check-in is replaced, kept, not counted). A rerun corrects the same day again. */
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

function lastWednesday(): string {
  const day = new Date();
  day.setDate(day.getDate() - (((day.getDay() - 3 + 7) % 7) || 7));
  return day.toLocaleDateString("en-CA");
}

/** Withdraws corrections a run that stopped half-way left waiting (one open correction per day). */
async function withdrawWaiting(employee: Page) {
  await employee.goto("/approvals?tab=mine");
  const waiting = employee.getByRole("row").filter({ hasText: "تصحيح حضور" }).filter({ hasText: "بانتظار الموافقة" });
  for (let left = await waiting.count(); left > 0; left -= 1) {
    await waiting.first().getByRole("button").first().click();
    await employee.getByRole("dialog").getByRole("button", { name: "إلغاء الطلب" }).click();
    await expect(employee.getByRole("dialog")).toContainText("ملغى");
    await employee.keyboard.press("Escape");
    await expect(waiting).toHaveCount(left - 1);
  }
}

test("an employee corrects a check-in and the manager approves it with the proof", async ({ browser }) => {
  test.setTimeout(90_000);
  const day = lastWednesday();
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await withdrawWaiting(employee);
  await employee.getByRole("button", { name: /^طلب جديد/ }).click();
  await employee.getByRole("button", { name: "تصحيح حضور", exact: true }).click();
  const form = employee.getByRole("dialog", { name: "تصحيح حضور" });
  await form.locator('input[name="date"]').fill(day);
  await form.locator('input[name="check_in"]').fill("08:00");
  await expect(form.getByRole("status")).toContainText(/يحل محل|يُضاف الوقت/);
  await form.locator('textarea[name="reason"]').fill("لم يقرأ الجهاز بصمتي، والحارس يشهد بحضوري.");
  await form.locator('input[type="file"]').setInputFiles(fixture("proof.pdf"));
  await form.getByRole("button", { name: "إرسال" }).click();
  await expect(form).toBeHidden();
  const mine = employee.getByRole("row").filter({ hasText: `تصحيح حضور` }).filter({ hasText: day }).first();
  await expect(mine).toContainText("بانتظار الموافقة");

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/approvals");
  const task = manager.getByRole("row").filter({ hasText: "تصحيح حضور" }).filter({ hasText: day }).first();
  await task.getByRole("button").first().click();
  const detail = manager.getByRole("dialog");
  await expect(detail).toContainText("08:00");
  const [popup] = await Promise.all([manager.waitForEvent("popup"), detail.getByRole("button", { name: "فتح المرفق" }).click()]);
  await expect.poll(() => popup.url()).toContain("/api/v1/files/");
  await popup.close();
  await manager.keyboard.press("Escape");
  await task.getByRole("button", { name: "موافقة", exact: true }).click();
  await manager.getByRole("dialog").getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(task).toHaveCount(0);

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance?tab=log");
  await hr.locator('input[name="date"]').fill(day);
  await hr.getByRole("button", { name: "إعادة الحساب" }).click();
  const row = hr.getByRole("table", { name: "سجل الحضور" }).getByRole("row").filter({ hasText: "رؤيا حاوي" });
  await expect(row).toContainText("08:00");
});
