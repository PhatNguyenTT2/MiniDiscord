#!/bin/bash
# ══════════════════════════════════════════════════════════
# MiniDiscord — Production Database Cleanup Script (Bash)
# ══════════════════════════════════════════════════════════
# Clears ALL data from production databases (old dev/prod test data).
# Targets: Supabase PostgreSQL, MongoDB Atlas, Upstash Redis
#
# Prerequisites:
#   - Docker running (uses postgres and mongo containers for clients)
#   - curl
# ══════════════════════════════════════════════════════════

set -e

# Load credentials from .env.prod
ENV_FILE="$(dirname "$0")/../.env.prod"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "\e[31mERROR: .env.prod not found at: $ENV_FILE\e[0m"
    exit 1
fi

echo "Loading environment variables from $ENV_FILE..."
# Read keys and extract them, filtering out comments
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Safety Gate
echo -e "\n\e[31m=========================================="
echo "  WARNING: PRODUCTION DATABASE CLEANUP    "
echo "  This will DELETE ALL DATA from:         "
echo "                                          "
echo "  1. PostgreSQL (Supabase) - users        "
echo "  2. PostgreSQL (Supabase) - groups       "
echo "  3. MongoDB (Atlas)       - messages     "
echo "  4. Redis (Upstash)       - cache        "
echo "==========================================\e[0m\n"

read -p "Type 'DELETE-PROD-DATA' to confirm: " confirm1
if [ "$confirm1" != "DELETE-PROD-DATA" ]; then
    echo -e "\e[33mAborted.\e[0m"
    exit 0
fi

echo -e "\n\e[31mFINAL WARNING: This is IRREVERSIBLE!\e[0m"
read -p "Type 'YES' to proceed: " confirm2
if [ "$confirm2" != "YES" ]; then
    echo -e "\e[33mAborted.\e[0m"
    exit 0
fi

echo -e "\nStarting cleanup..."

# 1. PostgreSQL — User Service (Supabase)
echo -e "\n-- [1/4] PostgreSQL: User Service --"
USER_HOST="aws-1-ap-southeast-2.pooler.supabase.com"
USER_PORT="6543"
USER_SQL="TRUNCATE TABLE friendships CASCADE; TRUNCATE TABLE users CASCADE;"

if docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine psql -h "$USER_HOST" -p "$USER_PORT" -U "$USER_DB_USERNAME" -d postgres -c "$USER_SQL"; then
    echo -e "\e[32m OK: User DB cleared (users, friendships)\e[0m"
else
    echo -e "\e[31m FAIL: User DB cleanup failed\e[0m"
fi

# 2. PostgreSQL — Group/Channel Service (Supabase)
echo -e "\n-- [2/4] PostgreSQL: Group/Channel Service --"
GROUP_HOST="aws-1-ap-northeast-1.pooler.supabase.com"
GROUP_PORT="6543"
GROUP_SQL="TRUNCATE TABLE room_participants CASCADE; TRUNCATE TABLE channels CASCADE; TRUNCATE TABLE rooms CASCADE;"

if docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine psql -h "$GROUP_HOST" -p "$GROUP_PORT" -U "$GROUP_DB_USERNAME" -d postgres -c "$GROUP_SQL"; then
    echo -e "\e[32m OK: Group DB cleared (rooms, channels, room_participants)\e[0m"
else
    echo -e "\e[31m FAIL: Group DB cleanup failed\e[0m"
fi

# 3. MongoDB Atlas — Chat History
echo -e "\n-- [3/4] MongoDB Atlas: Chat History --"
if docker run --rm mongo:7 mongosh "$MONGODB_URI" --quiet --eval "db = db.getSiblingDB('ChatHistoryService'); db.messages.deleteMany({}); db.read_receipts.deleteMany({}); print('OK: messages=' + db.messages.countDocuments() + ' read_receipts=' + db.read_receipts.countDocuments());"; then
    echo -e "\e[32m OK: MongoDB cleared (messages, read_receipts)\e[0m"
else
    echo -e "\e[31m FAIL: MongoDB cleanup failed\e[0m"
fi

# 4. Redis (Upstash) — Cache flush via REST
echo -e "\n-- [4/4] Redis Upstash: Cache --"
if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PASSWORD" ]; then
    REST_URL="https://$REDIS_HOST/FLUSHALL"
    RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $REDIS_PASSWORD" "$REST_URL")
    echo -e "\e[32m OK: Redis flushed ($RESPONSE)\e[0m"
else
    echo -e "\e[31m FAIL: Redis credentials missing in .env.prod\e[0m"
fi

echo -e "\n\e[36m=========================================="
echo " Production cleanup completed!"
echo " Schema auto-recreates on next boot."
echo "==========================================\e[0m"
