import { Router } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { config } from "../config.js";
import { driveFetch } from "../services/drive.js";
import { seal, unseal } from "../services/tokens.js";

export const album = Router();
type PhotoGrant = { kind: "photo"; id: string; expires: number };
type PageGrant = { kind: "album-page"; page: string; expires: number };

album.get("/album", async (req, res) => {
  const cursor = z.string().max(12000).optional().parse(req.query.cursor);
  let page: string | undefined;
  if (cursor) {
    const grant = unseal<PageGrant>(cursor, config.SESSION_SECRET);
    if (grant.kind !== "album-page") {
      res.status(400).json({ error: "Invalid album page." });
      return;
    }
    page = grant.page;
  }
  const params = new URLSearchParams({
    q: `'${config.GOOGLE_DRIVE_FOLDER_ID.replace(/'/g, "\\'")}' in parents and trashed = false and mimeType contains 'image/' and not name contains '.wedding-part-'`,
    fields:
      "nextPageToken,files(id,name,mimeType,createdTime,imageMediaMetadata(width,height))",
    pageSize: "30",
    orderBy: "createdTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (page) params.set("pageToken", page);
  const data = await (
    await driveFetch("https://www.googleapis.com/drive/v3/files?" + params)
  ).json();
  const expires = Date.now() + 6 * 60 * 60 * 1000;
  res.json({
    photos: (data.files || []).map(
      (file: {
        id: string;
        name: string;
        createdTime: string;
        imageMediaMetadata?: { width?: number; height?: number };
      }) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        width: file.imageMediaMetadata?.width,
        height: file.imageMediaMetadata?.height,
        image:
          "/api/album/image/" +
          seal({ kind: "photo", id: file.id, expires }, config.SESSION_SECRET),
      }),
    ),
    nextCursor: data.nextPageToken
      ? seal(
          { kind: "album-page", page: data.nextPageToken, expires },
          config.SESSION_SECRET,
        )
      : null,
  });
});

album.get("/album/image/:grant", async (req, res) => {
  const token = z.string().max(12000).parse(req.params.grant);
  const grant = unseal<PhotoGrant>(token, config.SESSION_SECRET);
  if (grant.kind !== "photo" || !/^[\w-]+$/.test(grant.id)) {
    res.sendStatus(404);
    return;
  }
  const file = await (
    await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${grant.id}?fields=parents,mimeType,thumbnailLink,size,trashed&supportsAllDrives=true`,
    )
  ).json();
  if (
    file.trashed ||
    !file.parents?.includes(config.GOOGLE_DRIVE_FOLDER_ID) ||
    !file.mimeType?.startsWith("image/")
  ) {
    res.sendStatus(404);
    return;
  }
  let url: string;
  if (file.thumbnailLink) {
    const thumbnail = new URL(file.thumbnailLink);
    if (
      thumbnail.protocol !== "https:" ||
      !thumbnail.hostname.endsWith(".googleusercontent.com")
    ) {
      res.sendStatus(502);
      return;
    }
    url = thumbnail.href.replace(/=s\d+([^/]*)$/, "=s1600$1");
  } else {
    // Small images without a generated thumbnail (including a just-uploaded photo).
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimeType) ||
      Number(file.size) > 3 * 1024 * 1024
    ) {
      res.status(404).json({
        error: "Photo preview is still being prepared. Please refresh shortly.",
      });
      return;
    }
    url = `https://www.googleapis.com/drive/v3/files/${grant.id}?alt=media&supportsAllDrives=true`;
  }
  const response = await driveFetch(url);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/") || !response.body) {
    res.sendStatus(502);
    return;
  }
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  await pipeline(Readable.fromWeb(response.body as never), res);
});
