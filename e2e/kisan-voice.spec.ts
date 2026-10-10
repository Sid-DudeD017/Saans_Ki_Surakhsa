// The Plan tab's mic on a phone-sized screen in demo mode: tap to talk and tap to send, a tapped note
// that sends itself when the farmer goes quiet, hold and let go, slide left to cancel, and the checklist
// that ticks once Gurpreet's voice note is understood. The page gets a synthetic microphone (a tone
// whose volume the test sets with setVoice), so no real mic or OS permission is involved.
import { devices, expect, test, type Page } from "@playwright/test";

test.use({
  ...devices["Pixel 7"],
  launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __voice?: GainNode; __volume?: number };
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext();
      const tone = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = w.__volume ?? 0.5;
      const out = ctx.createMediaStreamDestination();
      tone.connect(gain).connect(out);
      tone.start();
      w.__voice = gain;
      return out.stream;
    };
  });
});

/** How loud the farmer is: 0.5 talking, 0 quiet. */
const setVoice = (page: Page, volume: number) =>
  page.evaluate((v) => {
    const w = window as unknown as { __voice?: GainNode; __volume?: number };
    w.__volume = v;
    if (w.__voice) w.__voice.gain.value = v;
  }, volume);

const mic = (page: Page) => page.locator("#kisan-mic[data-ready=true]");
const status = (page: Page) =>
  page.locator("#kisan-panel-plan [role=status]").last();

test("tap to talk, tap to send: the checklist fills from one voice note", async ({
  page,
}) => {
  await page.goto("/kisan");
  await expect(page.locator("[data-need]")).toHaveCount(6);
  await expect(page.locator("[data-need][data-done=true]")).toHaveCount(0);
  await expect(page.locator("#kisan-try-saying")).toContainText(
    "Bhawanigarh, Sangrur. 18 acres of paddy",
  );

  await mic(page).tap();
  await expect(status(page)).toContainText(/Listening 0:0\d · tap to send/);
  await expect(
    page.getByText("It sends by itself when you stop talking"),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await mic(page).tap(); // send

  await expect(page.getByText(/Voice note · 0:0\d/)).toBeVisible();
  await expect(page.locator("[data-need][data-done=true]")).toHaveCount(6);
  await expect(page.getByText("I have everything I need")).toBeVisible();
  await expect(
    page.getByText("ਪਿੰਡ ਭਵਾਨੀਗੜ੍ਹ", { exact: false }),
  ).toBeVisible(); // what it heard
  await expect(page.locator("#kisan-try-saying")).toHaveCount(0);

  // Heard wrong? The words go into the text box to correct.
  await page.getByRole("button", { name: "Heard wrong? Fix it" }).click();
  await expect(page.getByPlaceholder("Or type here")).toHaveValue(/ਭਵਾਨੀਗੜ੍ਹ/);
  await expect(page.getByPlaceholder("Or type here")).toBeFocused();
});

test.describe("with a mouse", () => {
  test.use({ isMobile: false, hasTouch: false });

  test("hold and let go sends; sliding left first cancels", async ({
    page,
  }) => {
    await page.goto("/kisan");
    await mic(page).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); // clear of the bottom tab bar
    const box = (await mic(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Hold, slide left, let go: nothing is sent.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(status(page)).toContainText("let go to send");
    await page.waitForTimeout(900);
    await page.mouse.move(x - 120, y, { steps: 5 });
    await expect(status(page)).toContainText("Let go to cancel");
    await page.mouse.up();
    await expect(status(page)).toContainText("Cancelled. Nothing was sent.");
    await expect(page.getByText(/Voice note/)).toHaveCount(0);

    // Hold for a second and let go: sent.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    await expect(page.locator("[data-need][data-done=true]")).toHaveCount(6);
  });
});

test("a tapped note sends itself when the farmer stops talking", async ({
  page,
}) => {
  await page.goto("/kisan");
  await mic(page).tap();
  await expect(status(page)).toContainText("tap to send");
  await page.waitForTimeout(1200); // talking
  await setVoice(page, 0); // quiet
  await expect(page.getByText(/Voice note · 0:0\d/)).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator("[data-need][data-done=true]")).toHaveCount(6);
});

test("a tapped note with nothing said is dropped, not sent", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.goto("/kisan");
  await setVoice(page, 0);
  await mic(page).tap();
  await expect(status(page)).toContainText("tap to send");
  await expect(status(page)).toContainText("I didn't hear anything", {
    timeout: 12_000,
  });
  await expect(page.getByText(/Voice note/)).toHaveCount(0);
});
