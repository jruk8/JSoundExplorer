FROM node:22-alpine
WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.mjs ./
ENV PORT=3001
EXPOSE 3001
CMD ["node", "index.mjs"]
