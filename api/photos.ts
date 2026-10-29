import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY = 4 * 1024 * 1024 + 16000;
const windows = new Map<string, { count: number; until: number }>();

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    send(405, { error: "Method not allowed." });
    return;
  }
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") {
    send(403, { error: "Origin not allowed." });
    return;
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (
    origin &&
    origin !== `https://${host}` &&
    !(process.env.VERCEL_ENV !== "production" && origin === `http://${host}`)
  ) {
    send(403, { error: "Origin not allowed." });
    return;
  }
  // Best-effort per-instance limit; the Apps Script daily quota is durable across instances.
  const ip = String(req.headers["x-forwarded-for"] || "unknown")
    .split(",")[0]!
    .trim();
  const now = Date.now();
  for (const [key, value] of windows)
    if (value.until < now) windows.delete(key);
  const current = windows.get(ip) || { count: 0, until: now + 60000 };
  if (++current.count > 120) {
    send(429, { error: "Please wait a minute before trying again." });
    return;
  }
  windows.set(ip, current);
  try {
    const endpoint = process.env.APPS_SCRIPT_URL;
    const secret = process.env.APPS_SCRIPT_SECRET;
    if (!endpoint || !secret) {
      send(503, {
        error:
          "Upload connection is not configured yet. Please set APPS_SCRIPT_URL and APPS_SCRIPT_SECRET in Vercel.",
      });
      return;
    }
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)
    )
      throw Error("Invalid Apps Script endpoint");
    let body: unknown = req.body;
    if (body === undefined) {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_BODY) {
          send(413, {
            error: "This photo is too large. Please choose a smaller image.",
          });
          return;
        }
        chunks.push(bytes);
      }
      body = JSON.parse(Buffer.concat(chunks).toString());
    } else if (typeof body === "string") {
      if (Buffer.byteLength(body) > MAX_BODY) {
        send(413, { error: "This photo is too large." });
        return;
      }
      body = JSON.parse(body);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Buffer.byteLength(JSON.stringify(body)) > MAX_BODY
    ) {
      send(400, { error: "Invalid photo request." });
      return;
    }
    const input = body as { action?: unknown; payload?: unknown };
    if (!["upload", "list", "preview"].includes(String(input.action))) {
      send(400, { error: "Invalid photo action." });
      return;
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        key: secret,
        action: input.action,
        payload: input.payload,
      }),
      signal: AbortSignal.timeout(50000),
    });
    if (!response.ok) {
      send(502, {
        error: "Our album is temporarily unavailable. Please retry.",
      });
      return;
    }
    const data = (await response.json()) as {
      ok?: boolean;
      data?: unknown;
      error?: string;
    };
    if (!data.ok) {
      send(400, { error: data.error || "Please retry your upload." });
      return;
    }
    send(200, data.data);
  } catch {
    send(502, {
      error: "Our album connection was interrupted. Please retry in a moment.",
    });
  }
}
