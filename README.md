# TMB Backend API

NestJS API for the TMB Movie Platform. Deploy on Dokploy with Neon PostgreSQL.

## Local development

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
```

API: http://localhost:4000/api  
Swagger: http://localhost:4000/api/docs

## Dokploy deploy

1. Connect GitHub repo `muzammil922/tmb-backend`
2. Build type: **Dockerfile**
3. Port: **4000**
4. Set environment variables from `.env.example` (use real values in Dokploy UI only)
5. Deploy and verify `/api/health`

## Default admin (after seed)

- Email: `admin@tmb.com`
- Password: `Admin@123456`
