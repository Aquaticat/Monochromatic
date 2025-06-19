## Generate entire `package.json` automatically from `package.jsonc` and make it bidirectional update.

## WSL Debian Distro - Selective Windows Directory Mounting

### Overview
Configure Debian WSL distro to mount only specific Windows directories instead of auto-mounting all drives, improving security while maintaining access to development files.

### Required Mount Points

- `/mnt/c/Users/user/Text/Projects` - Development projects
- `/mnt/c/Users/user/.pnpm-store` - pnpm global package store

### Configuration Steps

#### 1. Edit WSL Configuration
```bash
sudo nano /etc/wsl.conf
```

Add:
```ini
[automount]
enabled = false
mountFsTab = true
```

#### 2. Create Mount Points
```bash
sudo mkdir -p /mnt/c/Users/user/Text/Projects
sudo mkdir -p /mnt/c/Users/user/.pnpm-store
```

#### 3. Configure fstab
```bash
sudo nano /etc/fstab
```

Add:
```
C:/Users/user/Text/Projects /mnt/c/Users/user/Text/Projects drvfs defaults,uid=1000,gid=1000 0 0
C:/Users/user/.pnpm-store /mnt/c/Users/user/.pnpm-store drvfs defaults,uid=1000,gid=1000 0 0
```

#### 4. Apply Changes Without Full WSL Restart

Option A - Restart only Debian distro:
```powershell
# From Windows PowerShell
wsl -t Debian
```

Option B - Apply in current session (temporary):
```bash
# Unmount existing
sudo umount /mnt/c 2>/dev/null

# Mount manually
sudo mount -t drvfs 'C:/Users/user/Text/Projects' /mnt/c/Users/user/Text/Projects -o uid=1000,gid=1000
sudo mount -t drvfs 'C:/Users/user/.pnpm-store' /mnt/c/Users/user/.pnpm-store -o uid=1000,gid=1000
```

Option C - With systemd:
```bash
sudo systemctl daemon-reload
sudo mount -a
```

### Verification
```bash
# Check mounted directories
mount | grep drvfs

# Test access
ls /mnt/c/Users/user/Text/Projects
```

### Notes
- This configuration is specific to the Debian WSL distro only
- Other WSL distros (including those running Docker/Podman) are unaffected
- To add more directories later, update `/etc/fstab` and remount
