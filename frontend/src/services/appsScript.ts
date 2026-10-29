export const USE_APPS_SCRIPT =
  import.meta.env.VITE_STORAGE_PROVIDER !== "express";
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const PART_BYTES = 1024 * 1024;
export async function scriptCall<T>(
  action: "upload" | "list" | "preview" | "begin" | "part" | "finish",
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
    signal,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      import.meta.env.DEV
        ? "Apps Script mode needs the Vercel API function. Use vercel dev, or use VITE_STORAGE_PROVIDER=express with the local backend on port 8080."
        : "The album API is unavailable. Please deploy the root api/photos.ts function and check the Vercel project root and Apps Script settings.",
    );
  }
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data as T;
}
function encodePart(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(blob);
  });
}
export async function uploadOriginal(
  file: File,
  uploadId: string,
  guestName: string,
  onProgress: (value: number) => void,
) {
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error("Please choose a photo up to 10 MB.");
  if (!window.crypto?.subtle)
    throw new Error(
      "Please open the secure HTTPS website to upload original photos.",
    );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const state = await scriptCall<{ complete: boolean; received?: number[] }>(
    "begin",
    { uploadId, name: file.name, size: file.size, sha256, guestName },
  );
  if (state.complete) {
    onProgress(100);
    return;
  }
  const received = new Set(state.received || []);
  const count = Math.ceil(file.size / PART_BYTES);
  for (let index = 0; index < count; index++) {
    if (!received.has(index)) {
      const data = await encodePart(
        file.slice(index * PART_BYTES, (index + 1) * PART_BYTES),
      );
      await scriptCall("part", { uploadId, index, data });
    }
    onProgress(
      Math.min(
        95,
        Math.round(
          (Math.min(file.size, (index + 1) * PART_BYTES) / file.size) * 95,
        ),
      ),
    );
  }
  await scriptCall("finish", { uploadId });
  onProgress(100);
}
