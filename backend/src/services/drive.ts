import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { extension, extensions } from "./validation.js";
import { parseProgress } from "./progress.js";
export { parseProgress } from "./progress.js";
export const auth = new OAuth2Client(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
);
auth.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });
export class DriveError extends Error {
  constructor(
    public status: number,
    public reason: string,
  ) {
    super(reason);
  }
}
export async function driveFetch(url: string, init: RequestInit = {}) {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("Google authentication is unavailable.");
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok && response.status !== 308) {
    const body = await response.json().catch(() => ({}));
    throw new DriveError(
      response.status,
      body.error?.errors?.[0]?.reason ||
        body.error?.status ||
        "driveUnavailable",
    );
  }
  return response;
}
export async function checkFolder() {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.GOOGLE_DRIVE_FOLDER_ID)}?fields=id,mimeType,capabilities(canAddChildren),trashed&supportsAllDrives=true`,
  );
  const folder = await response.json();
  if (
    folder.trashed ||
    folder.mimeType !== "application/vnd.google-apps.folder" ||
    !folder.capabilities?.canAddChildren
  )
    throw new Error(
      "The authorized account cannot upload to the configured wedding folder.",
    );
  return folder;
}
export async function startDriveUpload(
  name: string,
  size: number,
  guestName: string,
) {
  const ids = await (
    await driveFetch(
      "https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files",
    )
  ).json();
  const id = ids.ids[0] as string;
  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,parents,size",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Upload-Content-Length": String(size),
        "X-Upload-Content-Type": extensions[extension(name)]![0]!,
      },
      body: JSON.stringify({
        id,
        name,
        mimeType: extensions[extension(name)]![0]!,
        parents: [config.GOOGLE_DRIVE_FOLDER_ID],
        description: guestName
          ? `Wedding memory shared by ${guestName}`
          : "Wedding guest memory",
      }),
    },
  );
  const url = response.headers.get("location");
  if (!url || !url.startsWith("https://www.googleapis.com/"))
    throw new Error("Google did not provide a valid upload session.");
  return { id, url };
}
export async function getStatus(session: {
  url: string;
  id: string;
  size: number;
}) {
  let response: Response;
  try {
    response = await driveFetch(session.url, {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${session.size}`,
      },
    });
  } catch (e) {
    if (e instanceof DriveError && [404, 410].includes(e.status)) {
      try {
        const file = await (
          await driveFetch(
            `https://www.googleapis.com/drive/v3/files/${session.id}?fields=id,size,parents&supportsAllDrives=true`,
          )
        ).json();
        if (
          Number(file.size) === session.size &&
          file.parents?.includes(config.GOOGLE_DRIVE_FOLDER_ID)
        )
          return { offset: session.size, complete: true };
      } catch {
        /* Expired session or upload not completed. */
      }
      throw new Error(
        "This upload session expired. Remove the file and choose it again.",
      );
    }
    throw e;
  }
  return parseProgress(response, session.size);
}
