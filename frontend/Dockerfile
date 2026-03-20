FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# Dev mode for local development inside Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

