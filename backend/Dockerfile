FROM node:20-bookworm-slim
WORKDIR /app

ENV TZ=America/Toronto

RUN apt-get update && apt-get install -y --no-install-recommends curl tzdata \
	&& rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p /app/uploads /app/backups

EXPOSE 3001

CMD sh -c "for i in 1 2 3 4 5; do npx prisma db push && break || (echo 'Prisma schema sync failed, retrying...' && sleep 3); done; npx prisma db seed || true; node src/server.js"