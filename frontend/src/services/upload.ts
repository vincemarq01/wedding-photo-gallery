import type { Memory } from "../types";
import { USE_APPS_SCRIPT, preparePhoto, scriptCall } from "./appsScript";
const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
export const CHUNK = 4 * 1024 * 1024;
async function json(path: string, init: RequestInit) {
  const r = await fetch(API + path, init);
  const body = await r.json();
  if (!r.ok)
    throw new Error(body.error || "Upload unavailable. Please try again.");
  return body;
}
function sendChunk(
  session: string,
  blob: Blob,
  start: number,
  total: number,
  onProgress: (n: number) => void,
): Promise<{ offset: number; complete: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", API + "/api/uploads/chunk");
    xhr.setRequestHeader("Authorization", "Bearer " + session);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Upload-Offset", String(start));
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) =>
      onProgress(Math.min(99, Math.round(((start + e.loaded) / total) * 100)));
    xhr.onerror = () =>
      reject(new Error("Connection interrupted. Tap retry to resume."));
    xhr.ontimeout = () =>
      reject(new Error("Transfer timed out. Tap retry to resume."));
    xhr.onload = () => {
      try {
        const b = JSON.parse(xhr.responseText);
        xhr.status >= 200 && xhr.status < 300
          ? resolve(b)
          : reject(new Error(b.error || "Upload failed."));
      } catch {
        reject(new Error("Upload service unavailable."));
      }
    };
    xhr.send(blob);
  });
}
export async function upload(
  memory: Memory,
  guestName: string,
  batch: string,
  onSession: (s: string) => void,
  onProgress: (n: number) => void,
) {
  if (USE_APPS_SCRIPT) {
    const photo = await preparePhoto(memory.file);
    await scriptCall("upload", { ...photo, uploadId: memory.id, guestName });
    onProgress(100);
    return;
  }
  let session = memory.session;
  let offset = 0;
  if (session) {
    const s = await json("/api/uploads/status", {
      headers: { Authorization: "Bearer " + session },
    });
    if (s.complete) return;
    offset = s.offset;
  } else {
    const s = await json("/api/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + batch,
      },
      body: JSON.stringify({
        name: memory.file.name,
        size: memory.file.size,
        guestName,
      }),
    });
    session = s.session;
    onSession(session!);
  }
  while (offset < memory.file.size) {
    const result = await sendChunk(
      session!,
      memory.file.slice(offset, offset + CHUNK),
      offset,
      memory.file.size,
      onProgress,
    );
    offset = result.offset;
    if (result.complete) break;
  }
  onProgress(100);
}
export async function authorize() {
  if (USE_APPS_SCRIPT) return "apps-script";
  return (
    await json("/api/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  ).token as string;
}
