# SAML Package - Advanced Usage Guide

Advanced patterns and techniques for using the SAML Package in production scenarios.

## 1. Automatic Retry on Failure

Automatically retry SAML authentication after a failed attempt:

```typescript
let retryCount = 0;
const maxRetries = 3;
const retryDelay = 5000; // 5 seconds

async function authenticateWithRetry() {
  try {
    const samlClient = new SamlClient(config);
    samlClient.setMainWindow(mainWindow);
    
    await samlClient.initialize({
      onSuccess: (result) => {
        console.log('✅ Authenticated');
        retryCount = 0; // Reset counter
        proceedWithApp(result.user);
      },
      onError: (error) => {
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`🔄 Retry attempt ${retryCount}/${maxRetries} in ${retryDelay}ms`);
          setTimeout(authenticateWithRetry, retryDelay);
        } else {
          console.error('❌ Max retries exceeded');
          app.quit();
        }
      },
    });

    await samlClient.start();
    shell.openExternal(samlClient.getLoginURL());
  } catch (error) {
    console.error('Fatal error:', error);
    app.quit();
  }
}
```

## 2. Token Caching and Persistence

Cache authentication results to avoid re-authenticating on every app restart:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

class AuthenticationCache {
  private cacheDir: string;
  private encryptionKey: string;

  constructor(cacheDir: string = '.auth-cache') {
    this.cacheDir = cacheDir;
    this.encryptionKey = process.env.AUTH_ENCRYPTION_KEY || 'default-key';
    this.ensureCacheDir();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  save(user: User, assertion: string): void {
    const cacheFile = path.join(this.cacheDir, 'saml-cache.json');
    const cached = {
      timestamp: Date.now(),
      user,
      assertion: this.encrypt(assertion),
    };
    fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2));
    console.log('📦 Authentication cached');
  }

  load(): { user: User; assertion: string } | null {
    const cacheFile = path.join(this.cacheDir, 'saml-cache.json');
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (Date.now() - cached.timestamp > maxAge) {
        fs.unlinkSync(cacheFile);
        console.log('🗑️  Cache expired');
        return null;
      }

      return {
        user: cached.user,
        assertion: this.decrypt(cached.assertion),
      };
    } catch (error) {
      console.error('Cache load error:', error);
      return null;
    }
  }

  clear(): void {
    const cacheFile = path.join(this.cacheDir, 'saml-cache.json');
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      console.log('🗑️  Cache cleared');
    }
  }

  private encrypt(text: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  }

  private decrypt(text: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
  }
}

// Usage
const cache = new AuthenticationCache();
const cached = cache.load();

if (cached) {
  console.log('✅ Using cached authentication');
  proceedWithApp(cached.user);
} else {
  console.log('🔄 Need fresh authentication');
  await authenticateWithSAML();
}
```

## 3. Multiple SAML Providers

Support multiple IdP configurations for different environments:

```typescript
interface ProviderConfig {
  name: string;
  samlConfig: SAMLConfig;
  port: number;
}

class MultiProviderAuth {
  private clients: Map<string, SamlClient> = new Map();
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  async registerProvider(config: ProviderConfig): Promise<void> {
    const client = new SamlClient(config.samlConfig, {
      port: config.port,
    });
    
    client.setMainWindow(this.mainWindow);
    await client.initialize();
    await client.start();
    
    this.clients.set(config.name, client);
    console.log(`✅ Provider registered: ${config.name}`);
  }

  async authenticate(providerName: string): Promise<AuthResult> {
    const client = this.clients.get(providerName);
    if (!client) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      // Temporary IPC listener
      const handleSuccess = (result: AuthResult) => {
        if (!resolved) {
          resolved = true;
          this.mainWindow.webContents.off('auth:saml-success', handleSuccess);
          this.mainWindow.webContents.off('auth:saml-error', handleError);
          resolve(result);
        }
      };

      const handleError = (result: AuthResult) => {
        if (!resolved) {
          resolved = true;
          this.mainWindow.webContents.off('auth:saml-success', handleSuccess);
          this.mainWindow.webContents.off('auth:saml-error', handleError);
          reject(new Error(result.error));
        }
      };

      this.mainWindow.webContents.on('auth:saml-success', handleSuccess);
      this.mainWindow.webContents.on('auth:saml-error', handleError);

      shell.openExternal(client.getLoginURL());
    });
  }

  async cleanup(): Promise<void> {
    for (const [name, client] of this.clients) {
      await client.stop();
      console.log(`🛑 Provider stopped: ${name}`);
    }
    this.clients.clear();
  }
}

// Usage
const multiAuth = new MultiProviderAuth(mainWindow);

await multiAuth.registerProvider({
  name: 'production-idp',
  samlConfig: loadSAMLConfig('prod'),
  port: 3001,
});

await multiAuth.registerProvider({
  name: 'staging-idp',
  samlConfig: loadSAMLConfig('staging'),
  port: 3002,
});

const user = await multiAuth.authenticate('production-idp');
```

## 4. SSO with OAuth2 Backend

Exchange SAML assertion for OAuth2 tokens:

```typescript
interface OAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function exchangeForOAuthToken(samlAssertion: string): Promise<OAuthToken> {
  try {
    const response = await axios.post('https://your-oauth-provider.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:saml2-bearer',
      assertion: samlAssertion,
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
    });

    return response.data;
  } catch (error: any) {
    throw new Error(`OAuth token exchange failed: ${error.message}`);
  }
}

// Usage in SAML callback
await samlClient.initialize({
  onSuccess: async (result) => {
    if (result.user) {
      try {
        const oauthToken = await exchangeForOAuthToken(samlAssertion);
        console.log('✅ OAuth token obtained');
        
        // Store token securely
        await storeToken(oauthToken);
        
        // Use token for API requests
        setDefaultAuthHeader(oauthToken.access_token);
        
        proceedWithApp(result.user);
      } catch (error) {
        console.error('Token exchange failed:', error);
      }
    }
  },
});
```

## 5. Headless Authentication with Timeout

Authenticate in headless mode with automatic timeout and retry:

```typescript
async function headlessAuthenticate(config: SAMLConfig, timeout: number = 120000): Promise<User> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`Authentication timeout after ${timeout}ms`));
    }, timeout);

    const samlClient = new SamlClient(config, {
      port: 3001,
      autoLaunch: true,
      closeWindowOnSuccess: true,
    });

    samlClient.initialize({
      onSuccess: (result) => {
        clearTimeout(timeoutHandle);
        if (result.user) {
          resolve(result.user);
        } else {
          reject(new Error('No user data returned'));
        }
      },
      onError: (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      },
    }).then(async () => {
      await samlClient.start();
      shell.openExternal(samlClient.getLoginURL());
    }).catch((error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
}

// Usage
try {
  const user = await headlessAuthenticate(samlConfig, 300000); // 5 minutes
  console.log('✅ Authenticated:', user);
  proceedWithApp(user);
} catch (error) {
  console.error('❌ Authentication failed:', error.message);
  app.quit();
}
```

## 6. Custom Error Handling and Notifications

Implement sophisticated error handling with user notifications:

```typescript
class AuthenticationManager {
  private notificationQueue: string[] = [];

  async initializeWithErrorHandling(mainWindow: BrowserWindow, config: SAMLConfig) {
    const samlClient = new SamlClient(config);
    samlClient.setMainWindow(mainWindow);

    await samlClient.initialize({
      onSuccess: (result) => {
        this.notify(mainWindow, 'success', `Welcome, ${result.user?.name}!`);
        this.logAuthEvent('auth_success', result.user);
      },
      onError: (error) => {
        const errorType = this.classifyError(error);
        this.handleError(mainWindow, errorType, error.message);
        this.logAuthEvent('auth_failure', { reason: errorType, error: error.message });
      },
    });

    await samlClient.start();
    shell.openExternal(samlClient.getLoginURL());
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('certificate')) return 'certificate_error';
    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('metadata')) return 'metadata_error';
    if (message.includes('validation')) return 'validation_error';
    
    return 'unknown_error';
  }

  private handleError(mainWindow: BrowserWindow, errorType: string, message: string) {
    const errorMap: Record<string, string> = {
      certificate_error: '🔐 Certificate validation failed. Check IdP configuration.',
      timeout_error: '⏱️  Connection timeout. Check your network.',
      metadata_error: '📋 Failed to fetch IdP metadata. Check the metadata URL.',
      validation_error: '✓ SAML validation failed. Check the IdP response.',
      unknown_error: '❌ Authentication failed. Please try again.',
    };

    this.notify(mainWindow, 'error', errorMap[errorType] || message);
  }

  private notify(mainWindow: BrowserWindow, type: 'success' | 'error' | 'info', message: string) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notification', { type, message });
    }
  }

  private logAuthEvent(event: string, data: any) {
    console.log(`[AUTH_EVENT] ${event}:`, data);
    // Send to your analytics/logging service
  }
}
```

## 7. Session Management

Manage user sessions with automatic renewal:

```typescript
interface Session {
  user: User;
  assertion: string;
  expiresAt: number;
  renewedAt: number;
}

class SessionManager {
  private session: Session | null = null;
  private sessionRefreshInterval: NodeJS.Timer | null = null;

  setSession(user: User, assertion: string, ttl: number = 3600000) {
    this.session = {
      user,
      assertion,
      expiresAt: Date.now() + ttl,
      renewedAt: Date.now(),
    };
    
    // Start refresh timer (30 minutes before expiry)
    this.startRefreshTimer(ttl - 1800000);
  }

  getSession(): Session | null {
    if (!this.session) return null;
    
    if (Date.now() > this.session.expiresAt) {
      this.clearSession();
      return null;
    }

    return this.session;
  }

  isSessionValid(): boolean {
    return this.getSession() !== null;
  }

  clearSession() {
    this.session = null;
    this.stopRefreshTimer();
  }

  private startRefreshTimer(delay: number) {
    this.stopRefreshTimer();
    this.sessionRefreshInterval = setTimeout(() => {
      console.log('🔄 Refreshing session...');
      // Implement session refresh logic
    }, delay);
  }

  private stopRefreshTimer() {
    if (this.sessionRefreshInterval) {
      clearTimeout(this.sessionRefreshInterval);
      this.sessionRefreshInterval = null;
    }
  }
}
```

## 8. Monitoring and Metrics

Track authentication metrics for debugging and optimization:

```typescript
interface AuthMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  averageAuthTime: number;
  lastAuthTime: number;
}

class AuthMetricsCollector {
  private metrics: AuthMetrics = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    averageAuthTime: 0,
    lastAuthTime: 0,
  };
  private authStartTime: number | null = null;

  startTracking() {
    this.authStartTime = Date.now();
  }

  recordSuccess() {
    this.metrics.totalAttempts++;
    this.metrics.successfulAttempts++;
    this.recordAuthTime();
    console.log(`📊 Auth Success - Metrics:`, this.getMetrics());
  }

  recordFailure() {
    this.metrics.totalAttempts++;
    this.metrics.failedAttempts++;
    this.recordAuthTime();
    console.log(`📊 Auth Failure - Metrics:`, this.getMetrics());
  }

  private recordAuthTime() {
    if (this.authStartTime) {
      const authTime = Date.now() - this.authStartTime;
      this.metrics.lastAuthTime = authTime;
      this.metrics.averageAuthTime = 
        (this.metrics.averageAuthTime * (this.metrics.totalAttempts - 1) + authTime) / 
        this.metrics.totalAttempts;
    }
  }

  getMetrics(): AuthMetrics {
    return { ...this.metrics };
  }

  getSuccessRate(): number {
    if (this.metrics.totalAttempts === 0) return 0;
    return (this.metrics.successfulAttempts / this.metrics.totalAttempts) * 100;
  }
}
```

## Best Practices

1. **Always clean up resources** - Call `samlClient.stop()` on app exit
2. **Use environment variables** - Store sensitive config in env vars
3. **Implement proper logging** - Track all authentication events
4. **Cache tokens securely** - Use encryption for cached credentials
5. **Handle timeouts gracefully** - Provide user feedback for delays
6. **Validate on both sides** - Validate SAML on client and backend
7. **Implement retry logic** - Gracefully handle transient failures
8. **Monitor metrics** - Track authentication performance and failures

---

For more details, see the main [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md).
