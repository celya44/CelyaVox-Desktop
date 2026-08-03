/**
 * Backend Validation Example
 * 
 * This example shows how to validate SAML assertions with your backend API
 * 
 * The validation flow:
 * 1. User authenticates at IdP
 * 2. IdP sends SAML response to localhost:3001/auth/saml/callback
 * 3. SamlClient extracts user data and SAML assertion
 * 4. SamlClient sends assertion to your backend validateUrl
 * 5. Backend validates assertion and returns user data
 * 6. App receives validated data
 */

import { ipcMain, BrowserWindow, shell } from 'electron';
import { SamlClient, loadSAMLConfig, logger } from './saml/src';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Configure validateUrl in ~/.config/celyavox/sso.ini
// 
// [SAML]
// metadataUrl=https://your-idp.com/metadata.xml
// issuer=urn:your-app:id
// callbackUrl=http://localhost:3001/auth/saml/callback
// validateUrl=https://your-backend.com/api/saml/validate  ← ADD THIS
//

// ============================================================================
// BACKEND IMPLEMENTATION EXAMPLE
// ============================================================================

/**
 * Your backend API should look like this:
 * 
 * POST /api/saml/validate
 * 
 * Request body:
 * {
 *   "assertion": "<?xml version=\"1.0\"...raw SAML assertion XML...</assertion>",
 *   "user": {
 *     "name": "John Doe",
 *     "email": "john@example.com"
 *   }
 * }
 * 
 * Response (XML):
 * <?xml version="1.0" encoding="UTF-8"?>
 * <response>
 *   <success>true</success>
 *   <user>
 *     <name>John Doe</name>
 *     <email>john@example.com</email>
 *   </user>
 *   <config>
 *     <role>admin</role>
 *     <department>IT</department>
 *     <session_id>xyz123</session_id>
 *   </config>
 * </response>
 * 
 * Your backend should:
 * 1. Parse the SAML assertion XML
 * 2. Verify the signature using IdP certificate
 * 3. Extract claims and verify user data
 * 4. Perform custom authorization checks
 * 5. Return validated data + app-specific config
 */

// ============================================================================
// NODE.JS BACKEND EXAMPLE (Express)
// ============================================================================

/*

import express from 'express';
import { parseStringPromise } from 'xml2js';

const app = express();
app.use(express.json());

// Middleware to verify SAML assertion
async function verifySAMLAssertion(assertion: string): Promise<boolean> {
  try {
    // Parse SAML assertion XML
    const parsed = await parseStringPromise(assertion);
    
    // Verify signature
    // (Use xmldsigjs or similar library)
    // const isValid = verifySignature(parsed);
    // if (!isValid) return false;
    
    // Extract claims and validate
    const claims = parsed.Assertion?.AttributeStatement?.[0]?.Attribute;
    
    console.log('SAML Claims verified');
    return true;
  } catch (error) {
    console.error('SAML verification failed:', error);
    return false;
  }
}

// SAML validation endpoint
app.post('/api/saml/validate', async (req, res) => {
  try {
    const { assertion, user } = req.body;
    
    console.log('SAML Validation Request:', {
      user: user.email,
      assertionLength: assertion.length,
    });

    // Verify the SAML assertion
    const isValid = await verifySAMLAssertion(assertion);
    if (!isValid) {
      return res.status(401).xml(`
        <?xml version="1.0" encoding="UTF-8"?>
        <response>
          <success>false</success>
          <error>SAML assertion signature verification failed</error>
        </response>
      `);
    }

    // Perform custom authorization
    // (Check user permissions, roles, etc.)
    
    // Return validated data
    const xmlResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <response>
        <success>true</success>
        <user>
          <name>${escapeXml(user.name)}</name>
          <email>${escapeXml(user.email)}</email>
        </user>
        <config>
          <role>user</role>
          <department>Engineering</department>
          <session_id>${generateSessionId()}</session_id>
        </config>
      </response>
    `;

    res.set('Content-Type', 'application/xml');
    res.send(xmlResponse);

  } catch (error: any) {
    console.error('SAML validation error:', error);
    res.status(500).xml(`
      <?xml version="1.0" encoding="UTF-8"?>
      <response>
        <success>false</success>
        <error>Internal server error: ${error.message}</error>
      </response>
    `);
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSessionId(): string {
  return 'sess_' + Math.random().toString(36).substr(2, 9);
}

// Start server
app.listen(3000, () => {
  console.log('SAML validation server running on port 3000');
});

*/

// ============================================================================
// ELECTRON APP WITH BACKEND VALIDATION
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let samlClient: SamlClient | null = null;
let authenticatedUser: any = null;
let appConfig: any = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initSAMLWithBackendValidation() {
  try {
    // Load configuration (including validateUrl)
    const samlConfig = loadSAMLConfig();
    
    logger.info('SAML Configuration loaded');
    logger.info('Backend Validation URL:', samlConfig.validateUrl);

    // Create SAML client
    samlClient = new SamlClient(samlConfig, {
      port: 3001,
      autoLaunch: true,
      closeWindowOnSuccess: true,
    });

    if (mainWindow) {
      samlClient.setMainWindow(mainWindow);
    }

    // Initialize with callbacks
    // NOTE: The backend validation is called AUTOMATICALLY by SamlClient
    // if validateUrl is configured in sso.ini
    await samlClient.initialize({
      onSuccess: (result) => {
        logger.info('✅ SAML Authentication + Backend Validation Successful!');
        logger.info('User:', result.user);
        logger.info('Config from backend:', result.config);

        // Store authenticated user and config
        authenticatedUser = result.user;
        appConfig = result.config;

        // Send to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('saml:authenticated', {
            user: result.user,
            config: result.config,
          });
        }

        // Now you can:
        // - Store session tokens
        // - Initialize user-specific features
        // - Load user data from your API
        // - Grant access to protected resources
      },
      onError: (error) => {
        logger.error('❌ SAML Authentication Failed:', error.message);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('saml:error', { 
            error: error.message 
          });
        }
      },
    });

    // Start SAML server
    await samlClient.start();
    logger.info('SAML server started on http://localhost:3001');

    // Open login URL in browser
    const loginUrl = samlClient.getLoginURL();
    logger.info('Opening login URL:', loginUrl);
    await shell.openExternal(loginUrl);

  } catch (error: any) {
    logger.error('Failed to initialize SAML:', error.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('saml:error', { 
        error: error.message 
      });
    }
  }
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

async function startApp() {
  createWindow();

  if (mainWindow) {
    await initSAMLWithBackendValidation();
  }
}

// Electron app ready
const { app } = require('electron');

app.on('ready', startApp);

app.on('window-all-closed', async () => {
  if (samlClient) {
    await samlClient.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Get current authenticated user
ipcMain.handle('saml:get-user', () => {
  return authenticatedUser;
});

// Get app configuration from backend
ipcMain.handle('saml:get-config', () => {
  return appConfig;
});

// Logout
ipcMain.handle('saml:logout', async () => {
  authenticatedUser = null;
  appConfig = null;
  logger.info('User logged out');
  return { success: true };
});

// ============================================================================
// MANUAL VALIDATION (Advanced)
// ============================================================================

/**
 * If you want to manually validate an assertion without using 
 * the automatic backend validation, you can do it like this:
 */

import { validateSAMLViaAPI } from './saml/src';

export async function manualValidateSAMLAssertion(
  user: any,
  assertion: string,
  backendUrl: string
) {
  try {
    const result = await validateSAMLViaAPI(user, assertion, backendUrl);
    
    console.log('✅ Manual validation successful:', result);
    
    // Store result and update UI
    authenticatedUser = result.user;
    appConfig = result.config;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('saml:validated', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Manual validation failed:', error);
    throw error;
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

/*

HOW BACKEND VALIDATION WORKS:

1. Configure in sso.ini:
   [SAML]
   validateUrl=https://your-backend.com/api/saml/validate

2. User authenticates at IdP
   → IdP redirects to http://localhost:3001/auth/saml/callback

3. SamlClient receives SAML response
   → Extracts user data
   → Extracts raw SAML assertion

4. SamlClient calls YOUR backend:
   POST https://your-backend.com/api/saml/validate
   Body: { assertion, user: { name, email } }

5. Your backend:
   → Verifies SAML signature
   → Checks authorization
   → Returns config data

6. SamlClient receives response
   → Calls onSuccess callback with:
     { user, config }

7. App uses authenticated user + config:
   → Store session tokens
   → Load user-specific data
   → Grant permissions
   → Initialize features

FLOW:
IdP → Electron App → Your Backend → Electron App → Render UI

ALL AUTOMATIC - No manual validation needed!

*/
