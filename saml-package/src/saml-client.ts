/**
 * SAML Client - Reusable SAML authentication for Electron apps
 */
import express, { Request, Response } from 'express';
import passport from 'passport';
import * as SamlStrategy from 'passport-saml';
import { BrowserWindow } from 'electron';
import { SAMLConfig, AuthResult, SamlServerConfig, User, OnAuthCallbacks } from './types';
import { fetchSAMLMetadata, loadCertificate, validateSAMLViaAPI, applyConfigToStorage } from './utils';
import { logger } from './logger';

export class SamlClient {
  private app: express.Application;
  private config: SAMLConfig;
  private serverConfig: SamlServerConfig;
  private mainWindow: BrowserWindow | null = null;
  private authWindow: BrowserWindow | null = null;
  private currentUser: User | null = null;
  private currentSAMLAssertion: string | null = null;
  private server: any = null;
  private initialized: boolean = false;
  private callbacks: OnAuthCallbacks | null = null;

  constructor(samlConfig: SAMLConfig, serverConfig: Partial<SamlServerConfig> = {}) {
    this.config = samlConfig;
    this.serverConfig = {
      port: serverConfig.port || 3001,
      autoLaunch: serverConfig.autoLaunch !== false,
      closeWindowOnSuccess: serverConfig.closeWindowOnSuccess !== false,
    };
    this.app = express();
  }

  /**
   * Set the main Electron window
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * Set the auth popup window
   */
  setAuthWindow(window: BrowserWindow | null) {
    this.authWindow = window;
  }

  /**
   * Initialize SAML server and configure passport
   */
  async initialize(callbacks?: OnAuthCallbacks): Promise<void> {
    if (this.initialized) {
      logger.info('SAML Client already initialized');
      return;
    }

    this.callbacks = callbacks || null;

    try {
      logger.info('Initializing SAML Client...');

      // Setup Express middleware
      this.app.use(express.urlencoded({ extended: false }));
      this.app.use(express.json());
      this.app.use(express.text({ type: 'text/xml' }));

      // Get certificate and entry point
      let certificate: string | undefined = undefined;
      let entryPoint = this.config.entryPoint;

      if (this.config.metadataUrl) {
        try {
          const metadata = await fetchSAMLMetadata(this.config.metadataUrl);
          certificate = metadata.certificate;
          entryPoint = metadata.entryPoint;
        } catch (error: any) {
          logger.warn('Failed to fetch metadata, using manual config', error);
        }
      }

      if (this.config.certificateFilePath && !certificate) {
        certificate = await loadCertificate(this.config.certificateFilePath);
      }

      if (!certificate) {
        throw new Error('SAML certificate not found. Provide metadataUrl or certificateFilePath');
      }

      if (!entryPoint) {
        throw new Error('SAML entryPoint not found');
      }

      // Configure SAML strategy
      const samlConfig: any = {
        path: '/auth/saml/callback',
        entryPoint: entryPoint,
        issuer: this.config.issuer,
        cert: certificate,
        identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      };

      logger.info('Configuring SAML Strategy', { entryPoint, issuer: samlConfig.issuer });

      passport.use(
        'saml',
        new (SamlStrategy as any).Strategy(samlConfig, (profile: any, done: any) => {
          const user: User = {
            name: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
              || profile.name
              || profile['urn:oid:2.5.4.3']
              || 'Unknown User',
            email: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
              || profile.email
              || profile['urn:oid:0.9.2342.19200300.100.1.3']
              || 'unknown@example.com',
            method: 'saml',
            claims: profile,
          };
          return done(null, user);
        })
      );

      passport.serializeUser((user: any, done: any) => {
        done(null, user);
      });

      passport.deserializeUser((user: any, done: any) => {
        done(null, user);
      });

      // Middleware to capture SAML assertion
      this.app.use('/auth/saml/callback', (req: Request, res: Response, next) => {
        if (req.method === 'POST' && req.body.SAMLResponse) {
          try {
            const decodedAssertion = Buffer.from(req.body.SAMLResponse, 'base64').toString('utf-8');
            this.currentSAMLAssertion = decodedAssertion;
            logger.info('✅ SAML assertion captured', { 
              length: decodedAssertion.length,
              preview: decodedAssertion.substring(0, 100)
            });
          } catch (error) {
            logger.warn('Could not decode SAML assertion', error);
          }
        } else {
          logger.debug('POST callback received but no SAMLResponse', { 
            method: req.method,
            hasSAMLResponse: !!req.body?.SAMLResponse 
          });
        }
        next();
      });

      // Setup routes
      this.setupRoutes();

      this.initialized = true;
      logger.info('SAML Client initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize SAML Client', error);
      throw error;
    }
  }

  /**
   * Setup Express routes for SAML authentication
   */
  private setupRoutes() {
    // Initiate SAML login
    this.app.get('/auth/saml', passport.authenticate('saml', { failureRedirect: '/auth/saml/failure' }));

    // SAML callback
    this.app.post(
      '/auth/saml/callback',
      passport.authenticate('saml', { session: false, failureRedirect: '/auth/saml/failure' }),
      (req: Request, res: Response) => {
        this.handleSAMLCallback(req, res);
      }
    );

    // Error route
    this.app.get('/auth/saml/failure', (req: Request, res: Response) => {
      this.handleSAMLError(req, res);
    });

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', port: this.serverConfig.port });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      logger.error(`Route not found: ${req.method} ${req.path}`);
      res.status(404).send(`Route not found: ${req.method} ${req.path}`);
    });
  }

  /**
   * Handle successful SAML authentication
   */
  private async handleSAMLCallback(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      this.currentUser = user;
      logger.info('SAML authentication successful', { name: user.name, email: user.email });

      let serializedUser: User = {
        name: user.name || 'Unknown User',
        email: user.email || 'unknown@example.com',
        method: user.method || 'saml',
        claims: {},
      };

      try {
        serializedUser.claims = JSON.parse(JSON.stringify(user.claims || {}));
      } catch (e) {
        logger.warn('Could not serialize claims', e);
      }

      let result: AuthResult = {
        success: true,
        user: serializedUser,
      };

      // Validate via API if configured
      logger.info('Checking API validation...', { 
        hasValidateUrl: !!this.config.validateUrl,
        validateUrl: this.config.validateUrl,
        hasAssertion: !!this.currentSAMLAssertion,
        assertionLength: this.currentSAMLAssertion?.length || 0
      });

      if (this.config.validateUrl && this.currentSAMLAssertion) {
        try {
          logger.info('Validating SAML assertion via API');
          logger.info(`User object being validated:`, {
            name: serializedUser.name,
            email: serializedUser.email,
            keys: Object.keys(serializedUser)
          });
          result = await validateSAMLViaAPI(serializedUser, this.currentSAMLAssertion, this.config.validateUrl);
          logger.info('API validation completed successfully', { 
            resultKeys: Object.keys(result),
            hasSuccess: !!result.success,
            configEntries: Object.keys(result.config || {}).length
          });
          
          // Send config to renderer if available
          if (result.config && Object.keys(result.config).length > 0) {
            logger.info('Sending config to renderer via IPC', { entries: Object.keys(result.config).length });
            // Store config in result so it gets sent to renderer with auth:saml-success event
            // The renderer will then apply it to localStorage
          }
        } catch (error: any) {
          logger.error('API validation failed', {
            errorMessage: error.message,
            errorType: error.constructor.name,
            validateUrl: this.config.validateUrl
          });
          logger.error('Stack trace:', error.stack);
          throw error;
        }
      }

      // Send success event with config included
      this.notifySuccess(result);

      // Send HTML response
      res.send(this.getSuccessHTML(user.name));

      // Close window
      if (this.serverConfig.closeWindowOnSuccess) {
        setTimeout(() => this.closeAuthWindow(), 2000);
      }
    } catch (error: any) {
      logger.error('SAML callback error', error);
      this.notifyError(error);
      res.status(500).send('Authentication failed');
    }
  }

  /**
   * Handle SAML authentication failure
   */
  private handleSAMLError(req: Request, res: Response) {
    logger.error('SAML authentication failed');
    const error = new Error('SAML authentication failed');
    this.notifyError(error);
    res.status(401).send(this.getErrorHTML());

    if (this.serverConfig.closeWindowOnSuccess) {
      setTimeout(() => this.closeAuthWindow(), 3000);
    }
  }

  /**
   * Start the SAML server
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('SAML Client not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.serverConfig.port, () => {
        logger.info(`SAML Server started on http://localhost:${this.serverConfig.port}`);
        resolve();
      }).on('error', (error) => {
        logger.error('Failed to start SAML server', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the SAML server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('SAML server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get SAML login URL
   */
  getLoginURL(): string {
    return `http://localhost:${this.serverConfig.port}/auth/saml`;
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Close auth window
   */
  private closeAuthWindow() {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
    }
    this.authWindow = null;
  }

  /**
   * Notify success via callback or IPC
   */
  private notifySuccess(result: AuthResult) {
    logger.info('notifySuccess called with result:', {
      success: result.success,
      hasUser: !!result.user,
      userName: result.user?.name,
      configEntries: Object.keys(result.config || {}).length,
      hasMainWindow: !!this.mainWindow,
      mainWindowDestroyed: this.mainWindow?.isDestroyed()
    });

    // Always send IPC to renderer first (for config persistence)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      logger.info('Sending auth:saml-success event to renderer');
      this.mainWindow.webContents.send('auth:saml-success', result);
      logger.info('auth:saml-success event sent successfully');
    }

    // Then call the callback if defined
    if (this.callbacks?.onSuccess) {
      logger.info('Also calling onSuccess callback');
      this.callbacks.onSuccess(result);
    }
  }

  /**
   * Notify error via callback or IPC
   */
  private notifyError(error: Error) {
    logger.error('notifyError called with error:', {
      message: error.message,
      hasMainWindow: !!this.mainWindow,
      mainWindowDestroyed: this.mainWindow?.isDestroyed()
    });

    const result: AuthResult = {
      success: false,
      error: error.message,
    };

    // Always send IPC to renderer first
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      logger.info('Sending auth:saml-error event to renderer');
      this.mainWindow.webContents.send('auth:saml-error', result);
      logger.info('auth:saml-error event sent successfully');
    }

    // Then call the callback if defined
    if (this.callbacks?.onError) {
      logger.info('Also calling onError callback');
      this.callbacks.onError(error);
    }
  }

  /**
   * Get success HTML page
   */
  private getSuccessHTML(userName: string): string {
    return `
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
            h1 { color: #333; margin: 0 0 10px 0; }
            p { color: #666; margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Authentication Successful!</h1>
            <p>Welcome, ${userName}!</p>
            <p>This window will close automatically...</p>
          </div>
          <script>
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Get error HTML page
   */
  private getErrorHTML(): string {
    return `
      <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
            h1 { color: #e74c3c; margin: 0 0 10px 0; }
            p { color: #666; margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Authentication Failed</h1>
            <p>Please try again.</p>
            <p>This window will close automatically...</p>
          </div>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `;
  }
}
