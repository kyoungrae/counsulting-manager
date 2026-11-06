FROM mongo:8.0
# Build context is the repository root. No Jenkins-host bind mount is needed.
COPY deploy/mongo-init.js /docker-entrypoint-initdb.d/10-app-user.js
