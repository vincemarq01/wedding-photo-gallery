# Current deployment: Vercel + Google Drive API

The existing React site now uses the Google Drive API directly through a Vercel Function. **Apps Script and Cloud Run are not required.** Guests never sign in to Google. The owner's OAuth refresh token stays on the server. Source photos keep their exact original bytes, including HEIC format, PNG transparency and EXIF data. Album images are smaller previews; originals stay in the same wedding folder.

## Activate it on your existing Vercel project

1. Push this project's updated source, including **api/drive.ts**, **backend/src/app.ts** and root **vercel.json**. Keep Vercel Root Directory at this project root, not frontend. Existing build command/output stay `npm run build --workspace frontend` and `frontend/dist`.
2. In **Settings → Environment Variables**, add these to **Production**. Use the existing owner credentials from backend/.env; no new OAuth client is required if the grant is still valid:

| Key                      | Type             | Value                                                                             |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`       | Secret or Config | Existing OAuth client ID                                                          |
| `GOOGLE_CLIENT_SECRET`   | Secret           | Existing client secret                                                            |
| `GOOGLE_REFRESH_TOKEN`   | Secret           | Existing owner refresh token                                                      |
| `SESSION_SECRET`         | Secret           | Existing random 64-character hex key                                              |
| `FRONTEND_ORIGIN`        | Config           | `https://vince-emy-photo-memories.vercel.app` (use your actual production origin) |
| `GOOGLE_DRIVE_FOLDER_ID` | Config           | `1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32`                                               |
| `MAX_FILE_BYTES`         | Config           | `10485760`                                                                        |
| `MAX_BATCH_FILES`        | Config           | `20`                                                                              |
| `TRUST_PROXY_HOPS`       | Config           | `1`                                                                               |
| `VITE_STORAGE_PROVIDER`  | Config           | `google-drive`                                                                    |
| `VITE_PUBLIC_URL`        | Config           | Your production Vercel URL, for the QR card                                       |

The assistant prepared an **ignored local .env.vercel** containing the server-only settings from existing local credentials. You may use Vercel's **Import .env** with that specific file instead of copying server settings one by one. It contains secrets: never commit it, send it in chat or include it in screenshots. Add the two public `VITE_*` values separately as Config. Google secrets must never have a `VITE_` prefix.

3. Remove obsolete `APPS_SCRIPT_URL` and `APPS_SCRIPT_SECRET` from the active Vercel project if no longer needed. Remove any production `VITE_API_URL=http://localhost:8080`. Google Drive mode always uses same-origin `/api/...` endpoints.
4. **Redeploy** the latest committed source. Updating environment variables without redeploying does not update the running function/build.
5. Open the production website in incognito, check View album, upload a real photo, and confirm the original file in Drive. The new Vercel production credentials/routes cannot be verified until you redeploy.

If the owner OAuth grant was revoked or expired, run the existing owner-only `npm run oauth --workspace backend` locally and replace `GOOGLE_REFRESH_TOKEN` in Vercel. External OAuth apps in Testing can have seven-day refresh token expiration with Drive scopes; resolve the appropriate production consent/verification state before the wedding. Nothing about this setup requires guests to authorize Google.

## Upload behavior for the reception

- **20 selected photos per batch**, with two concurrent file transfers per phone. Guests can add another batch after completion. All tables use the same website/QR.
- Originals up to **10 MiB per photo**. No resize, JPEG re-encoding, base64 transport or temporary parts in Drive. Requests carry binary chunks up to 4 MiB, below Vercel's 4.5 MB payload limit. Files over the limit are rejected, not compressed.
- Google Drive's native resumable session holds transfer state. Retry in the same open tab queries Drive's received offset before continuing. Completed-file recovery checks preallocated file ID, size and the exact folder. Reloading the page loses browser File handles/session tokens, so keep the tab open.
- Only a bounded chunk is buffered per request. Sessions are encrypted and do not depend on a particular server instance. There is no global upload lock serializing all guests.
- Shared reception Wi-Fi may put 90 guests behind one IP. The best-effort per-instance limits are 50,000 requests / 15 minutes and 5,000 upload/session creations / hour per IP. They reset on cold starts and are not durable global byte quotas. No CAPTCHA is reintroduced.
- The Drive folder is never made publicly writable. Album listing excludes old `.wedding-part-` staging files. No existing original photo or old staging file is deleted by this migration.
- Large album previews wait for Google-generated thumbnails. Raw fallback images are bounded to 3 MiB. Album preview size does not change original storage quality.
- Venue bandwidth, Drive storage, Google API quotas and Vercel plan limits still apply. This architecture has not been load-tested with 90 real phones; no guarantee of free/unlimited usage or a particular upload speed is implied.

## Local development and checks

Keep frontend/.env with `VITE_STORAGE_PROVIDER=express` and `VITE_API_URL=http://localhost:8080` to use plain Vite and the existing local Express server. The same Express app is exported for Vercel; only the local server calls listen().

```powershell
npm run dev:backend
npm run dev:frontend
npm run build
npm test
```

Real end-to-end verification (loads existing backend/.env, starts an ephemeral local HTTP server using the **actual Vercel adapter**, uploads a valid original PNG slightly over 4 MiB in two chunks, queries resumable status, verifies folder/size/MD5, and retains the test photo):

```powershell
node --env-file=backend/.env --import tsx scripts/verify-google-drive.mts
```

This performs a real Drive write and does not expose credentials. The test is separate from a production Vercel deployment check.
