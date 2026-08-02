# 交研生物 PLM (JY-PLM)

中山交研生物科技有限公司 - 产品研发管理系统

## 技术栈

- **前端/后端**: Next.js 16 + TypeScript
- **数据库**: PostgreSQL (OrbStack) + Prisma ORM
- **认证**: JWT（8 种角色）
- **部署**: Docker

## 快速开始

### 1. 数据库

```bash
# PostgreSQL 已在 5432 端口运行
# 创建数据库（如未创建）
docker exec trade-erp-db psql -U trade_erp -d trade_erp -c "CREATE DATABASE jiaoyan_plm;"

# 推数据库结构
npx prisma db push

# 填充种子数据
npx prisma db seed
```

### 2. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:3002
```

### 3. Docker 部署

```bash
docker compose build
docker compose up -d
# 访问 http://localhost:3002
```

## 登录账号

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@jiaoyan-bio.com | Admin123! | 总经理（CEO） |
| dev@jiaoyan-bio.com | Admin123! | 研发工程师 |

## 功能模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 🧪 研发管理 | /rnd | 原料库、配方、产品设计 |
| 📋 合规检测 | /compliance | 备案管理、检测管理 |
| 📦 供应链 | /supply | 供应商、库存、溯源、代工 |
| 🏛️ 战略资产 | /assets | 商标、专利 |
| 💰 采购审批 | /purchase | 申请→审批→采购→报销 |
| 📊 仪表盘 | / | 数据概览、到期预警 |

