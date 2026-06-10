# ─── Mamba Dashboard — Next.js standalone ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Branding white-label: NEXT_PUBLIC_* precisa existir no build (é inlined pelo Next)
ARG NEXT_PUBLIC_STORE_NAME
ARG NEXT_PUBLIC_STORE_LOGO
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ACCENT
ARG NEXT_PUBLIC_ACCENT_DIM
ENV NEXT_PUBLIC_STORE_NAME=$NEXT_PUBLIC_STORE_NAME \
    NEXT_PUBLIC_STORE_LOGO=$NEXT_PUBLIC_STORE_LOGO \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_ACCENT=$NEXT_PUBLIC_ACCENT \
    NEXT_PUBLIC_ACCENT_DIM=$NEXT_PUBLIC_ACCENT_DIM
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Saída standalone do Next (server.js + node_modules mínimo)
# --chown obrigatório: clone com umask restritivo deixa 640 root e o user nextjs não lê
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
