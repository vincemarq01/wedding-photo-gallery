import { rateLimit } from "express-rate-limit";
import type { Request } from "express";
import { config } from "../config.js";
import { unseal } from "../services/tokens.js";
export const apiLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes." },
});
export const createLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.MAX_BATCH_FILES * 4,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Upload limit reached. Please try again later." },
});
export type Session = {
  kind: "upload";
  expires: number;
  url: string;
  id: string;
  size: number;
  name: string;
};
export function bearer(req: Request) {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer "))
    throw new Error("Missing upload authorization.");
  return value.slice(7);
}
export function session(req: Request) {
  const s = unseal<Session>(bearer(req), config.SESSION_SECRET);
  if (s.kind !== "upload") throw new Error("Invalid upload authorization.");
  return s;
}
