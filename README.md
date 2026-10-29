# Vince & Emyreen — our shared memory book

New standalone React/TypeScript/Vite frontend and Express/TypeScript API. Existing files in the parent directory are untouched. Frontend: Vercel. API: Google Cloud Run. Storage: the **existing** Drive folder `1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32`. No database; no guest Google login. This project never creates or publicly shares a destination folder.

## Local development

Use Node.js 24 LTS and npm. The scaffold is already created; no separate create-vite command is needed.

```powershell
cd C:\VinceCodes\photouploader\wedding-photo-sharing
npm install
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated hex value in backend `.env` as `SESSION_SECRET`. Complete Google credentials below. Never put Google secrets or the session secret in frontend environment variables. The frontend's `VITE_*` variables are public.

Start in two terminals from the project root:

```powershell
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173. The backend verifies the authorized account's ability to add files to the exact configured folder before listening. Missing credentials deliberately prevent startup. The frontend still renders independently, but does not pretend uploads succeeded.

## Owner Google authorization

1. Create a dedicated Google Cloud project and enable **Google Drive API** in APIs & Services → Library.
2. Configure Google Auth Platform branding, audience and data access. During development add the uploading Google account as a test user.
3. Create an OAuth **Web application** client. Add the exact authorized redirect URI `http://localhost:53682/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in backend `.env`.
5. For this fixed, pre-existing folder the setup helper requests `https://www.googleapis.com/auth/drive`. This is a **restricted scope** with broad access to the owner's Drive. Prefer an account dedicated to wedding uploads and review Google's verification requirements before production. A folder URL alone does not grant an app access under `drive.file`. A narrower `drive.file` setup requires the owner to explicitly select/share this existing folder through Google Picker using the same OAuth app; this MVP does not implement that owner Picker flow. Merely switching the scope string is insufficient.
6. Run the following from the project root, open the printed consent URL, and authorize using an account with **Editor/owner access** to the linked destination folder. Only the couple performs this step.

```powershell
npm run oauth --workspace backend
```

The local callback uses state and PKCE, exchanges the code server-side and saves the refresh token directly into ignored backend `.env`. It never prints the token. Restrict this file's Windows ACL to your account. Do not paste credentials into chat, commit them, or add them to Vercel.

7. Start the API. A successful startup confirms folder MIME type, non-trashed status and `capabilities.canAddChildren`; it does not merely trust the folder link. If it fails, verify the consent account, API enablement, scope and folder permission. No account access has been confirmed until this runs successfully.
8. Before the wedding, resolve OAuth publishing/verification requirements. External OAuth apps in **Testing** normally have refresh tokens expiring after seven days when requesting Drive scopes. Move to the appropriate production state and reauthorize; also account for revocation and token limits. Guests never see OAuth.

Official references: [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Actual end-to-end Drive verification

With the local API running, configured real Google OAuth credentials, run:

```powershell
npm run verify-drive --workspace backend
```

This creates an upload session through the guest HTTP API, uploads a real tiny PNG, checks completed-session recovery, then independently queries the exact Drive folder and verifies parent, byte length and MD5. It retains a timestamped verification image for you to inspect. It fails rather than simulating Google Drive. This command cannot run without credentials, and has not been claimed as passed before live authorization.

## Upload and security architecture

- Two concurrent file transfers per guest. Each transfer uses 4 MiB chunks (multiples of Drive's 256 KiB requirement). Maximum file size defaults to 2 GiB. The client handles gallery and camera pickers, drag/drop, object-URL previews, duplicate selection suppression, progress, separate success/failure states and manual retries. HEIC/HEIF files use a file icon because browser decoding varies.
- Guests can upload without a CAPTCHA or third-party challenge. The rate-limited authorization endpoint issues a six-hour encrypted upload-batch capability. File validation, upload limits and encrypted upload sessions remain enabled.
- Individual upload capabilities use AES-256-GCM, expire after 24 hours and conceal Drive resumable URLs. Google access/refresh tokens never leave the API. Capabilities are kept only in React memory and never logged or stored in localStorage.
- File extensions and declared size are checked on session creation. The first binary chunk is checked using actual media signatures and must match the extension. Declared browser MIME types are not trusted. Signature validation is not an antivirus scan or full media decoding; uploaded files are never executed or served by this API.
- Subsequent chunks use Drive's authoritative received offset; a retry queries status before sending bytes. Preallocated Drive IDs allow completion to be verified when a final response was lost. Expired sessions ask guests to reselect. A reload loses browser File handles and tokens: **resume works within the same open page**, not after closing/reloading the tab. Keep the page open and the phone awake for large videos; mobile browsers can suspend background transfers.
- No entire video or temporary files are buffered. Only one bounded chunk per request is buffered. Cloud Run concurrency is capped below to keep memory bounded. There is no filesystem upload storage and no instance-local session requirement, so sessions survive backend restarts.
- The API applies exact-origin CORS, origin rejection, Helmet, JSON/body limits, input validation, per-IP rate limits and safe error messages (including Drive storage exhaustion). `MAX_BATCH_FILES` controls a per-IP hourly creation budget of four batches; the frontend limits each selection to 50. The stateless batch token does not itself maintain an aggregate file/byte counter. Rate limits are instance-local: the supplied deployment caps instances at one, and limits reset on restarts. For wider public exposure or multiple instances, add Cloud Armor or an external shared rate limiter and a global byte quota before raising limits. CORS and per-IP rate limits are not global storage budgets.
- Folder and file permission changes are never made. Keep the destination folder private; remove any existing broad sharing manually if present. The wedding album is visible to visitors of this website. Images are proxied through the backend; Google access tokens, resumable upload URLs and private Drive thumbnail URLs are never returned to guests. Each image request checks that the file still belongs to this exact folder. The Drive folder remains private and is never made publicly writable.

## Deploy API to Google Cloud Run

Install/login to the Google Cloud CLI and select your project. Enable Cloud Run, Cloud Build, Artifact Registry, Secret Manager and Drive APIs. Configure billing. Create Secret Manager secrets containing the values from backend `.env`: `wedding-google-client-id`, `wedding-google-client-secret`, `wedding-google-refresh-token`, `wedding-session-secret`. Enter secret values using the Cloud Console rather than shell command arguments.

Create a dedicated runtime service account, e.g. `wedding-uploader@YOUR_PROJECT_ID.iam.gserviceaccount.com`, and grant it **Secret Manager Secret Accessor** on only those four secrets. The runtime service account is not the Drive owner: Drive access uses the owner's OAuth refresh token.

The backend Docker context must contain its own lockfile. Generate that once from the root after installing workspace dependencies:

```powershell
cd backend
npm install --package-lock-only --workspaces=false
```

Deploy from the `backend` directory, replacing project, Vercel origin, and hostname. The initial origin can be your reserved Vercel production domain, then update it once the final URL is known. No trailing slash on the origin.

```powershell
gcloud run deploy wedding-memories-api --source . --region asia-southeast1 --allow-unauthenticated --service-account wedding-uploader@YOUR_PROJECT_ID.iam.gserviceaccount.com --memory 512Mi --concurrency 8 --max-instances 1 --timeout 180 --set-env-vars "NODE_ENV=production,FRONTEND_ORIGIN=https://YOUR-SITE.vercel.app,GOOGLE_DRIVE_FOLDER_ID=1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32,TRUST_PROXY_HOPS=1" --set-secrets "GOOGLE_CLIENT_ID=wedding-google-client-id:latest,GOOGLE_CLIENT_SECRET=wedding-google-client-secret:latest,GOOGLE_REFRESH_TOKEN=wedding-google-refresh-token:latest,SESSION_SECRET=wedding-session-secret:latest"
```

Cloud Run accepts public guest HTTP requests, while Drive remains private. Verify `/health` returns `{"ok":true}` and inspect startup logs for folder access verification. Keep OAuth/session headers and request bodies out of access logs. Set billing alerts, watch Drive free storage and retest before the event. Rotate secrets and redeploy if compromised. Pin secret versions for controlled production rollouts.

## Deploy frontend to Vercel

Import this new project's repository. Set **Root Directory** to `wedding-photo-sharing/frontend` if the repository root is its parent, or `frontend` if this folder is the repository root. Enable inclusion of files outside the root for npm workspaces. Framework: Vite; build command `npm run build`; output `dist`.

Configure these build-time environment variables:

```text
VITE_API_URL=https://YOUR-CLOUD-RUN-SERVICE.run.app
VITE_PUBLIC_URL=https://YOUR-SITE.vercel.app
```

Redeploy after environment changes. Set Cloud Run `FRONTEND_ORIGIN` to the exact resulting origin. Vercel preview URLs are intentionally not auto-allowed. Set separate backend configuration for previews if needed.

## Production QR card

Open `https://YOUR-SITE.vercel.app/print`. The QR is generated locally as an SVG with high error correction and a quiet zone, and targets `VITE_PUBLIC_URL/#share`, **never Google Drive**. With no production HTTPS URL configured, the page explains the missing setting instead of encoding a placeholder. Print at 100% scale, with background graphics enabled, on A5 or 5×7 cardstock. Scan a physical proof on both iPhone and Android before printing reception copies.

## Validation and event rehearsal

```powershell
npm run build
npm test
```

On physical iPhone Safari and Android Chrome: scan the printed QR; select JPEG, HEIC, MOV and MP4; try the camera; remove and re-add a file; check duplicate suppression; upload multiple files with and without a name; interrupt connectivity during a large video and tap retry; confirm separate success and failure states and no duplicate Drive files. Keep the page in the foreground. Test invalid renamed files, files over the limit and Drive storage exhaustion using a test account. Confirm an off-origin website cannot read API responses. Verify real uploaded files appear in the specified folder and are playable. Real-device tests and real storage exhaustion cannot be replaced by a successful TypeScript build.

The album uses real photos from the configured Drive folder, with Google-generated previews for HEIC when available. The main page focuses on uploads. View album opens /album, with Add photos and Back to upload links. After a successful upload, guests can open the album from the confirmation. The gallery fetches current photos when opened; Refresh retrieves changes from other guests. The Upload button appears only after files are selected. Navigation within the app preserves selected files and upload state; album links are disabled while uploading. The gallery is paginated at 30 photos with a keyboard-accessible photo viewer. Videos can still be uploaded but are not included in the photo gallery. Google Fonts is the only remote design asset. No fabricated wedding date or location is included.
