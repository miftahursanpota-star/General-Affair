# Vercel Frontend and Cloudflare Backend

Cloudflare Worker and D1 remain the app's API and database. Vercel serves the existing `public/` site and proxies `/api/*` requests to the deployed Worker. No database migration or Vercel API secrets are needed.

The Worker URL is configured in `vercel.json` as `https://app-pengadaan.michaelelliawan.workers.dev`. If the Worker URL changes, update the rewrite destination and push the change.

## Deploy

The Vercel project should use the repository root and the **Other** framework preset. `vercel.json` sets the static output directory and API rewrite. Pushes to `main` trigger a Vercel deployment.

Keep `WABLAS_TOKEN`, `TARGET_PHONE`, authorization PINs, and Google Sheets settings in the existing Cloudflare Worker environment. Do not add them to Vercel or commit them to this repository.

The `public/index.html` file remains the original frontend, including its direct Google Sheets and WhatsApp links.

## Sync payment requests to Google Sheets

The Worker sends request-bayar data to the Apps Script endpoint in `google-apps-script/Code.gs`. To connect the provided Finance spreadsheet:

1. Open the spreadsheet and choose **Extensions > Apps Script**.
2. Replace the editor contents with `google-apps-script/Code.gs` and save.
3. In **Project Settings > Script Properties**, add `SHEET_SECRET_TOKEN` with a new long random value.
4. Choose **Deploy > New deployment > Web app**. Set **Execute as** to your account and **Who has access** to **Anyone**, then deploy and authorize it.
5. In the Cloudflare account that owns Worker `app-pengadaan`, set `GOOGLE_SHEET_WEBHOOK_URL` to the Apps Script web app URL and set the Worker secret `SHEET_SECRET_TOKEN` to the same random value from step 3.
6. Submit a test request and verify it appears as a new row. The Worker now reports a Sheets sync failure instead of claiming the row was added when the webhook is missing or rejects the request.

Keep the shared token private. The Apps Script checks it before appending rows, and matches values to the existing spreadsheet's header names.