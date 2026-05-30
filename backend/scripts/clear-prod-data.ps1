#!/usr/bin/env pwsh
# ══════════════════════════════════════════════════════════
# MiniDiscord — Production Database Cleanup Script
# ══════════════════════════════════════════════════════════
# Clears ALL data from production databases (old dev data).
# Targets: Supabase PostgreSQL, MongoDB Atlas, Upstash Redis
#
# Prerequisites:
#   - Docker running (uses postgres container for psql)
#   - mongosh (npm install -g mongosh)
# ══════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

# ── Load credentials from .env.prod ──
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.prod"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.prod not found at: $envFile" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim()
        Set-Variable -Name $key -Value $val -Scope Script
    }
}

# ── Safety Gate ──
Write-Host ""
Write-Host "==========================================" -ForegroundColor Red
Write-Host "  WARNING: PRODUCTION DATABASE CLEANUP    " -ForegroundColor Red
Write-Host "  This will DELETE ALL DATA from:         " -ForegroundColor Red
Write-Host "                                          " -ForegroundColor Red
Write-Host "  1. PostgreSQL (Supabase) - users        " -ForegroundColor Red
Write-Host "  2. PostgreSQL (Supabase) - groups        " -ForegroundColor Red
Write-Host "  3. MongoDB (Atlas)       - messages     " -ForegroundColor Red
Write-Host "  4. Redis (Upstash)       - cache        " -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""

$confirm1 = Read-Host "Type 'DELETE-PROD-DATA' to confirm"
if ($confirm1 -ne "DELETE-PROD-DATA") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "FINAL WARNING: This is IRREVERSIBLE!" -ForegroundColor Red
$confirm2 = Read-Host "Type 'YES' to proceed"
if ($confirm2 -ne "YES") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting cleanup..." -ForegroundColor Cyan

# ═══════════════════════════════════════════
# 1. PostgreSQL — User Service (Supabase)
# ═══════════════════════════════════════════
Write-Host ""
Write-Host "-- [1/4] PostgreSQL: User Service --" -ForegroundColor Cyan

$userHost = "aws-1-ap-southeast-2.pooler.supabase.com"
$userPort = "6543"
$userSql = "TRUNCATE TABLE friendships CASCADE; TRUNCATE TABLE users CASCADE;"

try {
    docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine psql -h $userHost -p $userPort -U "$USER_DB_USERNAME" -d postgres -c "$userSql"
    Write-Host " OK: User DB cleared (users, friendships)" -ForegroundColor Green
} catch {
    Write-Host " FAIL: User DB - $($_.Exception.Message)" -ForegroundColor Red
}

# ═══════════════════════════════════════════
# 2. PostgreSQL — Group/Channel Service (Supabase)
# ═══════════════════════════════════════════
Write-Host ""
Write-Host "-- [2/4] PostgreSQL: Group/Channel Service --" -ForegroundColor Cyan

$groupHost = "aws-1-ap-northeast-1.pooler.supabase.com"
$groupPort = "6543"
$groupSql = "TRUNCATE TABLE room_participants CASCADE; TRUNCATE TABLE channels CASCADE; TRUNCATE TABLE rooms CASCADE;"

try {
    docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine psql -h $groupHost -p $groupPort -U "$GROUP_DB_USERNAME" -d postgres -c "$groupSql"
    Write-Host " OK: Group DB cleared (rooms, channels, room_participants)" -ForegroundColor Green
} catch {
    Write-Host " FAIL: Group DB - $($_.Exception.Message)" -ForegroundColor Red
}

# ═══════════════════════════════════════════
# 3. MongoDB Atlas — Chat History
# ═══════════════════════════════════════════
Write-Host ""
Write-Host "-- [3/4] MongoDB Atlas: Chat History --" -ForegroundColor Cyan

try {
    mongosh "$MONGODB_URI" --quiet --eval "db = db.getSiblingDB('ChatHistoryService'); db.messages.deleteMany({}); db.read_receipts.deleteMany({}); print('OK: messages=' + db.messages.countDocuments() + ' read_receipts=' + db.read_receipts.countDocuments());"
    Write-Host " OK: MongoDB cleared (messages, read_receipts)" -ForegroundColor Green
} catch {
    Write-Host " FAIL: MongoDB - $($_.Exception.Message)" -ForegroundColor Red
}

# ═══════════════════════════════════════════
# 4. Redis (Upstash) — Cache flush via REST
# ═══════════════════════════════════════════
Write-Host ""
Write-Host "-- [4/4] Redis Upstash: Cache --" -ForegroundColor Cyan

try {
    $restUrl = "https://$REDIS_HOST/FLUSHALL"
    $headers = @{ "Authorization" = "Bearer $REDIS_PASSWORD" }
    $result = Invoke-RestMethod -Uri $restUrl -Headers $headers -Method Post
    Write-Host " OK: Redis flushed ($result)" -ForegroundColor Green
} catch {
    Write-Host " FAIL: Redis - $($_.Exception.Message)" -ForegroundColor Red
}

# ═══════════════════════════════════════════
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Production cleanup completed!" -ForegroundColor Green
Write-Host " Schema auto-recreates on next boot." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan
