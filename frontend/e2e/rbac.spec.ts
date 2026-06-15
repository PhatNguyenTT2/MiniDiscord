import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const API_URL = "http://127.0.0.1:8080/api";

function loadE2EMetadata() {
  const metaPath = path.join(AUTH_DIR, "meta.json");
  if (!fs.existsSync(metaPath)) {
    throw new Error("E2E metadata meta.json not found. Did you run the global setup?");
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

test.describe("Dynamic RBAC & Moderation Real-Time WebSockets E2E Tests", () => {
  let roomId: string;
  let channelId: string;
  let roomId2: string;
  let channelId2: string;
  let memberUserId: string;

  test.beforeAll(() => {
    const meta = loadE2EMetadata();
    roomId = meta.roomId;
    channelId = meta.channelId;
    roomId2 = meta.roomId2;
    channelId2 = meta.channelId2;
    memberUserId = meta.memberUserId;
  });

  test("Owner mutes member - input area locks instantly on member side", async ({ browser }) => {
    // 1. Open Owner and Member pages in completely isolated contexts
    const ownerContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, "owner.json"),
    });
    const memberContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, "member.json"),
    });

    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    ownerPage.on("console", (msg) => console.log(`[OWNER CONSOLE] ${msg.text()}`));
    memberPage.on("console", (msg) => console.log(`[MEMBER CONSOLE] ${msg.text()}`));

    // 2. Navigate both to the chat room
    const targetUrl = `/channels/${roomId}/${channelId}`;
    await ownerPage.goto(targetUrl);
    await memberPage.goto(targetUrl);

    // Wait for both to be fully connected via WebSockets (status turns online)
    await expect(ownerPage.locator('div').filter({ hasText: 'owner_e2e' }).locator('span:has-text("Online")').first()).toBeVisible({ timeout: 25000 });
    await expect(memberPage.locator('div').filter({ hasText: 'member_e2e' }).locator('span:has-text("Online")').first()).toBeVisible({ timeout: 25000 });
    await memberPage.waitForTimeout(2000);

    // Verify member input is initially enabled
    const memberInput = memberPage.locator('textarea');
    await expect(memberInput).toBeEnabled();

    // 3. Owner calls API to mute member for 1 minute (triggers STOMP event)
    const token = await ownerPage.evaluate(() => localStorage.getItem("token"));
    await ownerPage.request.post(`${API_URL}/rooms/${roomId}/members/${memberUserId}/mute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { durationMinutes: 1 },
    });

    // 4. Assert member input box locks instantly via WebSocket sync (within 8000ms polling/listening window)
    await expect(memberInput).toBeDisabled({ timeout: 8000 });

    // 5. Verify UI shows countdown placeholder in the textarea
    await expect(memberInput).toHaveAttribute('placeholder', /You are muted|Muted|cấm chat/, { timeout: 8000 });

    await ownerContext.close();
    await memberContext.close();
  });

  test("Revoke ALLOW_MENTION - member fails to mention @everyone", async ({ browser }) => {
    const ownerContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, "owner.json"),
    });
    const memberContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, "member.json"),
    });

    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    ownerPage.on("console", (msg) => console.log(`[OWNER CONSOLE] ${msg.text()}`));
    memberPage.on("console", (msg) => console.log(`[MEMBER CONSOLE] ${msg.text()}`));

    const targetUrl = `/channels/${roomId2}/${channelId2}`;
    await ownerPage.goto(targetUrl);
    await memberPage.goto(targetUrl);

    // Wait for both to be fully connected via WebSockets (status turns online)
    await expect(ownerPage.locator('div').filter({ hasText: 'owner_e2e' }).locator('span:has-text("Online")').first()).toBeVisible({ timeout: 25000 });
    await expect(memberPage.locator('div').filter({ hasText: 'member_e2e' }).locator('span:has-text("Online")').first()).toBeVisible({ timeout: 25000 });
    await memberPage.waitForTimeout(2000);

    // 1. Fetch active roles of the room
    const token = await ownerPage.evaluate(() => localStorage.getItem("token"));
    const rolesRes = await ownerPage.request.get(`${API_URL}/rooms/${roomId2}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rolesData = await rolesRes.json();
    const everyoneRole = rolesData.data.find((r: any) => r.name === "@everyone");
    expect(everyoneRole).toBeDefined();

    // 2. Owner revokes ALLOW_MENTION permission for @everyone role via REST API
    const permissionRefreshPromise = memberPage.waitForResponse(
      (res) => res.url().includes("/permissions/my") && res.status() === 200,
      { timeout: 15000 }
    );

    await ownerPage.request.put(`${API_URL}/rooms/${roomId2}/roles/${everyoneRole.id}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        MANAGE_CHANNEL: everyoneRole.permissions.MANAGE_CHANNEL,
        INVITE_MEMBER: everyoneRole.permissions.INVITE_MEMBER,
        DELETE_ANY_MESSAGE: everyoneRole.permissions.DELETE_ANY_MESSAGE,
        BAN_MEMBER: everyoneRole.permissions.BAN_MEMBER,
        RESTRICT_MEMBER: everyoneRole.permissions.RESTRICT_MEMBER,
        ALLOW_MENTION: false, // Turn off
      },
    });

    // Wait for member to dynamically fetch fresh permissions via WebSocket update event
    await permissionRefreshPromise;
    // Buffer for React re-render of canMention state
    await memberPage.waitForTimeout(500);

    // 3. Handle alert modal trigger on member side
    let alertText = "";
    memberPage.once("dialog", async (dialog) => {
      alertText = dialog.message();
      await dialog.dismiss();
    });

    // 4. Member typing "@everyone" and pressing enter should raise the permission alert dialog
    const memberInput = memberPage.locator('textarea');
    await memberInput.fill("Hello @everyone");
    await memberInput.press("Enter");

    // Assert that blocking dialog was shown (checking English or Vietnamese keywords)
    await expect.poll(() => alertText.toLowerCase()).toMatch(/permission|mention|đề cập|đề cập|không có quyền/);

    await ownerContext.close();
    await memberContext.close();
  });
});
