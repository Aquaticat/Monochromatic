# Proto Tool Manager Troubleshooting

## Existing Rust Installation Warning

### Problem
```txt
warn: It looks like you have an existing installation of Rust at:
warn: /usr/sbin
warn: It is recommended that rustup be the primary Rust installation.
warn: Otherwise you may have confusion unless you are careful with your PATH.
warn: If you are sure that you want both rustup and your already installed Rust
warn: then please reply `y' or `yes' or set RUSTUP_INIT_SKIP_PATH_CHECK to yes
warn: or pass `-y' to ignore all ignorable checks.
error: cannot install while Rust is installed
warn: continuing (because the -y flag is set and the error is ignorable)
info: profile set to 'default'
info: default host triple is x86_64-unknown-linux-gnu
```

### Solution
Set `RUSTUP_INIT_SKIP_PATH_CHECK=yes` in your environment.

### Reasoning
It's acceptable to have a global Rust installation alongside proto's managed version.
Proto will manage the project-specific Rust version defined in `.prototools` while the global installation remains available for other uses.

### Implementation
```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export RUSTUP_INIT_SKIP_PATH_CHECK=yes
```

This allows proto to install and manage its own Rust toolchain without conflicts.