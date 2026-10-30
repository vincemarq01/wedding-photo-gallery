# Vince & Emy — wedding photo sharing

The existing mobile React site is hosted on **Vercel**, with its server-only API connecting directly to **Google Drive API v3**. Apps Script and Cloud Run are not used by the current website. All tables use the same site and QR code. Guests do not sign in.

**Deployment:** follow [GOOGLE-DRIVE-VERCEL.md](GOOGLE-DRIVE-VERCEL.md). Keep the Vercel project root at this folder, not frontend. Push the whole updated source before redeploying.

## Features

- Simple Vince & Emy upload page, optional guest name, separate View album page, mobile two-column photo grid and swipe viewer.
- 20 photos per batch, two concurrent transfers per phone, progress, duplicate-selection prevention, removal and manual retry.
- JPG/JPEG, PNG, WebP and HEIC/HEIF, up to 10 MiB per photo. Original bytes are uploaded without resizing, conversion, compression or metadata stripping.
- Native Google Drive resumable uploads in bounded 4 MiB binary chunks. The backend does not create temporary parts or a replacement destination folder. Interrupted transfers resume within the same open page.
- The exact destination is `1Dw05UY5SdPt1jXxFv7pj4Nty1WWe1R32`. Files retain inherited Drive permissions. Website visitors can view the album through server-proxied previews.
- Server-side Google OAuth, encrypted upload sessions, media-signature/size validation, Helmet, origin checks and best-effort rate limits that account for shared venue Wi-Fi. No CAPTCHA.

## Local setup

Use Node.js 24 LTS. Run `npm install` from this folder. Copy frontend/.env.example and backend/.env.example to their respective .env files if they do not already exist; never overwrite configured credentials.

The existing backend/.env holds the owner's Google OAuth credentials and a random 64-character hex SESSION_SECRET. To generate a new session key, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep secrets private and out of Git.

If owner authorization is needed: enable Drive API in your Google Cloud project; configure the OAuth consent screen; create a Web application OAuth client with redirect URI `http://localhost:53682/callback`; set the Client ID and Secret in backend/.env; run `npm run oauth --workspace backend`. The helper saves the refresh token locally without printing it. Only the owner authorizes; guests never log in.

The fixed-folder helper requests the broad `https://www.googleapis.com/auth/drive` scope. A folder URL alone is not enough to grant access under `drive.file`; a narrower per-file setup requires an explicit owner Picker selection. Review Google verification requirements and token expiration before the event. Existing credentials may be reused while their grant remains valid.

In separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

For plain Vite, frontend/.env uses `VITE_STORAGE_PROVIDER=express` and `VITE_API_URL=http://localhost:8080`. Production uses `VITE_STORAGE_PROVIDER=google-drive` and same-origin Vercel API routes. Owner credentials are server-only Vercel settings. See the deployment guide for the complete list and the prepared ignored `.env.vercel` import file.

## Checks

```powershell
npm run build
npm test
node node_modules/typescript/bin/tsc -p api/tsconfig.json
```

The live verification command below starts an ephemeral local server with the actual Vercel adapter, uploads a valid PNG slightly larger than 4 MiB in two chunks, checks resumed/completed status, then verifies exact Drive folder, original byte length and MD5. It retains the test photo:

```powershell
node --env-file=backend/.env --import tsx scripts/verify-google-drive.mts
```

This real Drive verification has passed locally with the owner's configured account. The new production deployment still requires Vercel credentials/configuration and a redeploy. The setup has not been load-tested with 90 real phones. Test the production site on iPhone/Android and rehearse venue connectivity before printing QR cards. Available Drive storage, Google quotas and Vercel plan limits apply.

For the QR card, set VITE_PUBLIC_URL to the production website URL and open `/print` after deployment.
