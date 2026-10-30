import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ZodError } from "zod";
import { config } from "./config.js";
import { apiLimit } from "./middleware/security.js";
import { uploads } from "./routes/uploads.js";
import { album } from "./routes/album.js";
import { DriveError } from "./services/drive.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Upload-Offset"],
    maxAge: 600,
  }),
);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.headers.origin && req.headers.origin !== config.FRONTEND_ORIGIN) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }
  next();
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", apiLimit, express.json({ limit: "12kb" }), uploads, album);
app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (error instanceof DriveError) {
      const storage = error.reason === "storageQuotaExceeded";
      const permission = error.status === 401 || error.status === 403;
      res.status(storage ? 507 : permission ? 503 : 502).json({
        error: storage
          ? "Our memory album is full. Please let Vince & Emyreen know."
          : permission
            ? "Our album is temporarily unavailable. Please try again later."
            : "Google Drive is temporarily unavailable. Please retry your upload.",
      });
      return;
    }
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ error: "Please check your name, file type and file size." });
      return;
    }
    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      res.status(413).json({ error: "Upload chunk is too large." });
      return;
    }
    const message = error instanceof Error ? error.message : "";
    const safe =
      /authorization|session expired|Security check|security check/.test(
        message,
      );
    res.status(safe ? 401 : 500).json({
      error: safe ? message : "Upload interrupted. Please retry in a moment.",
    });
  },
);
