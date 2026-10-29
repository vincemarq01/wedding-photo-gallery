import type { Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { bearer, session } from "../middleware/security.js";
import { seal, unseal } from "../services/tokens.js";
import {
  extension,
  extensions,
  safeName,
  validateContent,
} from "../services/validation.js";
import {
  driveFetch,
  getStatus,
  parseProgress,
  startDriveUpload,
} from "../services/drive.js";
export async function authorize(_req: Request, res: Response) {
  res.json({
    token: seal(
      { kind: "batch", expires: Date.now() + 6 * 60 * 60 * 1000 },
      config.SESSION_SECRET,
    ),
  });
}
export async function create(req: Request, res: Response) {
  const auth = unseal<{ kind: string; expires: number }>(
    bearer(req),
    config.SESSION_SECRET,
  );
  if (auth.kind !== "batch") throw new Error("Invalid upload authorization.");
  const body = z
    .object({
      name: z.string().min(1).max(255),
      size: z.number().int().positive().max(config.MAX_FILE_BYTES),
      guestName: z.string().trim().max(80).default(""),
    })
    .parse(req.body);
  const name = safeName(body.name);
  if (!extensions[extension(name)]) {
    res.status(400).json({ error: "Unsupported file extension." });
    return;
  }
  const drive = await startDriveUpload(name, body.size, body.guestName);
  res.status(201).json({
    session: seal(
      {
        kind: "upload",
        expires: Date.now() + 24 * 60 * 60 * 1000,
        ...drive,
        size: body.size,
        name,
      },
      config.SESSION_SECRET,
    ),
  });
}
export async function status(req: Request, res: Response) {
  res.json(await getStatus(session(req)));
}
export async function chunk(req: Request, res: Response) {
  const s = session(req);
  const start = Number(req.headers["x-upload-offset"]);
  const bytes = req.body as Buffer;
  if (
    !Buffer.isBuffer(bytes) ||
    !bytes.length ||
    !Number.isSafeInteger(start) ||
    start < 0 ||
    start % 262144 !== 0 ||
    bytes.length > 4 * 1024 * 1024 ||
    start + bytes.length > s.size ||
    (start + bytes.length < s.size && bytes.length % 262144 !== 0)
  ) {
    res.status(400).json({ error: "Invalid upload chunk." });
    return;
  }
  const current = await getStatus(s);
  if (current.complete || current.offset !== start) {
    res.json(current);
    return;
  }
  let mime: string | undefined;
  if (start === 0) {
    try {
      mime = await validateContent(bytes, s.name);
    } catch {
      res.status(415).json({
        error:
          "File content does not match the selected photo or video format.",
      });
      return;
    }
  }
  const response = await driveFetch(s.url, {
    method: "PUT",
    headers: {
      "Content-Type": mime || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Range": `bytes ${start}-${start + bytes.length - 1}/${s.size}`,
    },
    body: new Uint8Array(bytes),
  });
  res.json(parseProgress(response, s.size));
}
