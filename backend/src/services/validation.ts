import { fileTypeFromBuffer } from "file-type";
export const extensions: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heic", "image/heif"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
};
export function safeName(name: string) {
  return name
    .normalize("NFKC")
    .replace(/[\\/\x00-\x1f\x7f]/g, "_")
    .slice(-180);
}
export function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}
export async function validateContent(bytes: Buffer, name: string) {
  const type = await fileTypeFromBuffer(bytes);
  if (!type || !extensions[extension(name)]?.includes(type.mime))
    throw new Error(
      "The file contents do not match a supported photo or video format.",
    );
  return type.mime;
}
