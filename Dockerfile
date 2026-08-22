FROM node:22-slim
RUN apt-get update && apt-get install -y wget gnupg
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npx playwright install chromium --with-deps
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
# Force rebuild Sat Aug 22 15:55:32 BST 2026
