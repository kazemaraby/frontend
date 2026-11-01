import { expect, type Page, test } from "@playwright/test";

import { at, DEMO_OFFICE, signedIn } from "./helpers";

/** Selfie with consent (Phase 3 task 8, decision 5): HR turns the selfie on for the company; employee@ agrees once,
 * checks in and out with a photo from the (fake) front camera, then withdraws the consent; HR opens the photo from the
 * punch log through its signed link, and turns the selfie back to the account's value (off). */
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

async function selfieRule(hr: Page, value: "true" | "") {
  await hr.goto("/settings/attendance?tab=rules");
  await hr.getByRole("combobox", { name: "صورة شخصية مع الحضور والانصراف · هذه الشركة" }).selectOption(value);
  await hr.getByRole("button", { name: "حفظ قيم الشركة" }).click();
  await expect(hr.getByRole("row", { name: /صورة شخصية مع الحضور والانصراف/ })).toContainText(value ? "نعم" : "لا");
}

test("an employee agrees once and checks in with a selfie", async ({ browser }) => {
  test.setTimeout(90_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await selfieRule(hr, "true");
  try {
    const page = await signedIn(browser, "employee@cactus.localhost", at(DEMO_OFFICE));
    const card = page.getByRole("region", { name: "حركات الدوام لليوم" });
    await expect(card).toContainText("صورة شخصية مع");
    const withdraw = card.getByRole("button", { name: "سحب الموافقة" });
    if (await withdraw.isVisible()) await withdraw.click(); // a run that stopped half way left the consent given
    await expect(card).toContainText("تطلب الشركة صورة شخصية");
    if (await card.getByRole("button", { name: "تسجيل الانصراف" }).isVisible()) throw new Error("employee@ is checked in");

    await card.getByRole("button", { name: "تسجيل الحضور" }).click();
    const consent = page.getByRole("dialog", { name: "الموافقة على الصورة الشخصية" });
    await expect(consent).toContainText("لا تُستخدم في التعرف على الوجوه");
    await consent.getByLabel("قرأت ما سبق وأوافق").check();
    await consent.getByRole("button", { name: "موافقة" }).click();
    for (const [title, next] of [["تسجيل الحضور", "تسجيل الانصراف"], ["تسجيل الانصراف", "تسجيل الحضور"]]) {
      if (title === "تسجيل الانصراف") await card.getByRole("button", { name: title }).click(); // consented: the camera opens
      const camera = page.getByRole("dialog", { name: title });
      await camera.getByRole("button", { name: "التقاط" }).click();
      await expect(camera.getByRole("img", { name: "الصورة الملتقطة" })).toBeVisible();
      await camera.getByRole("button", { name: "تسجيل" }).click();
      await expect(camera).toBeHidden();
      await expect(card.getByRole("button", { name: next })).toBeVisible();
    }
    await card.getByRole("button", { name: "سحب الموافقة" }).click();
    await expect(card).toContainText("تطلب الشركة صورة شخصية مع كل حضور وانصراف.");

    await hr.goto("/attendance?tab=devices");
    const row = hr.getByRole("row").filter({ hasText: "رؤيا حاوي" }).filter({ has: hr.getByRole("button", { name: "الصورة الشخصية" }) }).first();
    await row.getByRole("button", { name: "الصورة الشخصية" }).click();
    await expect(hr.getByRole("dialog").getByRole("img", { name: "الصورة الشخصية" })).toBeVisible();
    await hr.keyboard.press("Escape");
  } finally {
    await selfieRule(hr, "");
  }
});
