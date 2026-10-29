export const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
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
