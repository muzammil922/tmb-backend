# TMB Production Deploy Guide

## Architecture

- **Backend** → Dokploy (self-hosted) → `https://api.yourdomain.com`
- **Website** → Vercel → `https://your-website.vercel.app`
- **Admin** → Vercel → `https://your-admin.vercel.app`
- **Database** → Neon PostgreSQL (external)

---

## 1. Dokploy — Backend (`tmb-backend`)

Repository: https://github.com/muzammil922/tmb-backend

| Setting | Value |
|---------|-------|
| Build Type | **Dockerfile** (not Nixpacks) |
| Dockerfile path | `Dockerfile` |
| Port | 4000 |
| Start command | Leave empty (Dockerfile CMD runs `node dist/main.js`) |

> **Important:** If logs show `nest start` and Node 18, Dokploy is using Nixpacks instead of the Dockerfile. Switch Build Type to **Dockerfile** and redeploy.

### Environment variables (Dokploy UI only — never commit)

```env
NODE_ENV=production
PORT=4000

DATABASE_URL=<neon-direct-url>?sslmode=require

JWT_SECRET=<random-32+-chars>
JWT_REFRESH_SECRET=<random-32+-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

TMDB_READ_ACCESS_TOKEN=<your-token>
TMDB_API_KEY=<your-key>
TMDB_BASE_URL=https://api.themoviedb.org/3

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

WEBSITE_URL=https://your-website.vercel.app
ADMIN_URL=https://your-admin.vercel.app

REDIS_URL=

ADMIN_EMAIL=admin@tmb.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=TMB Admin
```

**Verify:** `GET /api/health` and `/api/docs`

**Neon URL:** Use the **direct** connection string (no `-pooler` in hostname) for `DATABASE_URL` so `prisma migrate deploy` works on startup. Example host: `ep-xxx.c-2.us-east-2.aws.neon.tech` (not `ep-xxx-pooler...`).

**Security:** Rotate Neon password if it was ever shared publicly.

---

## 2. Vercel — Website (`tmb-website`)

Repository: https://github.com/muzammil922/tmb-website

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

---

## 3. Vercel — Admin (`tmb-frontend`)

Repository: https://github.com/muzammil922/tmb-frontend

```env
VITE_API_URL=https://api.yourdomain.com/api
```

Redeploy admin after changing `VITE_API_URL`.

---

## Deploy order

1. Deploy backend on Dokploy → get API URL
2. Deploy website + admin on Vercel with API URL in env
3. Update backend `WEBSITE_URL` + `ADMIN_URL` in Dokploy with Vercel URLs
4. Redeploy backend (CORS)
5. Test login on admin + browse on website

---

## Still needed from you

| Item | Required |
|------|----------|
| TMDB READ_ACCESS_TOKEN | Yes |
| Neon DATABASE_URL (new password) | Yes |
| Dokploy API domain | Yes |
| Vercel URLs for CORS | Yes |
| Cloudinary | Optional (video upload) |
| Upstash Redis | Optional |
