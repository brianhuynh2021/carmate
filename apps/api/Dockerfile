FROM node:20-alpine
WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm install --workspace=@carmate/shared --workspace=@carmate/api --omit=dev

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 4000
ENV PORT=4000
ENV NODE_ENV=production

CMD ["npm", "run", "start", "--workspace=@carmate/api"]
