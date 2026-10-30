export const API =
  import.meta.env.VITE_STORAGE_PROVIDER === "express"
    ? import.meta.env.VITE_API_URL || "http://localhost:8080"
    : "";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_FILES = 20;
