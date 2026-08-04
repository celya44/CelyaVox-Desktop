# SAML Package - Deployment Guide

Instructions for packaging, distributing, and deploying the SAML package in your Electron applications.

## 📦 Distribution Methods

### Method 1: Copy as Source (Development)

For local development or team projects:

```bash
# Copy the entire saml-package directory
cp -r /path/to/saml-package /your/project/src/saml

# Or create a symlink for active development
ln -s /path/to/saml-package /your/project/src/saml
```

### Method 2: NPM Package (Production)

Package as a private NPM module:

```bash
# In saml-package directory
npm pack

# Publishes saml-package-1.0.0.tgz
# Upload to your private registry or GitHub Packages
```

In your project's `package.json`:

```json
{
  "dependencies": {
    "@company/saml-package": "file:../saml-package"
    // OR from npm registry:
    // "@company/saml-package": "^1.0.0"
  }
}
```

### Method 3: Git Submodule

For projects using Git:

```bash
# Add as submodule
git submodule add https://github.com/your-org/saml-package.git src/saml

# Clone with submodules
git clone --recurse-submodules <repo-url>

# Update submodules
git submodule update --recursive --remote
```

### Method 4: GitHub Package Registry

For private or public distribution:

```bash
# In saml-package directory
npm publish --registry https://npm.pkg.github.com/

# In your project
npm install --registry https://npm.pkg.github.com/ @your-org/saml-package
```

## 🔧 Build and Compilation

### Compile TypeScript

```bash
# Build the package
cd saml-package
npm run build

# Output goes to dist/
# Includes .js files and .d.ts type definitions
```

### In Your Project

```bash
# Build process should include saml-package
npm run build:electron

# This compiles:
# - electron/ → dist-electron/
# - saml-package/src/ → saml-package/dist/ (if separate)
```

### TypeScript Configuration

Ensure your `tsconfig.electron.json` includes the saml-package:

```json
{
  "compilerOptions": {
    "outDir": "./dist-electron",
    "rootDir": "./",
    "baseUrl": "."
  },
  "include": [
    "electron/**/*",
    "src/saml/**/*"
  ]
}
```

## 📋 Checklist Before Deployment

- [ ] SAML configuration tested locally
- [ ] `sso.ini.example` provided with documentation
- [ ] Dependencies listed in `package.json`
- [ ] TypeScript types generated and included
- [ ] Environment variables documented
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Security review completed

## 🚀 Installation in New Projects

### Step 1: Add Package

```bash
# Option A: Copy
cp -r /path/to/saml-package ./src/

# Option B: NPM
npm install @company/saml-package

# Option C: Git submodule
git submodule add <repo-url> src/saml
```

### Step 2: Install Dependencies

```bash
npm install express passport passport-saml axios xml2js ini
npm install --save-dev @types/express @types/passport @types/node
```

### Step 3: Setup Configuration

```bash
# Create config directory
mkdir -p ~/.config/CelyaVox

# Copy example
cp src/saml/examples/sso.ini.example ~/.config/CelyaVox/sso.ini

# Edit with your IdP settings
nano ~/.config/CelyaVox/sso.ini
```

### Step 4: Integrate in main.ts

```typescript
import { SamlClient, loadSAMLConfig } from './saml/src';

app.on('ready', async () => {
  // ... create window ...
  
  const samlConfig = loadSAMLConfig();
  const samlClient = new SamlClient(samlConfig);
  samlClient.setMainWindow(mainWindow);
  await samlClient.initialize();
  await samlClient.start();
  
  shell.openExternal(samlClient.getLoginURL());
});
```

## 🔒 Security Considerations

### Sensitive Data

```bash
# Never commit configuration files
echo "~/.config/CelyaVox/sso.ini" >> .gitignore

# Certificates
echo "*.pem" >> .gitignore
echo "*.key" >> .gitignore

# Environment secrets
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### Environment Variables

Store sensitive data in environment variables:

```bash
# .env (NOT in git)
AUTH_ENCRYPTION_KEY=your-secret-key-here
OAUTH_CLIENT_SECRET=secret
DEBUG=false

# In code
const samlConfig = {
  validateUrl: process.env.SAML_VALIDATE_URL,
  ...
};
```

### Code Obfuscation

For production builds, consider obfuscating sensitive code:

```bash
npm install --save-dev webpack-obfuscator
```

## 📊 Performance Optimization

### Bundle Size

The package adds approximately:
- TypeScript: ~5MB
- Runtime libraries: ~2MB
- Compiled output: ~800KB

### Tree Shaking

```typescript
// Use named imports to enable tree shaking
import { SamlClient, loadSAMLConfig } from './saml/src';

// Avoid default imports
// import * as saml from './saml/src';
```

### Lazy Loading

```typescript
// Load SAML client only when needed
async function initializeAuth() {
  const { SamlClient } = await import('./saml/src');
  // ...
}
```

## 🧪 Testing

### Unit Tests

```bash
# Create test file
mkdir -p test
cat > test/saml-client.test.ts << 'EOF'
import { SamlClient } from '../src/saml-client';

describe('SamlClient', () => {
  it('should initialize', async () => {
    // Test implementation
  });
});
EOF

# Run tests
npm test
```

### Integration Tests

```typescript
// Integration test with mock Electron
import { SamlClient } from './src/saml-client';
import { BrowserWindow } from 'electron';

describe('SAML Integration', () => {
  it('should complete auth flow', async () => {
    const mockWindow = {} as BrowserWindow;
    const client = new SamlClient(testConfig);
    client.setMainWindow(mockWindow);
    
    await client.initialize();
    await client.start();
    
    // Simulate IdP callback
    // Assert authentication result
  });
});
```

## 📦 Release Process

### Version Bump

```bash
# Update version in package.json
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# This updates:
# - package.json version
# - package-lock.json
# - Creates git tag
```

### Build for Release

```bash
# Clean previous builds
npm run clean

# Build
npm run build

# Create tarball
npm pack

# Output: saml-package-1.0.0.tgz
```

### Publish

```bash
# To NPM registry
npm publish

# To private registry
npm publish --registry https://npm.pkg.github.com/

# To GitHub releases
gh release create v1.0.0 saml-package-1.0.0.tgz
```

## 🐛 Troubleshooting Deployments

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in config
samlClient = new SamlClient(config, { port: 3002 });
```

### Module Not Found

```bash
# Verify all dependencies installed
npm ls | grep -E "passport|express|xml2js"

# Reinstall if needed
npm install --legacy-peer-deps
```

### Metadata URL Unreachable

```bash
# Test connectivity
curl https://your-idp.com/metadata.xml

# Check DNS
nslookup your-idp.com

# Use certificate file instead
certificateFilePath=/path/to/cert.pem
```

### TypeScript Errors After Update

```bash
# Regenerate types
npm install --save-dev @types/node@latest

# Recompile
npm run build:electron --force
```

## 📝 Documentation

When distributing, include:

1. **README.md** - Quick start guide
2. **INTEGRATION_GUIDE.md** - Detailed integration steps
3. **CHANGELOG.md** - Version history
4. **examples/** - Code examples
5. **docs/advanced-usage.md** - Advanced patterns
6. **sso.ini.example** - Configuration template

## 🆘 Support Resources

- Repository Issues: GitHub issue tracker
- Documentation: docs/ folder
- Examples: examples/ folder
- Logging: Enable DEBUG=true for detailed logs

---

For detailed integration help, see [INTEGRATION_GUIDE.md](../docs/INTEGRATION_GUIDE.md)
