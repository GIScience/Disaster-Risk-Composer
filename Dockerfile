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
# Stock nginx serves everything uncompressed - the JS bundles and GeoJSON in
# public/data shrink to roughly a third with gzip.
RUN printf '%s\n' \
  'gzip on;' \
  'gzip_comp_level 6;' \
  'gzip_min_length 1024;' \
  'gzip_vary on;' \
  'gzip_types text/css application/javascript application/json application/geo+json image/svg+xml;' \
  > /etc/nginx/conf.d/gzip.conf
COPY --from=build-step /app/dist /usr/share/nginx/html

EXPOSE 80
