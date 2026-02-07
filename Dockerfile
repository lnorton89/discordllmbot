FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

CMD ["npm", "run", "start"]