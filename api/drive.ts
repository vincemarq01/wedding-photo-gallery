import type { IncomingMessage, ServerResponse } from "node:http";

let application: Promise<typeof import("../backend/src/app.js")> | undefined;

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse,
) {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "SESSION_SECRET",
    "FRONTEND_ORIGIN",
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          "Google Drive connection is not configured yet. Add these server-only Vercel variables: " +
          missing.join(", "),
      }),
    );
    return;
  }
  try {
    const incoming = new URL(req.url || "/", "http://internal");
    // Vercel can expose rewritten query parameters through req.query while
    // retaining the original URL. Support both forms, plus local HTTP routing.
    const route =
      incoming.searchParams.get("route") ||
      (typeof req.query?.route === "string" ? req.query.route : "") ||
      incoming.pathname.replace(/^\/api\//, "");
    if (
      !incoming.searchParams.has("cursor") &&
      typeof req.query?.cursor === "string"
    )
      incoming.searchParams.set("cursor", req.query.cursor);
    if (
      !/^(authorize|uploads(?:\/status|\/chunk)?|album(?:\/image\/[\w-]+)?)$/.test(
        route,
      )
    ) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Not found." }));
      return;
    }
    incoming.searchParams.delete("route");
    req.url = "/api/" + route + (incoming.search ? incoming.search : "");
    if (!application)
      application = (async () => {
        const module = await import("../backend/src/app.js");
        const { checkFolder } =
          await import("../backend/src/services/drive.js");
        await checkFolder();
        return module;
      })().catch((error) => {
        application = undefined;
        throw error;
      });
    const { app } = await application;
    app(req, res);
  } catch {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          "Google Drive authorization is unavailable. Check the server-only OAuth credentials, SESSION_SECRET format, FRONTEND_ORIGIN and folder write permission.",
      }),
    );
  }
}
