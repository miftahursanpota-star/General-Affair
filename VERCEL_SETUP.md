# Vercel Frontend and Cloudflare Backend

Cloudflare Worker and D1 remain the app's API and database. Vercel serves the existing `public/` site and proxies `/api/*` requests to the deployed Worker. No database migration or Vercel API secrets are needed.

The Worker URL is configured in `vercel.json` as `https://app-pengadaan.michaelelliawan.workers.dev`. If the Worker URL changes, update the rewrite destination and push the change.

## Deploy

The Vercel project should use the repository root and the **Other** framework preset. `vercel.json` sets the static output directory and API rewrite. Pushes to `main` trigger a Vercel deployment.

Keep `WABLAS_TOKEN`, `TARGET_PHONE`, authorization PINs, and Google Sheets settings in the existing Cloudflare Worker environment. Do not add them to Vercel or commit them to this repository.

The `public/index.html` file remains the original frontend, including its direct Google Sheets and WhatsApp links.