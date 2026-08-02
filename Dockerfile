FROM node:20-alpine

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

COPY . .

RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
RUN npx next build

RUN cp -r public .next/standalone/
RUN rm -rf .next/standalone/public && ln -sf /app/public /app/.next/standalone/public
RUN cp -r .next/static .next/standalone/.next/

EXPOSE 3002

ENV NODE_ENV=production
ENV PORT=3002

CMD ["sh", "-c", "npx prisma db push --accept-data-loss 2>&1 && SEED_DEFAULT_PASSWORD=\"${SEED_DEFAULT_PASSWORD:-Admin123!}\" npx tsx prisma/seed.ts 2>&1 && node .next/standalone/server.js"]
