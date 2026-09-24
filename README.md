# Pharmacy

Pharmacy inventory, sales, purchasing, and branch management for Bole, Piazza, and Merkato. Built with Next.js and Prisma.

Each branch has its own dispensary stock, store stock, sales, and finance.

## Run Locally

**Prerequisites:** Node.js and a Postgres database.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in the required values.
3. Prepare the database: `npm run db:push`
4. Load pharmacy branches, units, and the medicine catalog: `npm run db:seed`
5. Run the app: `npm run dev`

Demo logins after seeding:

- `admin` / `2343` — all pharmacies
- `sales1` / `1234` — Bole Pharmacy
- `sales2` / `1234` — Piazza Pharmacy
- `sales3` / `1234` — Merkato Pharmacy

## Environment Variables

Required:

- `DATABASE_URL`: Postgres connection string used by Prisma.
- `NEXTAUTH_SECRET`: Long random secret for signing NextAuth session tokens.
- `NEXTAUTH_URL`: Canonical production URL, for example `https://stock.example.com`.

Optional Telegram alerts (one shared chat; each message starts with the pharmacy name):

- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather.
- `TELEGRAM_CHAT_ID`: One or more chat/group ids (comma-separated), shared across pharmacies.
- `CRON_SECRET`: Bearer secret for `/api/cron/daily-overview` (10pm EAT digests).

When both Telegram env vars are set, sale/purchase/transfer/adjustment alerts and the nightly digest send automatically for every pharmacy.
