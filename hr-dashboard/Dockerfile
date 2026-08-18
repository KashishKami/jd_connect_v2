# hr-dashboard/Dockerfile
# Serves the static HR & Admin Dashboard via nginx.
# Same BACKEND_URL injection pattern as attendance-app/Dockerfile.

FROM nginx:alpine

ARG BACKEND_URL=https://api.yourdomain.com

COPY index.html app.js styles.css /usr/share/nginx/html/

RUN echo "window.LOCATION_BACKEND_URL = '${BACKEND_URL}';" \
    > /usr/share/nginx/html/config.js

RUN sed -i 's|</head>|<script src="/config.js"></script></head>|' \
    /usr/share/nginx/html/index.html

RUN printf '\
server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    add_header X-Frame-Options SAMEORIGIN;\n\
    add_header X-Content-Type-Options nosniff;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    server_tokens off;\n\
}\n\
' > /etc/nginx/conf.d/default.conf

EXPOSE 80
