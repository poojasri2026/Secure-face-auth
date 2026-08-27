# =====================================================================
# AI Secure MFA — frontend image.
# Multi-stage: build the Vite bundle with Node, serve it with nginx.
# =====================================================================

# ---- Stage 1: build the SPA ----------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for better layer caching. Prefer a reproducible
# `npm ci` when a lockfile is present; fall back to `npm install` otherwise.
COPY package*.json ./
RUN npm ci || npm install

COPY . .

# The bundle calls the API same-origin (nginx proxies /api to the backend),
# so VITE_API_URL is empty by default. Override via build arg if you serve the
# API from a different origin.
ARG VITE_API_URL=""
ARG VITE_APP_NAME="AI Secure MFA"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_NAME=$VITE_APP_NAME

# `npm run build` runs `tsc -b && vite build`, so this also type-checks.
RUN npm run build

# ---- Stage 2: serve with nginx -------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Replace the default server block with our SPA + API-proxy config.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
    CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
