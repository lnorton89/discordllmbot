FROM node:20-alpine

WORKDIR /usr/src/app

# Copy bot package.json
COPY bot/package*.json ./bot/

# Install dependencies
WORKDIR /usr/src/app/bot
RUN npm install

# Copy shared code
WORKDIR /usr/src/app
COPY shared ./shared

# Copy bot code
COPY bot ./bot

WORKDIR /usr/src/app/bot
CMD ["npm", "start"]