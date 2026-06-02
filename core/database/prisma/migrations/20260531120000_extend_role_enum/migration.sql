-- Extend Role enum for venue staff granularity (mobile maps to ADMIN | STAFF | CUSTOMER buckets).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'KITCHEN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CASHIER';
