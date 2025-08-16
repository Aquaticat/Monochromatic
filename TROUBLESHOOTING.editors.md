# Editor Installation & Configuration Troubleshooting

## Open workspace in development container fails

The download of VS Code Server may fail because you're not using the official Microsoft branded VS Code version.

[Download latest VS Code Server](https://update.code.visualstudio.com/latest/server-linux-x64/stable)

## Helix Editor Installation on Debian

### The PPA Problem
Helix installation guides often mention using PPAs (Personal Package Archives):
```bash
# This WILL NOT work on Debian!
sudo add-apt-repository ppa:maveonair/helix-editor
```

This fails with:
```
AttributeError: 'NoneType' object has no attribute 'people'
```

**Root cause**: PPAs are Ubuntu-specific. They don't work on Debian or Debian-based systems (except Ubuntu derivatives).

### Installation Methods for Debian

#### Method 1: Homebrew (Recommended)
Homebrew works excellently on Linux/WSL despite its macOS origins:

1. **Install Homebrew**:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Add Homebrew to PATH**:
   ```bash
   echo 'export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"' >> ~/.profile
   source ~/.profile
   ```

3. **Install Helix**:
   ```bash
   brew install helix
   ```

#### Method 2: Pre-built Binary
Download the latest release directly from GitHub:
```bash
curl -LO https://github.com/helix-editor/helix/releases/download/25.01/helix-25.01-x86_64-linux.tar.xz
tar xf helix-25.01-x86_64-linux.tar.xz
sudo mv helix-25.01-x86_64-linux/hx /usr/local/bin/
```

#### Method 3: Build from Source
For the latest features:
```bash
git clone https://github.com/helix-editor/helix
cd helix
cargo install --path helix-term --locked
```

### Common Issues and Solutions

#### Issue: Homebrew PATH Override
**Symptom**: After adding Homebrew to PATH, commands like `ls`, `cd`, etc. stop working.

**Bad** (overwrites entire PATH):
```bash
export PATH="/home/linuxbrew/.linuxbrew/bin"
```

**Good** (appends to PATH):
```bash
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
```

#### Issue: Homebrew gcc Post-install Warnings
**Symptom**: When installing Helix via Homebrew:
```
Warning: The post-install step did not complete successfully
```

**Solution**: This warning is harmless if you have system gcc installed:
```bash
# Install system gcc first
sudo apt install gcc

# Then install Helix
brew install helix
```

To avoid Homebrew installing its own gcc:
1. Ensure system gcc is installed first
2. If Homebrew already installed gcc, you can remove it:
   ```bash
   brew uninstall helix
   brew uninstall gcc  # This will auto-remove if nothing depends on it
   brew install helix  # Will use system gcc
   ```

#### Issue 4: Runtime Library Dependencies
Helix installed via Homebrew may link to Homebrew's libraries. Check with:
```bash
ldd $(which hx) | grep gcc
```

- If it shows `/home/linuxbrew/.linuxbrew/...`: Using Homebrew's gcc
- If it shows `/lib/x86_64-linux-gnu/...`: Using system gcc

### Verification
After installation, verify Helix is working:
```bash
hx --version  # Should show version
hx --health   # Shows language server status
```

### Notes
- Helix doesn't require a plugin system - language servers provide IDE features
- Configuration lives in `~/.config/helix/`
- The health check warnings about missing runtime directories are normal on fresh installs