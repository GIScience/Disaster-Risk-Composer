FROM node:24 AS build-step

RUN mkdir /app
WORKDIR /app

# install dependencies
COPY package.json package-lock.json /app/
RUN --mount=type=cache,target=/root/.npm npm install

# copy relevant files
COPY tsconfig.json tsconfig.app.json tsconfig.node.json postcss.config.js tailwind.config.js vite.config.ts typed-router.d.ts index.html /app/

# copy relevant folders
COPY src /app/src
COPY public /app/public

# build
RUN --mount=type=cache,target=/root/.npm npm run build

FROM nginx:alpine-slim
RUN echo 'absolute_redirect off;' > /etc/nginx/conf.d/redirect.conf
COPY --from=build-step /app/dist /usr/share/nginx/html

EXPOSE 80
