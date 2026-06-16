import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");

function loadE2EMetadata() {
  const metaPath = path.join(AUTH_DIR, "meta.json");
  if (!fs.existsSync(metaPath)) {
    throw new Error("E2E metadata meta.json not found. Did you run the global setup?");
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

test.describe("Music Bot Chat Feedback & Autocomplete Picker E2E Tests", () => {
  let roomId: string;
  let channelId: string;

  test.beforeAll(() => {
    const meta = loadE2EMetadata();
    roomId = meta.roomId;
    channelId = meta.channelId;
  });

  test("Slash triggers picker, autocomplete works, and Music Bot responds in chat", async ({ browser }) => {
    // 1. Open Browser Context using the E2E owner session
    const ownerContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, "owner.json"),
    });

    const page = await ownerContext.newPage();
    page.on("console", (msg) => console.log(`[BROWSER CONSOLE] ${msg.text()}`));

    // 2. Go to the test server channel
    const targetUrl = `/channels/${roomId}/${channelId}`;
    await page.goto(targetUrl);

    // Wait for the app text channel components to load
    await expect(page.locator('textarea')).toBeVisible({ timeout: 25000 });

    const input = page.locator('textarea');

    // 3. Type "/" to trigger command suggestions
    await input.fill("/");
    await page.waitForTimeout(500);

    // 4. Check if CommandPicker overlay is visible
    const picker = page.locator("div[id^='command-picker-']");
    await expect(picker).toBeVisible({ timeout: 5000 });

    // Assert commands are listed
    await expect(page.locator("span:has-text('/play')")).toBeVisible();
    await expect(page.locator("span:has-text('/skip')")).toBeVisible();
    await expect(page.locator("span:has-text('/stop')")).toBeVisible();
    await expect(page.locator("span:has-text('/queue')")).toBeVisible();

    // 5. Autocomplete filter by typing "pl"
    await input.pressSequentially("pl");
    await page.waitForTimeout(300);

    // The picker should filter and keep play
    await expect(page.locator("span:has-text('/play')")).toBeVisible();
    // Press Enter to select "/play" from suggestion list
    await input.press("Enter");
    await page.waitForTimeout(300);

    // Assert that text input now has "/play "
    const textValue = await input.inputValue();
    expect(textValue).toBe("/play ");

    // 6. Complete command string
    await input.pressSequentially("lofi chill");
    await page.waitForTimeout(300);

    // Assert text input now has "/play lofi chill"
    expect(await input.inputValue()).toBe("/play lofi chill ");

    // 7. Submit command via Enter
    await input.press("Enter");
    await page.waitForTimeout(500);

    // Input should be cleared
    expect(await input.inputValue()).toBe("");

    // 8. Assert that the "Music Bot" responds to the command in real-time
    // (This wait is generous because Play-DL extraction / search matching might take a few seconds)
    const feedbackMessage = page.locator("span:has-text('Music Bot')").first();
    await expect(feedbackMessage).toBeVisible({ timeout: 15000 });

    // Verify it contains a confirmation string (either playing mono lofi, or extraction error / fallback string)
    const botMessageContent = page.locator("p:has-text('playing')").or(page.locator("p:has-text('Could not find')"));
    await expect(botMessageContent.first()).toBeVisible({ timeout: 15000 });

    await ownerContext.close();
  });
});
