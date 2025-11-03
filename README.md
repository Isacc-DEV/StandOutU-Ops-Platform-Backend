# Ops Platform Backend

Node.js + Express API providing authentication, applicant workflows, and supporting services for the Ops Platform frontend.

## Tech Stack
- Express 4 API with modular route/controllers
- Prisma ORM with PostgreSQL
- JWT authentication and role-based middleware
- Multer + PDFKit/Docx helpers for resume generation and uploads

## Prerequisites
- Node.js 18 or newer
- PostgreSQL 14+ (update the connection string as needed)

## Environment
Copy the example file and adjust credentials before booting the server:
```bash
cp .env.example .env
```

Key variables:
- `PORT` — API port, defaults to `4000`
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — token signing secret
- `CLIENT_ORIGIN` — allowed CORS origin for the frontend

## Installation
```bash
npm install
npm run prisma:generate
```

## Database Migrations & Seed
Apply migrations and seed development data:
```bash
npm run prisma:migrate
npm run seed
```
The seed script provisions an initial admin account:
- Email: `admin@ops.local`
- Password: `password123`

## Development Server
```bash
npm run dev
```
The API listens on `http://localhost:4000`. Update the client's `VITE_API_URL` when running on a different host or port.

## Production
```bash
npm run start
```
Make sure you have run database migrations and provided production-ready environment variables before starting.

## Useful Scripts
- `npm run permissions:migrate` — regenerate application permission definitions
- `npm run prisma:generate` — regenerate Prisma client types
- `npm run prisma:migrate` — deploy Prisma migrations
- `npm run seed` — populate development fixtures
