# Deploy this project to Vercel

**Current setup:** React on Vercel plus Apps Script for Drive storage. Follow [apps-script/README.md](apps-script/README.md), set `APPS_SCRIPT_URL` and `APPS_SCRIPT_SECRET` as server-only Vercel variables, and set `VITE_STORAGE_PROVIDER=apps-script`. The root deployment includes `/api/photos`. No Cloud Run or production `VITE_API_URL` is needed in this mode. Use this project root as Vercel Root Directory.

## Legacy Express / Cloud Run instructions

1. Push this project's source to a Git repository. Keep `.env` files out of Git; never manually upload them. The Google credentials stay only in backend local configuration and Cloud Run Secret Manager.
2. In Vercel, choose **Add New → Project → Import Git Repository**.
3. Set **Root Directory** to the directory containing this file: `wedding-photo-sharing` if that folder is inside the repository, or `./` if it is the repository root. Use this root-level configuration instead of selecting `frontend`.
4. The committed configuration uses framework Vite, install command `npm ci`, build command `npm run build --workspace frontend`, and output directory `frontend/dist`. Select Node.js 24.
5. Add production build environment variables:

   ```text
   VITE_API_URL=https://YOUR-DEPLOYED-CLOUD-RUN-SERVICE.run.app
   VITE_PUBLIC_URL=https://YOUR-PRODUCTION-SITE.vercel.app
   ```

   These URLs are public. Do not put Google client secrets, refresh tokens or `SESSION_SECRET` in Vercel or in any `VITE_*` variable. Do not use localhost for the production API URL.
6. Deploy. If the final frontend domain differs from `VITE_PUBLIC_URL`, update that variable and redeploy to generate the correct QR card.
7. On Cloud Run, set `FRONTEND_ORIGIN` to the exact Vercel production origin, without a trailing slash. Follow the Cloud Run setup in README.md if the backend is still local.
8. Verify `/`, `/album`, and `/print` directly, then upload an actual photo from a phone and check the destination Drive folder. The frontend can be published before the backend is ready, but uploads and album loading will not work until the backend URL and CORS origin match.

CLI alternative from this directory: `npx vercel login`, then `npx vercel` for a preview, and `npx vercel --prod` for production after configuring the variables. Vercel login must be authorized by the account owner.
