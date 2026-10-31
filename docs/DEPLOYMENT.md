# Frozen-product deployment record

## Verified endpoint

- Production alias: https://mizflow-po-assessment.vercel.app
- Hosting: Vercel; existing Next.js application, no new product capability added during publication.
- Backend: the already configured Supabase development/demo project. No new database reset or migration was performed during packaging.

Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are needed for normal requests. Both were configured in Vercel's production environment. Administrative DB credentials, seed Auth keys, demo passwords and local delivery files were not deployment variables. `.vercelignore` excludes `.env*`, `.local`, source-control metadata, dependencies and generated test/build outputs.

Deployment reported READY. The production alias was checked without hosting authentication: `/login` returned 200, `/api/operations?view=tables` returned 401 anonymously, and the Persian login rendered. All three role accounts subsequently passed read-only HTTPS login/navigation/control/cookie/logout checks. These checks did not place orders or modify restaurant data.

## Re-deploy without changing product behavior

From a configured account/project, review the public environment settings and use the existing build scripts:

```sh
npx vercel deploy --prod
```

Do not copy `.env.admin.local`, `.env.seed.local` or `.env.test.local` into hosting configuration. A preview may have Vercel protection; the production alias above was separately verified public at the hosting layer. Application data still requires actual Supabase authentication and membership.

Hosted Auth signup/rate limits, production recovery settings, monitoring, secret rotation and backup restoration remain separate rollout work. No claim that a READY deployment establishes those controls is made.

Official references: [Vercel CLI deployment](https://vercel.com/docs/cli/deploy) and [environment-variable management](https://vercel.com/docs/cli/env).
