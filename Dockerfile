# Rapidín - imagen de producción (Express + SQLite + Socket.IO)
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/rapidin.db \
    BACKUP_DIR=/data/backups

# Primero solo los manifiestos: así la capa de dependencias se reutiliza si el código cambia
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# /data guarda la base de datos y las copias de seguridad: debe montarse como volumen persistente
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
