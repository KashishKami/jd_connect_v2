# attendance-app/Dockerfile
# Serves the static Attendance Web App via nginx.
# The BACKEND_URL build-arg is baked in at image build time as a
# tiny /config.js file that sets window.LOCATION_BACKEND_URL.
# The existing app.js already reads: window.LOCATION_BACKEND_URL || 'http://localhost:4000'

FROM nginx:alpine

# Build argument: the full URL of the Backend API.
# Override this in the GitHub Actions pipeline via --build-arg.
ARG BACKEND_URL=https://api.yourdomain.com

# Copy all static assets
COPY index.html app.js styles.css /usr/share/nginx/html/

# Generate a runtime config.js that sets the backend URL globally.
# This file must load BEFORE app.js — we inject it just before </head>.
RUN echo "window.LOCATION_BACKEND_URL = '${BACKEND_URL}';" \
    > /usr/share/nginx/html/config.js

# Inject <script src="/config.js"></script> just before </head>
# so it runs before app.js (which is loaded at the bottom of <body>).
RUN sed -i 's|</head>|<script src="/config.js"></script></head>|' \
    /usr/share/nginx/html/index.html

# Minimal nginx config: serve static files, all routes fallback to index.html
RUN printf '\
server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Security headers\n\
    add_header X-Frame-Options SAMEORIGIN;\n\
    add_header X-Content-Type-Options nosniff;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Disable nginx version in error pages\n\
    server_tokens off;\n\
}\n\
' > /etc/nginx/conf.d/default.conf

EXPOSE 80
