# Vercel and Turso Setup

The app runs on Vercel with Turso/libSQL. Cloudflare D1 remains the source database until its data has been exported and verified in a new, empty Turso database.

## Prepare the database

1. Create a new Turso database and generate a database token.
2. Copy `.env.example` to `.env` and fill in `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Keep `.env` private; it is ignored by Git.
3. Sign in to Cloudflare with `npx wrangler login`.
4. Pause writes to the existing app during the final export to avoid losing records created after the snapshot.
5. Create the private export folder and export D1:

   ```powershell
   New-Item -ItemType Directory -Force .private
   npx wrangler d1 export db_pengadaan --remote --output .private/d1-export.sql
   ```

6. Import and verify the snapshot:

   ```powershell
   npm run migrate:d1:turso
   ```

The import script refuses a non-empty Turso database and verifies each table's row count. The SQL dump contains business and payment data; keep it private and do not commit or share it. If an import is interrupted, create a fresh empty Turso database before retrying.

## Deploy

Import the GitHub repository `miftahursanpota-star/General-Affair` in Vercel. Add every variable from `.env.example` to the Vercel project's environment settings, then deploy the `main` branch. Do not copy secret values into source files or chat.