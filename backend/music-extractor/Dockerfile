FROM node:20-alpine

WORKDIR /app

COPY music-extractor/package*.json ./

RUN npm install --only=production

COPY music-extractor/ .

EXPOSE 3001

CMD ["npm", "start"]
