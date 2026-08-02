#!/bin/sh
set -e

echo "⏳ 执行数据库迁移..."
npx prisma migrate deploy 2>&1 || echo "⚠️ 迁移失败（可能已是最新）"

echo "⏳ 启动应用..."
exec node .next/standalone/server.js
