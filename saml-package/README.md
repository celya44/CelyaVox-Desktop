# 🔐 SAML Package for Electron

A reusable, streamlined SAML 2.0 authentication package for Electron applications. Designed for applications that need SAML authentication without complex UI workflows.

## ✨ Features

- ✅ **Automatic SAML Authentication** - Authenticate on app startup
- ✅ **No UI Required** - Minimal interaction needed
- ✅ **Metadata Auto-Discovery** - Automatically fetch IdP configuration
- ✅ **API Validation** - Optional server-side assertion validation
- ✅ **TypeScript Support** - Full type safety
- ✅ **Event-Driven** - Callbacks for success/error handling
- ✅ **Headless Mode** - Perfect for background services
- ✅ **Cross-Platform** - Works on Windows, macOS, Linux

## 📦 What's Included

```
saml-package/
├── src/
│   ├── saml-client.ts      # Main SAML client class
│   ├── config.ts           # Configuration management
│   ├── logger.ts           # Logging utilities
│   ├── utils.ts            # Helper functions
│   ├── types.ts            # TypeScript interfaces
│   └── index.ts            # Public API
├── docs/
│   └── INTEGRATION_GUIDE.md # Comprehensive integration guide
├── examples/
│   ├── example-main.ts     # Example Electron main process
│   ├── example-App.tsx     # Example React component
│   ├── example-package.json # Dependencies
│   └── sso.ini.example     # Configuration template
└── tsconfig.json           # TypeScript configuration
```

## 🚀 Quick Start

### 1. Copy the Package

```bash
cp -r saml-package /path/to/your/project/src/saml
```

### 2. Install Dependencies

```bash
npm install express passport passport-saml axios xml2js ini
npm install --save-dev @types/express @types/passport @types/node
```

### 3. Configure SAML

Create `~/.config/CelyaVox/sso.ini`:

```ini
[SAML]
metadataUrl=https://your-idp.com/metadata.xml
issuer=urn:your-app:identifier
callbackUrl=http://localhost:3001/auth/saml/callback
```

### 4. Use in Your App

```typescript
import { SamlClient, loadSAMLConfig } from './saml/src';

// Load configuration
const samlConfig = loadSAMLConfig();

// Create client
const samlClient = new SamlClient(samlConfig, { port: 3001 });

// Initialize
await samlClient.initialize({
  onSuccess: (result) => {
    console.log('✅ Authenticated:', result.user);
  },
  onError: (error) => {
    console.error('❌ Error:', error.message);
  },
});

// Start server
await samlClient.start();

// Open login URL
shell.openExternal(samlClient.getLoginURL());
```

## 📚 Documentation

- **[Integration Guide](docs/INTEGRATION_GUIDE.md)** - Complete integration instructions
- **[Configuration](examples/sso.ini.example)** - Configuration options
- **[Examples](examples/)** - Ready-to-use examples

## 🎯 Use Cases

### Headless Authentication
Authenticate automatically on startup without user interaction:

```typescript
await samlClient.initialize();
await samlClient.start();
shell.openExternal(samlClient.getLoginURL());
```

### Background Service
Authenticate once and store credentials:

```typescript
const result = await validateWithBackend(samlAssertion);
storeToken(result.token);
```

### Multi-Window
Share authentication across multiple windows:

```typescript
samlClient.setMainWindow(mainWindow);
// Authentication events sent via IPC to all renderers
```

## 🔧 API Reference

### `SamlClient`

```typescript
// Constructor
new SamlClient(samlConfig, serverConfig?)

// Methods
.initialize(callbacks?) → Promise<void>
.start() → Promise<void>
.stop() → Promise<void>
.setMainWindow(window: BrowserWindow) → void
.setAuthWindow(window: BrowserWindow | null) → void
.getLoginURL() → string
.getCurrentUser() → User | null
```

### Types

```typescript
interface SAMLConfig {
  metadataUrl?: string;
  certificateFilePath?: string;
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  validateUrl?: string;
}

interface User {
  name: string;
  email: string;
  method: string;
  claims?: any;
}

interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  config?: Record<string, string>;
}
```

## 🔐 Security

- **Sandbox Mode** - Auth windows run in isolated sandbox
- **Certificate Validation** - SAML responses verified with IdP certificate
- **No Credentials Stored** - Credentials only passed via IPC
- **Secure IPC Communication** - Context isolation enabled
- **HTTPS Support** - Metadata and certificates loaded securely

## ⚙️ Configuration Options

### Server Configuration

```typescript
{
  port: 3001,              // Server port
  autoLaunch: true,        // Auto-start on init
  closeWindowOnSuccess: true  // Close auth window after success
}
```

### SAML Configuration

```ini
[SAML]
# Metadata URL (auto-discovery)
metadataUrl=https://idp.example.com/metadata.xml

# OR Manual config
certificateFilePath=/path/to/cert.pem
entryPoint=https://idp.example.com/sso

# Required
issuer=urn:your-app:id
callbackUrl=http://localhost:3001/auth/saml/callback

# Optional
validateUrl=https://api.example.com/validate
```

## 🐛 Troubleshooting

### Certificate Not Found
- Verify `metadataUrl` is accessible
- Or provide `certificateFilePath`

### Connection Timeout
- Check network connectivity
- Increase timeout in `utils.ts`

### Port Already in Use
- Change port in server config
- Or close conflicting application

## 📋 Requirements

- Node.js 14+
- Electron 15+
- TypeScript 4.5+ (for development)
- Express 4.x
- Passport.js with SAML strategy

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow the existing code style.

## 📞 Support

For issues or questions:
1. Check [INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)
2. Review example code in `examples/`
3. Enable debug logging: `DEBUG=true npm run dev`

---

Built with ❤️ for Electron developers
