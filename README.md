# L5 Fitness Console

The web console for the **admin** and the **dietitians** of L5 Fitness. Built with Next.js (JavaScript,
App Router) and Tailwind. It talks to `L5Fitness-api` and signs people in with Firebase (Google).

## Who can do what

| | Admin (only one) | Dietitian |
| --- | --- | --- |
| How they sign in | email + password from the API's `.env` | Google, **only if the admin invited their email** |
| Dashboard | whole gym | their own clients |
| Clients: details, weight, workouts | all members who agreed to share | only members assigned to them |
| Post / edit a member's diet plan | yes | their own clients only |
| Invite, disable, remove dietitians | yes | no |
| Assign members to dietitians | yes | no |
| Workouts, weekly plan, class timetable | yes | no |

Members never see this site. A person who signs in without being invited sees "No access".

## Run it

```bash
cp .env.example .env      # then fill in the Firebase values (same project as the phone app)
npm install
npm run dev               # http://localhost:3000
```

The API must be running too (`npm start` in `L5Fitness-api`, port 4000 by default).

`.env` settings (all `NEXT_PUBLIC_*`, they are public identifiers and end up in the page):

- `NEXT_PUBLIC_API_URL`: where the API lives, e.g. `http://localhost:4000` or `https://api.yourgym.com`
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._APP_ID`: Firebase Console →
  Project settings → Your apps → Web app
- `NEXT_PUBLIC_DEV_EMAIL_LOGIN`: leave **empty**. `1` shows an email + password form for developers and
  automated tests only.

## Setting up the admin and the first dietitians

1. **The admin.** In `L5Fitness-api/.env` set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (and `ADMIN_SESSION_SECRET`,
   any long random text that signs the login), then restart the API. The admin types that email and password
   in the **Admin** box on the console's login page. To change them later, edit `.env` and restart the API;
   to sign every admin out at once, change `ADMIN_SESSION_SECRET`. The login lasts 12 hours and is kept for
   that browser tab only. Ten wrong tries in 15 minutes block that email. Use a long password (12+
   characters): with `NODE_ENV=production` a shorter one switches admin sign-in off.
2. **Dietitians.** The admin opens **Dietitians**, enters the dietitian's Google email and sends the invitation.
   When that person signs in with that Google account they become a dietitian. Invitations only work for a
   **verified** email, which every Google account has.
3. **Clients.** In **Members** the admin picks a dietitian for each member. A dietitian sees a member only when
   the member finished the phone-app setup, agreed to share, and is assigned to them.

## Before going live

- Host it on **https**, and add its address in Firebase Console → Authentication → Settings → **Authorized
  domains**. Without that, Google sign-in shows "This website address is not allowed".
- Set `NEXT_PUBLIC_API_URL` to the API's public https address.
- The API must be reachable from that site (it allows any origin because it uses bearer tokens, not cookies).
- Keep `NEXT_PUBLIC_DEV_EMAIL_LOGIN` empty.

## How the pieces fit

- `lib/auth.js`: Firebase (Google) sign-in for dietitians, or the admin's email + password (`POST /staff/login`), then asks the API `GET /staff/me` who this person is. Only `admin` and an
  enabled `dietitian` get in (`ready`); anyone else is `denied`.
- `components/console-gate.js`: wraps every console page: signed out → login, denied → "No access", ready →
  sidebar and page. The menu depends on the role.
- `lib/api.js`: every call to the API, with a fresh Firebase token.
- Pages live in `app/(console)/*`. Each has a small server `page.js` (title and Next.js settings) and a
  `view.js` client component with the real screen.
- **The API is what really enforces permissions.** The pages only hide what a role cannot use; a dietitian who
  types an admin address still gets "only for the admin", and the API answers 403 to any admin request.
