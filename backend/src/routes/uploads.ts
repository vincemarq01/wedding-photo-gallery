import { Router, raw } from "express";
import { authorize, chunk, create, status } from "../controllers/uploads.js";
import { createLimit } from "../middleware/security.js";
export const uploads = Router();
uploads.post("/authorize", createLimit, authorize);
uploads.post("/uploads", createLimit, create);
uploads.get("/uploads/status", status);
uploads.put(
  "/uploads/chunk",
  raw({ type: "application/octet-stream", limit: "4mb" }),
  chunk,
);
