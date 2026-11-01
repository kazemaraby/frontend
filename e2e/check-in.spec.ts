import { expect, test } from "@playwright/test";

import { at, DEMO_OFFICE, signedIn } from "./helpers";

/** Web check-in (Phase 3 tasks 7–8): employee@ (رؤيا حاوي) checks in and out on the dashboard card, on the server's
 * clock, from inside the head office's geofence. Punches are never deleted, so the test ends where it starts: checked
 * out (a run that finds them checked in checks out first). */
test("an employee checks in and out on the dashboard card", async ({ browser }) => {
  test.setTimeout(60_000);
  const page = await signedIn(browser, "employee@cactus.localhost", at(DEMO_OFFICE));
  const card = page.getByRole("region", { name: "حركات الدوام لليوم" });
  const checkIn = card.getByRole("button", { name: "تسجيل الحضور" });
  const checkOut = card.getByRole("button", { name: "تسجيل الانصراف" });
  await expect(checkIn.or(checkOut).or(card.getByRole("button", { name: /^إنهاء / }))).toBeVisible();
  if (await card.getByRole("button", { name: /^إنهاء / }).isVisible()) await card.getByRole("button", { name: /^إنهاء / }).click();
  if (await checkOut.isVisible()) {
    await checkOut.click();
    await expect(checkIn).toBeVisible();
  }

  const punches = card.getByRole("list", { name: "بصمات اليوم" });
  const before = await punches.getByRole("listitem").count();
  await checkIn.click();
  await expect(checkOut).toBeVisible();
  await expect(punches.getByRole("listitem")).toHaveCount(before + 1);
  await expect(punches.getByRole("listitem").last()).toContainText("دخول");
  await checkOut.click();
  await expect(checkIn).toBeVisible();
  await expect(punches.getByRole("listitem").last()).toContainText("خروج");
});

/** Task 8: outside the head office's 200 m the check-in is refused with the distance (decision 6), and the card says
 * that the location is checked. */
test("a check-in outside the branch's geofence is refused", async ({ browser }) => {
  const page = await signedIn(browser, "employee@cactus.localhost", at({ latitude: 24.79, longitude: 46.738586 }));
  const card = page.getByRole("region", { name: "حركات الدوام لليوم" });
  await expect(card).toContainText("يُتحقق من موقعك: داخل 200 م من الفرع.");
  const checkIn = card.getByRole("button", { name: "تسجيل الحضور" });
  await checkIn.click(); // the first test leaves them checked out
  await expect(card.getByRole("alert")).toContainText("خارج نطاقه البالغ 200 م");
  await expect(checkIn).toBeVisible(); // nothing was punched
});

test("HR sees each branch's geofence", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/settings/attendance?tab=geofences");
  const list = hr.getByRole("list", { name: "النطاق الجغرافي للفروع" });
  await expect(list.getByRole("listitem").filter({ hasText: "الفرع الرئيسي" }).first()).toContainText("نصف القطر 200 م");
  await hr.getByRole("tab", { name: "قواعد الحضور" }).click();
  await expect(hr.getByRole("row", { name: /دقة الموقع المطلوبة/ })).toContainText("100");
});
