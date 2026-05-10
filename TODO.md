# Todo

## Quick Links to Specialized Todo Lists

- [**Build System & Package Management**](TODO.build-system.md): mise, TypeScript, dependencies
- [**CLI Tools & Utilities**](TODO.cli-tools.md): Custom tools and automation scripts
- [**Documentation & UI/UX**](TODO.documentation.md): Content, design, and user experience
- [**Development Environment**](TODO.development.md): Tooling, setup
- [**Code Quality & Patterns**](TODO.code-quality.md): Linting, testing, best practices
- [**Package-Specific Improvements**](TODO.packages.md): Module library, config packages, style framework
- [**Security & Infrastructure**](TODO.security.md): Application security, deployment hardening
- [**Performance & Optimization**](TODO.performance.md): Build performance, runtime optimization
- [**Automation & DevOps**](TODO.automation.md): CI/CD, development automation, release management
- [**VM Dev Environment**](TODO.vm-dev-environment.md): Portable immutable VM image ([rationale](PHILOSOPHY.vm-dev-environment.md))
- [**Completed Tasks**](TODO.completed.md): Reference for finished work

## Priority Overview

### Critical priority

Immediate action required: blocking development or production.

1. **Build System Reliability** → [Build System Todo](TODO.build-system.md#critical-issues)
   - Fresh clone setup problems blocking new developers
   - Package build order issues preventing successful builds
   - Mise task dependency optimization needed

2. **Security Fundamentals** → [Security Todo](TODO.security.md#application-security)
   - Dependency vulnerability scanning and management
   - Input validation for all user-facing applications
   - Secrets management audit and implementation

3. **Core Library Completion** → [Packages Todo](TODO.packages.md#module-library-packages-modulees)
   - Missing async iterator utilities for complete functional programming
   - Essential array and object utilities for developer productivity
   - Type guard and validation utilities for type safety

### High priority

Important improvements that significantly impact developer experience.

1. **Performance Optimization** → [Performance Todo](TODO.performance.md#build-performance)
   - Build system performance improvements
   - TypeScript compilation optimization
   - Bundle size and runtime performance optimization

2. **Development Automation** → [Automation Todo](TODO.automation.md#development-automation)
   - Enhanced pre-commit hooks and code quality automation
   - Development environment automation and consistency
   - Code generation and templating for productivity

### Normal priority

Valuable improvements that enhance the project.

1. **Documentation Enhancement** → [Documentation Todo](TODO.documentation.md#documentation-system-improvements)
   - PlantUML integration for architecture diagrams
   - Comprehensive API documentation generation
   - User experience improvements and content optimization

2. **Package Ecosystem** → [Packages Todo](TODO.packages.md#configuration-packages)
   - Configuration package improvements and templates
   - Style framework component library development
   - Figma plugin enhancements and additional tools

3. **Infrastructure Improvements** → [Security Todo](TODO.security.md#infrastructure-security)
   - Container security and deployment hardening
   - Monitoring and incident response procedures
   - Compliance framework implementation

### Low priority

Nice-to-have features and experimental improvements.

1. **Advanced Features** → [Packages Todo](TODO.packages.md#cross-package-improvements)
   - Advanced utilities and specialized functionality
   - Experimental patterns and libraries
   - Integration with external tools and services

2. **Optimization Projects** → [Performance Todo](TODO.performance.md#advanced-optimization)
   - Advanced caching strategies
   - Infrastructure performance tuning
   - Predictive analytics and monitoring

## Current Sprint Focus

### Active development (March 2026)

- **MCP packages**: Building mcp-stdio and mcp-nvim → packages/mcp/
- **Build System**: Fixing ordering issues for fresh clones → [Build System Todo](TODO.build-system.md#fresh-clone-setup-problems)
- **Security**: Establishing security fundamentals → [Security Todo](TODO.security.md#dependency-security)

### Next Sprint Candidates

- **Package Development**: Expanding module library functionality → [Packages Todo](TODO.packages.md#module-library-packages-modulees)
- **Performance**: Build system optimization → [Performance Todo](TODO.performance.md#build-performance)
- **Documentation**: API documentation automation → [Documentation Todo](TODO.documentation.md#api-documentation)
- **Automation**: CI/CD pipeline enhancement → [Automation Todo](TODO.automation.md#cicd-pipeline)

## Recent Completions

- Husky to mise migration (June 2025) → [Completed Tasks](TODO.completed.md)
- Pre-commit hook implementation → [Completed Tasks](TODO.completed.md)
- TypeScript baseUrl configuration fixes → [Completed Tasks](TODO.completed.md)
- MCP stdio package initial implementation (March 2026)

*For detailed information on completed tasks, see [Completed Tasks](TODO.completed.md)*
