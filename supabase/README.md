# RepCurve's backend: usernames and feedback

Training data never leaves the phone. This small Supabase database holds two things:

- `accounts`: one row per person: their username, a random ID made on their phone, and a hash of a secret only their phone (and their backups) know.
- `feedback`: what people send from Settings → Send feedback, with their username, the app version (`build`), channel (`main` or `test`), style, phone and browser, and how many workouts they've logged.

The app reaches the database only through four functions in `schema.sql` (`username_status`, `claim_username`, `send_feedback`, `delete_account`). The tables have row level security turned on and no policies, so the public key can't read or change them directly.

Until the two repository variables below are set, both apps build without usernames or feedback, and the privacy note says nothing is sent.

## Set it up (about 10 minutes)

1. **Create a project.** Sign up at [supabase.com](https://supabase.com) and create a new project on the free plan. Pick the region nearest your users, and save the database password somewhere safe (the app doesn't need it).
2. **Create the tables and functions.** In the project, open **SQL Editor**, start a new query, paste the whole of [`schema.sql`](schema.sql), and click **Run**. It's safe to run again after a change.
3. **Copy two values** from the project's API settings (**Project Settings → API**, or **API Keys**):
   - the **Project URL**, like `https://abcdefgh.supabase.co`;
   - the **public key**: either the *anon public* key (starts with `eyJ`) or the *publishable* key (starts with `sb_publishable_`).

   Never use the *service_role* or *secret* key: that one can read and change everything.
4. **Give them to the app's build.** On GitHub, open the repository's **Settings → Secrets and variables → Actions → Variables** tab and add two repository variables:
   - `SUPABASE_URL`: the Project URL;
   - `SUPABASE_KEY`: the public key.

   They're variables rather than secrets because the public key ends up in the app anyway; that's how Supabase is meant to be used.
5. **Deploy.** Push to `main` or `test`, or run the **Deploy web app** workflow by hand. Usernames and feedback then appear in the app. People who already use RepCurve see a "Pick a username" card on Today.

## Reading what comes in

- **Table Editor → `feedback`**: newest first with `created_at`. `username` is empty for feedback sent without a username, or from someone who has since deleted their data.
- **Table Editor → `accounts`**: everyone with a username, and when they joined.

Or in the SQL Editor:

```sql
select created_at, username, message, meta->>'channel' as channel, meta->>'build' as build
from feedback order by created_at desc limit 50;

select count(*) as people, max(created_at) as newest from accounts;
```

## Good to know

- **Free projects pause** after about a week without any requests. The app then says it can't reach the server and carries on without it. Restore the project from the Supabase dashboard.
- **Limits.** At most 300 new usernames an hour in all, 20 pieces of feedback an hour from one person, and 500 an hour in all. This is enough to stop a script flooding the database. Names are first come, first served, and a few that would look official (`admin`, `support`, `repcurve`…) are reserved.
- **Deleting.** Settings → Start over → Reset all data also deletes the person's username. Their feedback stays, without their name. To delete an account yourself, delete its row in `accounts`.
- **Local development.** Put the two values in `apps/web/.env.local` (ignored by git) as `VITE_SUPABASE_URL=…` and `VITE_SUPABASE_KEY=…`.
- **Tests.** `supabase/test.sh` runs `schema.sql` and `test.sql` against a throwaway local PostgreSQL (version 16 or newer), with the same roles Supabase gives the public key. The app's end-to-end tests use a stand-in for the server (`apps/web/e2e/backend.ts`).
