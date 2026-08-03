# Changelog

All notable changes to the SAML Package will be documented in this file.

## [1.0.0] - 2026-08-03

### Added
- Initial release of SAML Package
- `SamlClient` class for reusable SAML authentication
- Automatic metadata discovery from IdP
- Certificate loading from URL or file path
- API validation endpoint support
- Event-driven callbacks for success/error handling
- Full TypeScript support with type definitions
- Express-based SAML server
- IPC communication with Electron renderer
- Headless authentication mode for non-UI apps
- Configuration management via INI files
- Comprehensive documentation and examples
- Debug logging with `DEBUG` environment variable
- Cross-platform support (Windows, macOS, Linux)

### Features
- `SamlClient.initialize()` - Configure SAML strategy
- `SamlClient.start()` - Start SAML server
- `SamlClient.stop()` - Stop SAML server
- `SamlClient.getLoginURL()` - Get login URL for browser
- `SamlClient.getCurrentUser()` - Get authenticated user
- `SamlClient.setMainWindow()` - Register main window for IPC
- `SamlClient.setAuthWindow()` - Register auth window
- `loadSAMLConfig()` - Load configuration from INI file
- `fetchSAMLMetadata()` - Auto-discover IdP configuration
- `loadCertificate()` - Load certificate from URL or file
- `validateSAMLViaAPI()` - Validate assertion via backend API
- `logger` - Simple logging utility

### Includes
- Complete integration guide
- Example main.ts for Electron
- Example React component (App.tsx)
- Example package.json with dependencies
- Configuration template (sso.ini.example)
- TypeScript configuration
- README with quick start guide

### Configuration
- SAML metadata URL with auto-discovery
- Manual certificate and entry point configuration
- Backend API validation endpoint
- Customizable server port
- Logging configuration

## Future Releases

### [1.1.0] - Planned
- OIDC support
- JWT token caching
- Automatic token refresh
- Multi-app support
- Custom assertions handling
- Enhanced error recovery

### [2.0.0] - Planned
- Package as npm module
- More IdP vendors (Okta, Auth0, etc.)
- OAuth2 authorization code flow
- Device flow for headless devices
- Web framework integrations
