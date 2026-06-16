# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: music.spec.ts >> Music Bot Chat Feedback & Autocomplete Picker E2E Tests >> Slash triggers picker, autocomplete works, and Music Bot responds in chat
- Location: e2e\music.spec.ts:25:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('div[id^=\'command-picker-\']')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('div[id^=\'command-picker-\']')
    - waiting for" http://localhost:3000/login" navigation to finish...

```

```yaml
- alert
- paragraph: Connecting to MiniDiscord...
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import * as fs from "fs";
  3  | import * as path from "path";
  4  | 
  5  | const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
  6  | 
  7  | function loadE2EMetadata() {
  8  |   const metaPath = path.join(AUTH_DIR, "meta.json");
  9  |   if (!fs.existsSync(metaPath)) {
  10 |     throw new Error("E2E metadata meta.json not found. Did you run the global setup?");
  11 |   }
  12 |   return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  13 | }
  14 | 
  15 | test.describe("Music Bot Chat Feedback & Autocomplete Picker E2E Tests", () => {
  16 |   let roomId: string;
  17 |   let channelId: string;
  18 | 
  19 |   test.beforeAll(() => {
  20 |     const meta = loadE2EMetadata();
  21 |     roomId = meta.roomId;
  22 |     channelId = meta.channelId;
  23 |   });
  24 | 
  25 |   test("Slash triggers picker, autocomplete works, and Music Bot responds in chat", async ({ browser }) => {
  26 |     // 1. Open Browser Context using the E2E owner session
  27 |     const ownerContext = await browser.newContext({
  28 |       storageState: path.join(AUTH_DIR, "owner.json"),
  29 |     });
  30 | 
  31 |     const page = await ownerContext.newPage();
  32 |     page.on("console", (msg) => console.log(`[BROWSER CONSOLE] ${msg.text()}`));
  33 | 
  34 |     // 2. Go to the test server channel
  35 |     const targetUrl = `/channels/${roomId}/${channelId}`;
  36 |     await page.goto(targetUrl);
  37 | 
  38 |     // Wait for the app text channel components to load
  39 |     await expect(page.locator('textarea')).toBeVisible({ timeout: 25000 });
  40 | 
  41 |     const input = page.locator('textarea');
  42 | 
  43 |     // 3. Type "/" to trigger command suggestions
  44 |     await input.fill("/");
  45 |     await page.waitForTimeout(500);
  46 | 
  47 |     // 4. Check if CommandPicker overlay is visible
  48 |     const picker = page.locator("div[id^='command-picker-']");
> 49 |     await expect(picker).toBeVisible({ timeout: 5000 });
     |                          ^ Error: expect(locator).toBeVisible() failed
  50 | 
  51 |     // Assert commands are listed
  52 |     await expect(page.locator("span:has-text('/play')")).toBeVisible();
  53 |     await expect(page.locator("span:has-text('/skip')")).toBeVisible();
  54 |     await expect(page.locator("span:has-text('/stop')")).toBeVisible();
  55 |     await expect(page.locator("span:has-text('/queue')")).toBeVisible();
  56 | 
  57 |     // 5. Autocomplete filter by typing "pl"
  58 |     await input.pressSequentially("pl");
  59 |     await page.waitForTimeout(300);
  60 | 
  61 |     // The picker should filter and keep play
  62 |     await expect(page.locator("span:has-text('/play')")).toBeVisible();
  63 |     // Press Enter to select "/play" from suggestion list
  64 |     await input.press("Enter");
  65 |     await page.waitForTimeout(300);
  66 | 
  67 |     // Assert that text input now has "/play "
  68 |     const textValue = await input.inputValue();
  69 |     expect(textValue).toBe("/play ");
  70 | 
  71 |     // 6. Complete command string
  72 |     await input.pressSequentially("lofi chill");
  73 |     await page.waitForTimeout(300);
  74 | 
  75 |     // Assert text input now has "/play lofi chill"
  76 |     expect(await input.inputValue()).toBe("/play lofi chill ");
  77 | 
  78 |     // 7. Submit command via Enter
  79 |     await input.press("Enter");
  80 |     await page.waitForTimeout(500);
  81 | 
  82 |     // Input should be cleared
  83 |     expect(await input.inputValue()).toBe("");
  84 | 
  85 |     // 8. Assert that the "Music Bot" responds to the command in real-time
  86 |     // (This wait is generous because Play-DL extraction / search matching might take a few seconds)
  87 |     const feedbackMessage = page.locator("span:has-text('Music Bot')").first();
  88 |     await expect(feedbackMessage).toBeVisible({ timeout: 15000 });
  89 | 
  90 |     // Verify it contains a confirmation string (either playing mono lofi, or extraction error / fallback string)
  91 |     const botMessageContent = page.locator("p:has-text('playing')").or(page.locator("p:has-text('Could not find')"));
  92 |     await expect(botMessageContent.first()).toBeVisible({ timeout: 15000 });
  93 | 
  94 |     await ownerContext.close();
  95 |   });
  96 | });
  97 | 
```