# Keep the React site on Vercel, use Apps Script for Drive storage

This folder belongs to the existing **wedding-photo-sharing** React project. Keep its design, upload page, View album route and Vercel URL. Only the storage connection changes. **Do not deploy the separate top-level apps-script/Index.html.** No Cloud Run, Cloudflare, external iframe bridge, direct browser-to-Google CORS workaround, or manually configured Google OAuth client is needed for this mode.

Flow: browser → same-origin `/api/photos` Vercel Function → Apps Script `doPost` → the existing Drive folder. The shared connection secret stays on the two servers and is never included in the React build. The Google Drive files retain inherited sharing permissions. Anyone visiting the wedding site can upload and view its album.

## 1. Deploy this Apps Script backend

1. Open https://script.google.com while signed in with the account that can write to wedding folder **1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32**.
2. Create a project named **Vince & Emy Drive Connection**. Paste this folder's **Code.gs** into its Code.gs. No HTML file is needed.
3. Create a random connection secret of at least 32 characters. A ready-generated value is saved locally in ignored `apps-script/.env` as `APPS_SCRIPT_SECRET` if prepared by the assistant; otherwise generate a new 32-byte hex value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it private.
4. In Apps Script **Project Settings → Script properties → Add script property**, set key **APPS_SCRIPT_SECRET** to that value. Save.
5. In the editor, choose **setupAlbum → Run**, and authorize Drive access using the folder owner/editor account. This uses the existing folder and never creates a replacement. This step checks visibility; actual write permission is confirmed by the first real upload.
6. **Deploy → New deployment → Web app**. Select **Execute as: Me**, **Who has access: Anyone**, then Deploy. Workspace policies can restrict anonymous deployment.
7. Copy the **Web app URL ending in `/exec`**. An ordinary browser visit returns a small connection status JSON; it does not expose the album. The secret-authenticated POST handles album requests.

The manifest is optional: enable **Show appsscript.json** in Project Settings if you want to paste the provided V8/timezone/Drive-scope manifest. Otherwise Apps Script infers Drive permissions.

## 2. Update your existing Vercel project

Commit/push the changed source, including root `api/photos.ts` and `vercel.json`. Root Directory must be **the wedding-photo-sharing project root**, not frontend. Keep the root Vite/build/output settings already configured.

In **Settings → Environment Variables**, add to Production:

| Key | Value |
| --- | --- |
| `APPS_SCRIPT_URL` | The `/exec` URL from step 7 |
| `APPS_SCRIPT_SECRET` | The same private value as the Apps Script property |
| `VITE_STORAGE_PROVIDER` | `apps-script` |
| `VITE_PUBLIC_URL` | Your Vercel production website URL, for the QR card |

The first two are **server-only** variables: never name them `VITE_APPS_SCRIPT_SECRET`, paste them into React source, commit them or send them in screenshots. `VITE_API_URL` and Cloud Run configuration are not used in Apps Script mode. Google OAuth secrets from backend/.env are not needed by this connection.

Redeploy the Vercel project after adding variables. Guests continue using your **Vercel website URL**. Check that deployment protection permits anonymous visitors for the production wedding URL.

## 3. Verify before sharing

From an incognito browser/phone: open the Vercel page, upload one real JPEG, check the exact Drive folder, click View album, open its preview, and test retry after briefly interrupting the connection. Confirm the QR card points to Vercel. Mocked local tests cannot confirm your deployed account permissions, Apps Script anonymous access or mobile behavior. A live upload has not been verified for this new connection until you deploy it.

Update Apps Script code later with **Deploy → Manage deployments → Edit → New version → Deploy** to keep the same URL.

## Limits and costs

- This mode accepts **original photos up to 10 MB**, not videos. There is **no canvas compression, resizing, conversion to JPG, metadata stripping or change to the selected file bytes**. HEIC remains HEIC and transparent PNG remains PNG.
- The browser sends the original file in **1 MiB parts** below the Vercel payload limit. Apps Script stages those parts as private `application/octet-stream` files in the same wedding folder, then checks each part and verifies the assembled original using **SHA-256 and byte length** before saving it. Parts are excluded from the album. Retry uses the same upload ID and skips acknowledged parts within the same open page.
- Completed temporary parts are moved to Drive Trash. Abandoned sessions expire after 24 hours and are cleaned up on subsequent upload starts. **Trashed parts still use Drive storage until removed from Trash**, so temporary storage can approximately double an uploaded photo's space until Trash cleanup. If cleaning manually, remove only files named `.wedding-part-…`, not original photos or unrelated Trash files. Do not permanently delete pending parts while uploads are in progress.
- At most 20 staging sessions can be active. SHA-256 verification, 24-hour completion receipts, signature validation and daily upload quotas remain enabled. Rare failures between creating a part/file and persisting its receipt can leave an orphan or duplicate; test representative files before the event.
- Album images are **previews**. Large originals remain untouched in Drive; previews stay small enough for Vercel's response limit. A full-size response is used only for browser-compatible images up to 3 MiB. Previews may look less sharp than the original stored photo.
- To activate original-quality uploads, **update Apps Script Code.gs and deploy a New version first**, then push the frontend/API changes and redeploy Vercel. Environment variables and the existing `/exec` URL can stay the same. Updating local files alone does not change the live site.
- The script keeps aggregate daily limits of **1,000 photos / 2 GiB**; uploads are saved sequentially under a script lock. The Vercel limiter is best-effort and instance-local. These are not per-person storage budgets or bot verification.
- Drive storage, Apps Script execution quotas and Vercel plan limits still apply. This avoids creating a billable Cloud Run service; it does not promise unlimited free hosting/storage. Apps Script's per-page Drive iterator order is not a globally chronological album sort.
- Pause uploads with Script property `UPLOADS_ENABLED=false`. Rotate the shared secret in both services if exposed. The old Express backend remains available in the repository but is not used unless `VITE_STORAGE_PROVIDER=express` is explicitly selected.

Official references: [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas), [Vercel function limits](https://vercel.com/docs/functions/limitations).

For local React + API development, use `vercel dev` with the server-only variables in your local ignored `.env`; plain Vite only serves React and does not run the Vercel Function.
