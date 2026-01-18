FROM debian:latest

RUN apt-get update

RUN apt-get install -y \
    curl \
    git \
    unzip

WORKDIR /app

# Copy the entire monorepo
COPY . .

# Build all projects
# Running the allowFailure variant because tsc may throw errors unrelated to active work
RUN mise run build--allowFailure
