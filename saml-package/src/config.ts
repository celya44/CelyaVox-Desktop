/**
 * Configuration management for SAML package
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ini from 'ini';
import { SAMLConfig } from './types';

/**
 * Get config directory based on OS conventions
 * Linux: ~/.config/CelyaVox (or ~/.config/CelyaVox-dev if APP_ENV=dev)
 * macOS: ~/Library/Application Support/CelyaVox
 * Windows: C:\Users\<user>\AppData\Roaming\CelyaVox
 */
function getConfigDirectory(): string {
  const platform = process.platform;
  const appEnv = process.env.APP_ENV || 'prod';
  const appName = appEnv === 'dev' ? 'celyavox-dev' : 'CelyaVox';
  
  let configDir: string;
  
  switch (platform) {
    case 'darwin':
      // macOS
      configDir = path.join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    case 'win32':
      // Windows - Use APPDATA
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      configDir = path.join(appData, appName);
      break;
    default:
      // Linux and other Unix-like systems
      configDir = path.join(os.homedir(), '.config', appName);
  }
  
  return configDir;
}

/**
 * Ensure config directory exists
 */
function ensureConfigDirectory(): string {
  const configDir = getConfigDirectory();
  
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`[SAML Config] Created config directory: ${configDir}`);
    } catch (error) {
      console.error(`[SAML Config] Failed to create config directory: ${configDir}`);
      throw error;
    }
  }
  
  return configDir;
}

/**
 * Load SAML configuration from sso.ini
 */
export function loadSAMLConfig(): SAMLConfig {
  const configDir = ensureConfigDirectory();
  const configPath = path.join(configDir, 'sso.ini');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `SAML configuration file not found at ${configPath}\n` +
      `Please copy sso.ini.example to ${configPath} and configure it.`
    );
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const parsed = ini.parse(configContent);

    if (!parsed.SAML) {
      throw new Error('SAML section not found in sso.ini');
    }

    const config: SAMLConfig = {
      metadataUrl: parsed.SAML.metadataUrl,
      certificateFilePath: parsed.SAML.certificateFilePath || '',
      entryPoint: parsed.SAML.entryPoint || '',
      issuer: parsed.SAML.issuer || '',
      callbackUrl: parsed.SAML.callbackUrl || '',
      validateUrl: parsed.SAML.validateUrl || '',
    };

    console.log('[SAML Config] Configuration loaded successfully');
    return config;
  } catch (error) {
    throw new Error(`Failed to load SAML configuration: ${error}`);
  }
}

/**
 * Get config directory path for manual inspection
 */
export function getConfigPath(): string {
  const configDir = getConfigDirectory();
  return path.join(configDir, 'sso.ini');
}
