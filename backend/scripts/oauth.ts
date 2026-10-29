import "dotenv/config";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:53682/callback",
);
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
  throw new Error(
    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env first.",
  );
const state = randomBytes(24).toString("hex");
const { codeVerifier, codeChallenge } =
  await client.generateCodeVerifierAsync();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost:53682");
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const supplied = url.searchParams.get("state") || "";
    if (
      supplied.length !== state.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(state))
    )
      throw Error("Invalid state");
    const code = url.searchParams.get("code");
    if (!code) throw Error("Authorization declined");
    const { tokens } = await client.getToken({ code, codeVerifier });
    if (!tokens.refresh_token)
      throw Error("No refresh token. Revoke the previous app grant and retry.");
    let env = await readFile(".env", "utf8");
    env = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(env)
      ? env.replace(
          /^GOOGLE_REFRESH_TOKEN=.*$/m,
          `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`,
        )
      : env + `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    await writeFile(".env", env, { mode: 0o600 });
    res.end(
      "Authorization saved securely in backend/.env. You may close this window.",
    );
    console.log(
      "Refresh token saved in ignored backend/.env; it was not printed.",
    );
    server.close();
  } catch {
    res
      .writeHead(400)
      .end("Authorization failed. Check the console setup and retry.");
    console.error("Authorization failed; no credentials were logged.");
    server.close();
  }
});
server.listen(53682, "127.0.0.1", () => {
  console.log("Open this owner-only consent URL in your browser:");
  console.log(
    client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive"],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    }),
  );
});
setTimeout(
  () => {
    console.error("OAuth setup timed out.");
    server.close();
  },
  5 * 60 * 1000,
).unref();
