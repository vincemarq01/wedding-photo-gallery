export const USE_APPS_SCRIPT =
  import.meta.env.VITE_STORAGE_PROVIDER !== "express";
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_TRANSFER_BYTES = 3 * 1024 * 1024;
export async function scriptCall<T>(
  action: "upload" | "list" | "preview",
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
export async function preparePhoto(
  file: File,
): Promise<{ name: string; data: string }> {
  if (file.size > MAX_SOURCE_BYTES)
    throw new Error("Please choose a photo up to 10 MB.");
  let image: Blob = file;
  let name = file.name;
  if (file.size > MAX_TRANSFER_BYTES) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(
        1,
        2560 / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw Error();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.76, 0.62]) {
        image = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(Error())),
            "image/jpeg",
            quality,
          ),
        );
        if (image.size <= MAX_TRANSFER_BYTES) break;
      }
      name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    } catch {
      throw new Error(
        "This photo is too large to send. Please export it as a smaller JPG (up to 3 MB).",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (image.size > MAX_TRANSFER_BYTES)
    throw new Error(
      "Please choose a smaller photo (up to 3 MB after compression).",
    );
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(image);
  });
  return { name, data };
}
