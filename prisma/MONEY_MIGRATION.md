# Exact-money migration runbook

The migration in `migrations/20260804130000_decimal_money/migration.sql` changes
money columns from floating point to `DECIMAL(18,2)`. It is transactional and
stops before the first schema change if any existing value would need rounding,
truncation, or replacement.

## Staging validation

1. Restore a recent production backup into an isolated staging database.
2. Set `STAGING_DATABASE_URL` to that database and run:

   ```powershell
   npm run db:check-money-readiness
   ```

3. Point `DATABASE_URL` to the same staging database and run:

   ```powershell
   npm run db:migrate:deploy
   npm run test:write-safety
   npm run build
   ```

4. In staging, exercise one sale for each payment method, a purchase, an expense,
   a stock transfer, a customer payment, and a supplier payment. Confirm their
   stock movements, bank transactions, balances, and audit records.
5. Submit two simultaneous sales for the last available unit. Exactly one must
   succeed; the other must return a conflict or insufficient-stock message.

## Production deployment

1. Take and verify a fresh backup.
2. Stop write traffic for the migration window.
3. Run `npm run db:check-money-readiness` against a read-only production clone.
4. Run `npm run db:migrate:deploy` against production.
5. Deploy the application and perform the staging smoke checks again.

The normal `deploy.sh` intentionally does not apply database migrations.
