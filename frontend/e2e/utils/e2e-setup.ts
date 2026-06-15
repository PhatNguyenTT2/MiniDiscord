import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const API_URL = "http://127.0.0.1:8080/api";
const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");

async function waitForGatewayReady() {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get("http://127.0.0.1:8080/actuator/health", { timeout: 2000 });
      if (res.status === 200) {
        console.log("Gateway is ready!");
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Gateway not ready after 30s");
}

function flushRateLimitKeys() {
  try {
    execSync('docker exec minidiscord-redis redis-cli DEL rate:api:127.0.0.1', { stdio: "pipe" });
    console.log("Flushed Redis rate limit keys.");
  } catch (err: any) {
    console.warn("Could not flush Redis keys (non-critical):", err.message);
  }
}

async function registerOrLogin(email: string, username: string) {
  const password = "password123";

  // Try to register
  try {
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      username,
      email,
      password,
    });
    console.log(`Registered user: ${username}`);
    return regRes.data.data;
  } catch (err: any) {
    if (err.response?.status === 400 || err.response?.status === 409) {
      console.log(`User already exists, logging in: ${username}`);
    } else {
      console.error(`Register failed for ${username}:`, err.message);
    }
  }

  // Login
  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    identifier: email,
    password,
  });
  return loginRes.data.data;
}

async function createAndJoinRoom(ownerToken: string, memberToken: string, num: number) {
  // Owner creates room
  const roomRes = await axios.post(
    `${API_URL}/rooms`,
    {
      name: `E2E Testing Server ${num}`,
      description: "Ephemeral server for playwright tests",
      type: "GROUP",
    },
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }
  );
  const roomId = roomRes.data.data.id;
  console.log(`Created E2E Room ${num} with ID: ${roomId}`);

  // Generate invite code
  const inviteRes = await axios.post(
    `${API_URL}/rooms/${roomId}/invites`,
    {},
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }
  );
  const inviteCode = inviteRes.data.data.code;
  console.log(`Room ${num} Invite Code: ${inviteCode}`);

  // Fetch Default Channel
  const channelRes = await axios.get(
    `${API_URL}/rooms/${roomId}/channels`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    }
  );
  const channelId = channelRes.data.data[0].id;
  console.log(`Room ${num} Default Channel ID: ${channelId}`);

  // Member joins Room
  await axios.post(
    `${API_URL}/invites/${inviteCode}/join`,
    {},
    {
      headers: { Authorization: `Bearer ${memberToken}` },
    }
  );
  console.log(`Member joined Room ${num} successfully`);

  return { roomId, channelId };
}

async function globalSetup() {
  console.log("Starting E2E seed data setup...");
  await waitForGatewayReady();
  flushRateLimitKeys();


  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const ownerPath = path.join(AUTH_DIR, "owner.json");
  const memberPath = path.join(AUTH_DIR, "member.json");
  const metaPath = path.join(AUTH_DIR, "meta.json");

  if (fs.existsSync(ownerPath) && fs.existsSync(memberPath) && fs.existsSync(metaPath)) {
    console.log("E2E auth and metadata files already exist! Skipping registration/seeding to avoid rate limits.");
    return;
  }

  // 1. Register / Login Owner and Member
  const ownerAuth = await registerOrLogin("owner@example.com", "owner_e2e");
  const memberAuth = await registerOrLogin("member@example.com", "member_e2e");

  if (!ownerAuth || !memberAuth) {
    throw new Error("Could not authenticate test users.");
  }

  const ownerToken = ownerAuth.token;
  const ownerUser = ownerAuth.user;
  const memberToken = memberAuth.token;
  const memberUser = memberAuth.user;

  // 2. Create two isolated rooms for the E2E tests
  const room1 = await createAndJoinRoom(ownerToken, memberToken, 1);
  const room2 = await createAndJoinRoom(ownerToken, memberToken, 2);

  // 5. Write auth storage states
  const ownerStorage = {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:3000",
        localStorage: [
          { name: "token", value: ownerToken },
          { name: "user_data", value: JSON.stringify(ownerUser) },
        ],
      },
    ],
  };

  const memberStorage = {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:3000",
        localStorage: [
          { name: "token", value: memberToken },
          { name: "user_data", value: JSON.stringify(memberUser) },
        ],
      },
    ],
  };

  fs.writeFileSync(path.join(AUTH_DIR, "owner.json"), JSON.stringify(ownerStorage, null, 2));
  fs.writeFileSync(path.join(AUTH_DIR, "member.json"), JSON.stringify(memberStorage, null, 2));

  // Write server metadata for tests
  const meta = {
    roomId: room1.roomId,
    channelId: room1.channelId,
    roomId2: room2.roomId,
    channelId2: room2.channelId,
    memberUserId: memberUser.id,
  };
  fs.writeFileSync(path.join(AUTH_DIR, "meta.json"), JSON.stringify(meta, null, 2));

  console.log("E2E setup storage states saved successfully!");
}

export default globalSetup;
