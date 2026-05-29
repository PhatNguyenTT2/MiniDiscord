-- Initialize secondary database 'discord_mini_groups' because POSTGRES_DB env variable only initializes one.
SELECT 'CREATE DATABASE discord_mini_groups'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'discord_mini_groups')\gexec
