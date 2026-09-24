#!/bin/bash

# RECOMMENDED DEPLOY FLOW FOR CPANEL
echo "Starting deployment process..."

# 1. Pull latest changes
echo "Pulling latest code..."
git pull origin main

# 2. Always clean before build
echo "Cleaning old build files..."
rm -rf .next generated node_modules/.cache

# 3. Always regenerate Prisma Client
echo "Generating Prisma Client..."
node scripts/run-prisma.mjs generate --schema=prisma/schema.prisma

# 4. Database schema changes are intentionally not applied automatically.
# Production migrations must be reviewed and run separately before deployment.
echo "Skipping database schema changes..."

# 5. Build Next.js application
echo "Building Next.js app..."
node scripts/run-next-build.mjs

# 6. Always restart passenger after build
echo "Restarting passenger..."
mkdir -p tmp
: > "$HOME/logs/passenger.log"
touch tmp/restart.txt

echo "Deployment completed successfully!"
