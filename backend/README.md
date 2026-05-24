# Signage Backend (Node.js + MariaDB)

REST API for the digital-signage React app. Hosted on Plesk, connects to MariaDB on `localhost:3306`.

## 1. Import the schema

1. Plesk → **Databases** → `mayur_` → **phpMyAdmin**
2. Open the **Import** tab
3. Choose `schema.sql` → click **Go**
4. Tables should appear: `users`, `user_roles`, `companies`, `layouts`, `devices`, `content`, `schedules`

Default login: `super@demo.com` / `ChangeMe123!` — **change immediately after first login.**

## 2. Install on Plesk

1. Plesk → **Websites & Domains** → your domain → **Node.js**
2. Click **Enable Node.js**, set:
   - Node version: 18 or 20
   - Application mode: `production`
   - Application root: `/httpdocs/signage-api` (or wherever you upload these files)
   - Application startup file: `src/server.js`
3. Upload **all files in `backend/`** to that folder via File Manager / FTP
4. Copy `.env.example` to `.env` and fill in the MariaDB password + a random `JWT_SECRET`
5. Click **NPM install** in Plesk → then **Restart App**

## 3. Test

```
curl https://yourdomain.com/signage-api/api/health
```

Should return `{"ok":true,...}`.

Login test:
```
curl -X POST https://yourdomain.com/signage-api/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"super@demo.com","password":"ChangeMe123!"}'
```

## Endpoints

- `POST /api/auth/login`
- `GET  /api/auth/me`
- CRUD on `/api/companies`, `/api/devices`, `/api/layouts`, `/api/content`, `/api/schedules`
  - `GET /` list • `GET /:id` • `POST /` • `PATCH /:id` • `DELETE /:id`
  - All except `/companies` are auto-scoped to the logged-in user's company
