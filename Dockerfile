FROM node:20-alpine AS builder

# Build argument for which project to build
ARG PROJECT=exa-search

# Install proto
RUN apk add --no-cache curl bash git
RUN curl -fsSL https://moonrepo.dev/install/proto.sh | bash
ENV PATH="/root/.proto/bin:/root/.proto/shims:$PATH"

WORKDIR /app

# Copy proto config
COPY .prototools .prototools

# Install tools via proto
RUN proto install

# Copy the entire monorepo
COPY . .

# Run moon prepare (builds all projects)
RUN moon run prepare

# Production stage
FROM nginx:alpine

ARG PROJECT=exa-search

# Copy built files from builder
COPY --from=builder /app/packages/site/${PROJECT}/dist/final/js/index.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]