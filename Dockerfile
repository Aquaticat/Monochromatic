FROM debian:latest

# Install dependencies needed by proto
RUN apt-get update

RUN apt-get install -y \
    curl \
    xz-utils \
    unzip \
    git

# Install proto non-interactively
RUN bash -c "$(curl -fsSL https://moonrepo.dev/install/proto.sh)" -- --yes
ENV PATH="/root/.proto/bin:/root/.proto/shims:$PATH"

WORKDIR /app

# Copy the entire monorepo
COPY . .

RUN proto install

# Run moon prepare and build (builds all projects)
# Eventually the tasks would be fixed so we don't need the allowFailure variant.
# Right now it doesn't build because we're not auto setting up snap when installing Vale.
# We're migrating off Vale anyway.
# To Code Spell Checker or Harper
#
# Update: We're forgoing all the prepare steps because they take too long.
# Still using the allowFailure variant of the build task because right now tsc throws some errors unrelated to what we're working on.
RUN moon run buildAllowFailure

CMD ["moon", "run", "start"]
