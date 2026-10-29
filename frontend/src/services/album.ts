export const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
import { USE_APPS_SCRIPT, scriptCall } from "./appsScript";
export type AlbumPhoto = {
  id: string;
  name: string;
  createdTime: string;
  image: string;
  width?: number;
  height?: number;
};
export async function getPhotos(
  cursor?: string,
  signal?: AbortSignal,
): Promise<{ photos: AlbumPhoto[]; nextCursor: string | null }> {
  if (USE_APPS_SCRIPT) {
    const data = await scriptCall<{
      photos: { id: string; name: string; createdAt: string }[];
      nextCursor: string | null;
    }>("list", { cursor }, signal);
    return {
      photos: data.photos.map((photo) => ({
        ...photo,
        createdTime: photo.createdAt,
        image: photo.id,
      })),
      nextCursor: data.nextCursor,
    };
  }
  const response = await fetch(
    API +
      "/api/album" +
      (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
    { signal },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "Our album could not load. Please try again.",
    );
  return data;
}

export async function getPhotoSource(
  photo: AlbumPhoto,
  large: boolean,
  signal: AbortSignal,
): Promise<string> {
  if (USE_APPS_SCRIPT)
    return scriptCall<string>("preview", { id: photo.id, large }, signal);
  return API + photo.image;
}
