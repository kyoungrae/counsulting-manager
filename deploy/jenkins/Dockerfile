FROM node:22-bookworm-slim AS verified
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 CI=true
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js eslint.config.js firebase.json .firebaserc ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY scripts ./scripts
COPY infra/cloudflare-api-gateway ./infra/cloudflare-api-gateway
COPY electron ./electron
COPY deploy/mongo-init.js ./deploy/mongo-init.js
COPY ["documents/결과 보고서 메뉴/인재개발원 진로취업컨설팅 진행 결과 보고(2026년 2월)  _ 개발용 결과보고서 예시.xlsx", "./documents/결과 보고서 메뉴/"]
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm test
RUN node --test infra/cloudflare-api-gateway/worker.test.mjs scripts/jenkins-gateway.test.mjs
RUN ./node_modules/.bin/eslint server scripts/seed-user.js scripts/import-users.js deploy/mongo-init.js src/lib/api.js src/contexts/AuthContext.jsx src/routes/ProtectedRoute.jsx src/pages/LoginPage.jsx src/App.jsx src/components/Sidebar.jsx electron/main.cjs vite.config.js
RUN npm run build
