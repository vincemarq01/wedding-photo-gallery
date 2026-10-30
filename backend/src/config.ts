import "dotenv/config";
import { z } from "zod";
export const config = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    FRONTEND_ORIGIN: z.url(),
    GOOGLE_DRIVE_FOLDER_ID: z
      .string()
      .default("1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32"),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REFRESH_TOKEN: z.string().min(1),
    SESSION_SECRET: z
      .string()
      .regex(/^[a-f\d]{64}$/i, "Use a random 32-byte hex secret"),
    MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(2 * 1024 ** 3)
      .default(10 * 1024 * 1024),
    MAX_BATCH_FILES: z.coerce.number().int().min(1).max(100).default(20),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  })
  .parse(process.env);
if (
  config.NODE_ENV === "production" &&
  !config.FRONTEND_ORIGIN.startsWith("https://")
)
  throw new Error("Production requires HTTPS.");
if (new URL(config.FRONTEND_ORIGIN).origin !== config.FRONTEND_ORIGIN)
  throw new Error(
    "FRONTEND_ORIGIN must be an exact origin without a trailing slash.",
  );
