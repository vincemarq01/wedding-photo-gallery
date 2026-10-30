# Deploy on Vercel

Use [GOOGLE-DRIVE-VERCEL.md](GOOGLE-DRIVE-VERCEL.md) for the current Google Drive API setup. The frontend and server-only Drive API run on Vercel; Apps Script and Cloud Run are not required.

- Root Directory: this wedding-photo-sharing project root (not frontend).
- Install: `npm ci`.
- Build: `npm run build --workspace frontend`.
- Output: `frontend/dist`.
- Node.js: 24.x.
- Server API: `api/drive.ts`; root vercel.json rewrites the upload/album endpoints to it while keeping `/album` and `/print` as React pages.

Import the prepared local ignored `.env.vercel` file into production Vercel environment settings for server-only credentials. Never commit or share that file. Set `VITE_STORAGE_PROVIDER=google-drive` and `VITE_PUBLIC_URL` separately as Config. Then redeploy the updated Git commit.

No Google credential should have a VITE_ prefix. Google secrets must stay on the server. Remove the obsolete Apps Script settings when the migration is active.