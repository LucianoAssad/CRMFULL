FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "serve -s dist -p ${PORT:-3000}"]
