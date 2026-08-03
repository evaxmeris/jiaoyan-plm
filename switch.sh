#!/bin/bash
# ─── 交研生物 PLM 开发/生产模式切换脚本 ───
# 用法:
#   bash switch.sh dev    → 启动本地开发服务器（停Docker生产容器）
#   bash switch.sh prod   → 启动Docker生产容器（停本地开发服务器）
#   bash switch.sh status → 查看当前状态

PROJECT="~/clawd/jiaoyan-plm"
DB_URL="postgresql://jiaoyan_plm:jiaoyan_plm_secret@localhost:5435/jiaoyan_plm?schema=public"
JWT_SECRET="prod-jwt-key-2026-jiaoyan-plm"
PORT=3002

case "${1:-status}" in
  dev)
    echo "🔄 切换到开发模式..."
    # 停Docker生产容器（保留数据库）
    docker stop jiaoyan-plm 2>/dev/null && echo "  ✅ Docker 生产容器已停止"
    # 确保数据库在运行
    if ! docker ps --format '{{.Names}}' | grep -q jiaoyan-plm-db; then
      cd ~/clawd/jiaoyan-plm && docker compose -p jiaoyan-plm up -d jiaoyan-plm-db 2>/dev/null
      echo "  ✅ 数据库容器已启动"
    fi
    # 同步数据库schema
    echo "  ⏳ 同步数据库 schema..."
    cd ~/clawd/jiaoyan-plm && DATABASE_URL="$DB_URL" npx prisma db push --accept-data-loss 2>&1 | tail -1
    # 同步种子数据
    echo "  ⏳ 同步种子数据..."
    cd ~/clawd/jiaoyan-plm && DATABASE_URL="$DB_URL" SEED_DEFAULT_PASSWORD="${SEED_DEFAULT_PASSWORD:-Admin123!}" npx tsx prisma/seed.ts 2>&1 | tail -1
    # 启动开发服务器
    echo "  🚀 启动开发服务器 http://localhost:$PORT"
    echo "  （按 Ctrl+C 停止）"
    echo ""
    cd ~/clawd/jiaoyan-plm && DATABASE_URL="$DB_URL" JWT_SECRET="$JWT_SECRET" UPLOAD_DIR="$HOME/clawd/data/uploads" npm run dev -- -p $PORT --hostname 0.0.0.0
    ;;
    
  prod)
    echo "🔄 切换到生产模式..."
    # 停本地开发服务器（如果 next dev 在后台运行）
    PID=$(lsof -ti:$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
      kill $PID 2>/dev/null && echo "  ✅ 开发服务器已停止（PID $PID）"
    fi
    # 确保数据库在运行
    if ! docker ps --format '{{.Names}}' | grep -q jiaoyan-plm-db; then
      cd ~/clawd/jiaoyan-plm && docker compose -p jiaoyan-plm up -d jiaoyan-plm-db 2>/dev/null
    fi
    # 启动Docker生产容器
    # 共享上传目录：bind mount 宿主 ~/clawd/data/uploads（与开发 UPLOAD_DIR 一致，文件互通）
    docker rm -f jiaoyan-plm 2>/dev/null
    docker run -d --name jiaoyan-plm \
      --network jiaoyan-plm_jiaoyan-plm-network \
      -e NODE_ENV=production \
      -e PORT=$PORT \
      -e HOSTNAME=0.0.0.0 \
      -e DATABASE_URL="postgresql://jiaoyan_plm:jiaoyan_plm_secret@jiaoyan-plm-db:5432/jiaoyan_plm?schema=public" \
      -e JWT_SECRET="$JWT_SECRET" \
      -e SEED_DEFAULT_PASSWORD="${SEED_DEFAULT_PASSWORD:-Admin123!}" \
      -e UPLOAD_DIR=/app/data/uploads \
      -v $HOME/clawd/data/uploads:/app/data/uploads \
      -p $PORT:$PORT \
      --restart unless-stopped \
      jiaoyan-plm:latest 2>&1 | tail -1
    echo "  ✅ Docker 生产容器已启动"
    echo "  🌐 http://localhost:$PORT"
    ;;
    
  status)
    echo "📊 当前状态："
    DEV_PID=$(lsof -ti:$PORT 2>/dev/null)
    if [ -n "$DEV_PID" ]; then
      echo "  🔵 开发服务器: 运行中 (PID $DEV_PID) → http://localhost:$PORT"
    else
      echo "  ⚪ 开发服务器: 未运行"
    fi
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^jiaoyan-plm$'; then
      echo "  🟢 Docker 生产容器: 运行中 → http://localhost:$PORT"
    else
      echo "  ⚪ Docker 生产容器: 未运行"
    fi
    if docker ps --format '{{.Names}}' | grep -q jiaoyan-plm-db; then
      echo "  🟢 数据库 (Docker): 运行中 → localhost:5435"
    else
      echo "  🔴 数据库: 未运行"
    fi
    ;;
    
  build)
    echo "🔨 构建生产镜像..."
    cd ~/clawd/jiaoyan-plm && docker build --network=host -t jiaoyan-plm:latest . 2>&1 | tail -3
    echo "  ✅ 构建完成"
    ;;
    
  *)
    echo "用法: bash switch.sh [dev|prod|status|build]"
    ;;
esac
