# Development Environment Todo

## WSL Development Environment

### WSL Debian Distro - Selective Windows Directory Mounting

**Status**: Medium Priority - Security and performance optimization

#### Overview
Configure Debian WSL distro to mount only specific Windows directories instead of auto-mounting all drives, improving security while maintaining access to development files.

#### Required Mount Points
- `/mnt/c/Users/user/Text/Projects` - Development projects
- `/mnt/c/Users/user/.pnpm-store` - pnpm global package store

#### Configuration Steps

1. **Edit WSL Configuration**
   ```bash
   sudo nano /etc/wsl.conf
   ```
   Add:
   ```ini
   [automount]
   enabled = false
   mountFsTab = true
   ```

2. **Create Mount Points**
   ```bash
   sudo mkdir -p /mnt/c/Users/user/Text/Projects
   sudo mkdir -p /mnt/c/Users/user/.pnpm-store
   ```

3. **Configure fstab**
   ```bash
   sudo nano /etc/fstab
   ```
   Add:
   ```
   C:/Users/user/Text/Projects /mnt/c/Users/user/Text/Projects drvfs defaults,uid=1000,gid=1000 0 0
   C:/Users/user/.pnpm-store /mnt/c/Users/user/.pnpm-store drvfs defaults,uid=1000,gid=1000 0 0
   ```

4. **Apply Changes Without Full WSL Restart**

   **Option A** - Restart only Debian distro:
   ```powershell
   # From Windows PowerShell
   wsl -t Debian
   ```

   **Option B** - Apply in current session (temporary):
   ```bash
   # Unmount existing
   sudo umount /mnt/c 2>/dev/null

   # Mount manually
   sudo mount -t drvfs 'C:/Users/user/Text/Projects' /mnt/c/Users/user/Text/Projects -o uid=1000,gid=1000
   sudo mount -t drvfs 'C:/Users/user/.pnpm-store' /mnt/c/Users/user/.pnpm-store -o uid=1000,gid=1000
   ```

   **Option C** - With systemd:
   ```bash
   sudo systemctl daemon-reload
   sudo mount -a
   ```

#### Verification
```bash
# Check mounted directories
mount | grep drvfs

# Test access
ls /mnt/c/Users/user/Text/Projects
```

#### Notes
- This configuration is specific to the Debian WSL distro only
- Other WSL distros (including those running Docker/Podman) are unaffected
- To add more directories later, update `/etc/fstab` and remount

### WSL Migration Benefits (Completed)
- ✅ Native Linux moon binary (no path translation issues)
- ✅ 10-50x faster file operations
- ✅ Better integration with Linux tooling
- ✅ Cleaner development environment

## IDE and Editor Configuration

### VSCode WSL Integration

#### Setup Tasks
1. **VSCode for WSL**
   - Open VSCode: `code .` from WSL terminal
   - VSCode will auto-install WSL extension
   - Ensure all extensions work in WSL environment

2. **Performance Verification**
   - Compare build times between Windows mount and WSL filesystem
   - Test file watching performance with `moon run buildWatch`

#### IDE Integration Improvements
1. **Set up IDE integration**:
   - Configure format-on-save for all developers
   - Ensure TypeScript language server is properly configured
   - Document recommended VS Code extensions in the project

## Development Tools and Environment

### Performance Monitoring

#### File Operation Performance
- Test build times between Windows mount and WSL filesystem
- Monitor file watching performance
- Benchmark development server startup times
- Track hot reload performance

#### Development Server Optimization
- Optimize Vite development server configuration
- Configure efficient file watching patterns
- Set up proper caching strategies
- Monitor memory usage during development

### Environment Validation

#### Setup Validation Scripts
- ✅ **validateSetup task**: Successfully implemented to help diagnose environment issues
- ✅ **Validation scripts**: checkTools, checkDependencies, checkBuild, checkGitHooks are working correctly

#### Fresh Clone Verification
Ensure that fresh clones of the repository work correctly when users follow the setup instructions in README.md.

**Current Setup Instructions Being Tested**:
```bash
# 1. Install proto globally
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)

# 2. Run project setup and build
moon run prepareAndBuild
```

### Development Workflow Improvements

#### Hot Reload and File Watching
- Optimize file watching patterns for better performance
- Configure proper excludes for node_modules and build outputs
- Test file watching across WSL boundary
- Monitor CPU usage during development

#### Development Server Configuration
- Configure efficient development server settings
- Set up proper proxy configurations for API calls
- Implement efficient static asset serving
- Configure HTTPS for local development when needed

## Container and Virtualization

### Docker Integration
- Ensure Docker Desktop integration works properly with WSL
- Test container build performance in WSL environment
- Configure proper volume mounts for development
- Optimize container startup times

### Development Container Configuration
- Consider implementing dev containers for consistent environments
- Configure proper tool installations in containers
- Set up efficient bind mounts and caching
- Test cross-platform compatibility

## Environment Variables and Configuration

### Configuration Management
- Implement proper environment variable management
- Set up development vs production configuration
- Configure secure handling of sensitive data
- Implement configuration validation

### Tool Configuration
- Standardize tool configurations across the team
- Version control all necessary configuration files
- Document required environment setup
- Provide setup automation scripts

## Platform-Specific Considerations

### Windows Integration
- Maintain compatibility with Windows development
- Test build performance on native Windows
- Ensure proper path handling across platforms
- Document Windows-specific setup requirements

### macOS Support
- Test and document macOS development setup
- Ensure tool compatibility across platforms
- Provide platform-specific installation instructions
- Test performance characteristics on different platforms

## Future Enhancements

### Development Environment Automation
- Create automated environment setup scripts
- Implement environment consistency checks
- Automate tool installation and configuration
- Provide environment troubleshooting guides

### Performance Monitoring
- Implement development metrics collection
- Monitor build performance over time
- Track development server response times
- Analyze development workflow bottlenecks