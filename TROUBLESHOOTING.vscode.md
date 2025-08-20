# VSCode Troubleshooting

## Multiple Instances of Same Workspace (WSL)

### Problem
When using VSCode with Remote-WSL extension, attempting to open multiple instances of the same workspace fails because:
- VSCode automatically switches back to the existing window
- New windows open without Remote-WSL connection (making them useless)
- Standard methods (`File > New Window`, `code --new-window`) don't work properly in WSL environment

### Solution: Bind Mounts
Use Linux bind mounts to create multiple mount points of the same directory, tricking VSCode into treating them as separate workspaces while maintaining file synchronization.

### Implementation

#### Step 1: Create Mount Point Directories
```bash
# Create directories for additional workspace views
mkdir -p /home/user/projects/Monochromatic-view2
mkdir -p /home/user/projects/Monochromatic-view3
```

#### Step 2: Create Bind Mounts
```bash
# Bind mount the same directory to multiple locations
sudo mount --bind /home/user/projects/Monochromatic /home/user/projects/Monochromatic-view2
sudo mount --bind /home/user/projects/Monochromatic /home/user/projects/Monochromatic-view3
```

#### Step 3: Open Multiple VSCode Instances
```bash
# Open each mount point in separate VSCode instances
code /home/user/projects/Monochromatic        # Original workspace
code /home/user/projects/Monochromatic-view2  # Instance 2
code /home/user/projects/Monochromatic-view3  # Instance 3
```

### Benefits
- **Instant synchronization**: All instances see file changes immediately
- **Same files**: No duplication or divergence issues
- **Different paths**: VSCode treats them as separate workspaces
- **Full functionality**: All Remote-WSL features work in each instance
- **Resource efficient**: No additional disk space used

### Cleanup
To remove the bind mounts when no longer needed:

```bash
# Unmount the bind mounts
sudo umount /home/user/projects/Monochromatic-view2
sudo umount /home/user/projects/Monochromatic-view3

# Remove the empty directories
rmdir /home/user/projects/Monochromatic-view2
rmdir /home/user/projects/Monochromatic-view3
```

### Persistence Across Reboots
To make bind mounts persistent across system reboots, add entries to `/etc/fstab`:

```bash
# Edit fstab (requires sudo)
sudo nano /etc/fstab

# Add these lines:
/home/user/projects/Monochromatic /home/user/projects/Monochromatic-view2 none bind 0 0
/home/user/projects/Monochromatic /home/user/projects/Monochromatic-view3 none bind 0 0
```

### Limitations
- Requires `sudo` privileges for mount operations
- All instances share the same git state (branches, staged changes)
- Debugging sessions may conflict if running simultaneously
- Terminal sessions are independent per instance

### Alternative Solutions Considered
- **Git worktrees**: Don't auto-sync changes
- **Symbolic links**: VSCode may still detect as same workspace
- **Code-server**: Browser-based, different workflow
- **Virtual machines**: Resource heavy, complex setup

The bind mount approach provides the best balance of functionality and simplicity for this specific WSL + VSCode limitation.

## Related Documentation

- [dprint Extension Configuration](./TROUBLESHOOTING.dprint.md#vscode-extension-cannot-find-dprint-in-wsl)