/**
 * Utility functions for SAML handling
 */
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

/**
 * Fetch and parse SAML metadata from IdP
 */
export async function fetchSAMLMetadata(metadataUrl: string) {
  try {
    logger.info(`Fetching SAML metadata from: ${metadataUrl}`);
    
    let xmlContent: string;
    const isLocalPath = metadataUrl.startsWith('/') || metadataUrl.startsWith('file://') || /^[a-zA-Z]:/.test(metadataUrl);
    
    if (isLocalPath) {
      const filePath = metadataUrl.startsWith('file://') 
        ? decodeURIComponent(metadataUrl.replace('file://', ''))
        : metadataUrl;
      logger.info(`Reading local metadata file: ${filePath}`);
      xmlContent = fs.readFileSync(filePath, 'utf-8');
    } else {
      const response = await axios.get(metadataUrl);
      xmlContent = response.data;
    }
    
    const metadata = await parseStringPromise(xmlContent);
    
    let entityDescriptor = metadata.EntityDescriptor || metadata['md:EntityDescriptor'];
    if (Array.isArray(entityDescriptor)) {
      entityDescriptor = entityDescriptor[0];
    }
    
    if (!entityDescriptor) {
      throw new Error('EntityDescriptor not found in metadata');
    }

    let idpSsoDescriptors = entityDescriptor.IDPSSODescriptor || entityDescriptor['md:IDPSSODescriptor'];
    if (!idpSsoDescriptors) {
      throw new Error('IDPSSODescriptor not found in metadata');
    }

    const idpSsoDescriptor = Array.isArray(idpSsoDescriptors) 
      ? idpSsoDescriptors[0] 
      : idpSsoDescriptors;

    // Extract certificate
    let certificate: string | undefined;
    let keyDescriptors = idpSsoDescriptor.KeyDescriptor || idpSsoDescriptor['md:KeyDescriptor'] || [];
    
    if (!Array.isArray(keyDescriptors)) {
      keyDescriptors = [keyDescriptors];
    }

    for (const keyDesc of keyDescriptors) {
      let keyInfo = keyDesc.KeyInfo || keyDesc['ds:KeyInfo'];
      if (Array.isArray(keyInfo)) {
        keyInfo = keyInfo[0];
      }

      let x509Data = keyInfo?.X509Data || keyInfo?.['ds:X509Data'];
      if (Array.isArray(x509Data)) {
        x509Data = x509Data[0];
      }

      let x509Cert = x509Data?.X509Certificate || x509Data?.['ds:X509Certificate'];
      if (Array.isArray(x509Cert)) {
        x509Cert = x509Cert[0];
      }

      if (x509Cert) {
        certificate = x509Cert;
        break;
      }
    }

    // Extract SingleSignOnService entry point
    let entryPoint: string | undefined;
    let singleSignOnServices = idpSsoDescriptor.SingleSignOnService || idpSsoDescriptor['md:SingleSignOnService'] || [];
    
    if (!Array.isArray(singleSignOnServices)) {
      singleSignOnServices = [singleSignOnServices];
    }

    for (const ssoService of singleSignOnServices) {
      const binding = ssoService.Binding?.[0] || ssoService.$?.Binding;
      const location = ssoService.Location?.[0] || ssoService.$?.Location;
      
      if (binding && binding.includes('HTTP-Redirect')) {
        entryPoint = location;
        break;
      }
      
      if (!entryPoint && location) {
        entryPoint = location;
      }
    }

    if (!entryPoint) {
      throw new Error('SingleSignOnService Location not found in metadata');
    }

    logger.info('SAML Metadata parsed successfully');
    return {
      certificate: certificate ? `-----BEGIN CERTIFICATE-----\n${certificate}\n-----END CERTIFICATE-----` : undefined,
      entryPoint: entryPoint,
    };
  } catch (error) {
    logger.error('Failed to fetch SAML metadata', error);
    throw error;
  }
}

/**
 * Load certificate from URL or local file path
 */
export async function loadCertificate(certificateSource: string): Promise<string> {
  if (!certificateSource) {
    throw new Error('Certificate source is empty');
  }

  try {
    if (certificateSource.startsWith('http://') || certificateSource.startsWith('https://')) {
      logger.info(`Loading certificate from URL: ${certificateSource}`);
      const response = await axios.get(certificateSource, { timeout: 10000 });
      
      let cert = response.data;
      if (!cert.includes('BEGIN CERTIFICATE')) {
        cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
      }
      
      logger.info('Certificate loaded from URL');
      return cert;
    } else {
      logger.info(`Loading certificate from file: ${certificateSource}`);
      
      let filePath = certificateSource;
      if (filePath.startsWith('~')) {
        filePath = path.join(os.homedir(), filePath.slice(1));
      }
      
      if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(process.cwd(), filePath);
      }
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Certificate file not found: ${filePath}`);
      }
      
      let cert = fs.readFileSync(filePath, 'utf-8');
      if (!cert.includes('BEGIN CERTIFICATE')) {
        cert = `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
      }
      
      logger.info('Certificate loaded from file');
      return cert;
    }
  } catch (error: any) {
    logger.error('Failed to load certificate', error.message);
    throw new Error(`Failed to load certificate from ${certificateSource}: ${error.message}`);
  }
}

/**
 * Validate SAML assertion via API endpoint
 */
/**
 * Apply configuration to storage (localStorage or file system)
 * Mirrors the behavior of fetchAndStoreXML() in index.html
 */
export function applyConfigToStorage(config: any): void {
  try {
    if (!config || typeof config !== 'object') {
      logger.warn('Invalid config object provided to applyConfigToStorage');
      return;
    }

    // Store config entries in localStorage (matching fetchAndStoreXML behavior)
    for (const [key, value] of Object.entries(config)) {
      if (value !== null && value !== undefined) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        logger.info(`Storing config: ${key} = ${stringValue.substring ? stringValue.substring(0, 100) : stringValue}`);
        
        // Store in localStorage if available (for browser/Electron preload contexts)
        try {
          const storage = (global as any).localStorage || 
                         ((global as any).window && (global as any).window.localStorage);
          if (storage) {
            storage.setItem(key, stringValue);
          }
        } catch (storageError) {
          logger.warn(`Failed to store ${key} in localStorage:`, storageError);
        }
        
        // Also store in global context
        try {
          const globalObj = (global as any);
          globalObj[key] = stringValue;
        } catch (globalError) {
          // Silently ignore if we can't set global
        }
      }
    }

    logger.info(`Config applied successfully (${Object.keys(config).length} entries)`);
  } catch (error: any) {
    logger.error('Error applying config to storage:', error.message);
  }
}

/**
 * Parse config XML with <entry> elements into object
 * Handles format: <config><entry name="key">value</entry>...</config>
 */
async function parseConfigEntries(xmlResponse: any): Promise<any> {
  const config: any = {};
  
  logger.info('parseConfigEntries - xmlResponse keys:', Object.keys(xmlResponse));
  
  // Navigate the nested structure: response.config[0].config[0]
  let configElement = xmlResponse.config || 
                      xmlResponse.response?.config?.[0] || 
                      xmlResponse.response?.config?.[0]?.config?.[0] ||
                      xmlResponse.response?.config;
  
  logger.info('parseConfigEntries - Initial configElement type:', typeof configElement);
  logger.info('parseConfigEntries - Initial configElement keys:', 
    typeof configElement === 'object' ? Object.keys(configElement) : 'N/A');
  
  // If configElement is still an object with a nested 'config' key, go deeper
  if (configElement && typeof configElement === 'object' && configElement.config) {
    logger.info('Found nested config element, going deeper...');
    configElement = configElement.config;
  }
  
  if (!configElement) {
    logger.warn('No config element found in response');
    return config;
  }
  
  // Handle array wrapping (xml2js wraps root elements in arrays)
  if (Array.isArray(configElement)) {
    logger.info(`ConfigElement is array with ${configElement.length} items`);
    
    // Check if first element is a raw XML string (unparsed)
    if (configElement.length > 0 && typeof configElement[0] === 'string') {
      const firstItem = configElement[0] as string;
      logger.info(`First item is string, length: ${firstItem.length}`);
      logger.info(`First 200 chars: ${firstItem.substring(0, 200)}`);
      
      if (firstItem.includes('<?xml') || firstItem.includes('<entry')) {
        logger.warn('Detected raw XML string in config - attempting to re-parse');
        
        try {
          // Re-parse the raw XML string with namespace handling
          const reparsed = await parseStringPromise(firstItem, { 
            xmlns: false,
            ignoreAttrs: false 
          });
          logger.info('Re-parsed XML keys:', Object.keys(reparsed));
          
          // Get the config element from reparsed
          configElement = reparsed.config || reparsed;
          logger.info('Successfully re-parsed raw XML string');
          logger.info('After re-parse configElement:', JSON.stringify(configElement, null, 2).substring(0, 500));
        } catch (reParseError: any) {
          logger.error('Failed to re-parse XML string:', reParseError.message);
          
          // Fallback: try to extract entries via regex from raw XML
          logger.info('Attempting regex fallback to extract entries');
          const entryRegex = /<entry\s+name="([^"]*)">([^<]*)<\/entry>/g;
          let match;
          let extractedCount = 0;
          
          while ((match = entryRegex.exec(firstItem)) !== null) {
            const name = match[1];
            const value = match[2];
            config[name] = value;
            extractedCount++;
            if (extractedCount <= 5) {
              logger.info(`✅ Regex extracted: ${name} = ${value.substring(0, 50)}`);
            }
          }
          
          logger.info(`Regex fallback found ${extractedCount} entries total`);
          if (Object.keys(config).length > 0) {
            return config;
          }
        }
      }
    }
    
    // Use first element if array
    if (Array.isArray(configElement) && configElement.length > 0) {
      configElement = configElement[0];
      logger.info('Using first element of array');
    } else if (Array.isArray(configElement)) {
      logger.warn('Config element array is empty');
      return config;
    }
  }
  
  logger.info('parseConfigEntries - Processing configElement type:', typeof configElement);
  if (typeof configElement === 'object') {
    logger.info('parseConfigEntries - configElement keys:', Object.keys(configElement).slice(0, 10));
  }
  
  // Get entry elements (can be array or single element)
  let entries = configElement?.entry || [];
  
  logger.info(`Entry elements type: ${typeof entries}, isArray: ${Array.isArray(entries)}, count: ${Array.isArray(entries) ? entries.length : 'N/A'}`);
  
  if (!Array.isArray(entries)) {
    entries = entries ? [entries] : [];
  }
  
  logger.info(`Processing ${entries.length} config entries`);
  
  // Parse each entry with name attribute
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    if (i < 3 || i >= entries.length - 2) {
      logger.info(`Entry ${i}:`, JSON.stringify(entry, null, 2).substring(0, 300));
    }
    
    // xml2js format: { $: { name: "key" }, _: "value" }
    const name = entry.$ ? entry.$.name : entry.name?.[0];
    const value = typeof entry === 'string' ? entry : (entry._ || entry[Object.keys(entry)[0]]?.[0] || '');
    
    if (name) {
      config[name] = value;
      if (i < 3) {
        logger.info(`✅ Config entry stored: ${name} = ${value.substring ? value.substring(0, 50) : value}`);
      }
    }
  }
  
  logger.info(`parseConfigEntries - Final config object: ${Object.keys(config).length} entries`);
  if (Object.keys(config).length > 0) {
    const sampleKeys = Object.keys(config).slice(0, 5);
    logger.info(`Sample entries: ${sampleKeys.map(k => `${k}=${config[k].substring ? config[k].substring(0, 30) : config[k]}`).join(', ')}`);
  }
  return config;
}

export async function validateSAMLViaAPI(
  user: any,
  assertion: string,
  validateUrl: string
): Promise<any> {
  try {
    logger.info(`Sending SAML assertion to ${validateUrl}`);
    logger.info(`User data: name=${user.name}, email=${user.email}`);
    
    const payload = {
      assertion: assertion,
      user: {
        name: user.name,
        email: user.email,
      },
    };

    logger.info(`Payload being sent to API`, { 
      payloadSize: JSON.stringify(payload).length,
      assertionLength: assertion.length 
    });

    const response = await axios.post(validateUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    logger.info('API validation response received', { 
      status: response.status,
      contentType: response.headers['content-type'],
      dataType: typeof response.data,
      dataLength: JSON.stringify(response.data).length
    });

    logger.info(`Raw API response data:`, response.data);

    // Parse XML response
    let xmlResponse: any;
    try {
      xmlResponse = await parseStringPromise(response.data);
      logger.info('API response parsed as XML successfully');
      logger.info('Parsed XML structure - Root keys:', Object.keys(xmlResponse));
      logger.info('Full parsed XML:', JSON.stringify(xmlResponse, null, 2));
    } catch (xmlError: any) {
      logger.warn(`Failed to parse response as XML: ${xmlError.message}`);
      logger.info(`Attempting to handle as JSON...`);
      
      // If response is already JSON, try to use it directly
      if (typeof response.data === 'object') {
        xmlResponse = { response: response.data };
        logger.info('Handled response as JSON object');
      } else if (typeof response.data === 'string') {
        try {
          const jsonData = JSON.parse(response.data);
          xmlResponse = { response: jsonData };
          logger.info('Parsed response as JSON string');
        } catch (jsonError: any) {
          logger.error(`Failed to parse as JSON: ${jsonError.message}`);
          logger.error(`Raw response content: ${JSON.stringify(response.data)}`);
          throw new Error(`Response parsing failed - neither XML nor JSON: ${xmlError.message}`);
        }
      } else {
        throw xmlError;
      }
    }

    // Check for success in response structure
    const success = xmlResponse.response?.success?.[0] === 'true' || xmlResponse.response?.success === true;
    
    // If no response element, treat config-only response as success
    const isConfigOnlyResponse = !xmlResponse.response && (xmlResponse.config || xmlResponse.$);
    
    logger.info(`API response success value: ${success || isConfigOnlyResponse}`);

    if (!success && !isConfigOnlyResponse) {
      const error = xmlResponse.response?.error?.[0] || xmlResponse.response?.error || 'Unknown error';
      logger.error(`API validation failed with error: ${error}`);
      logger.info(`Full response object:`, xmlResponse);
      throw new Error(`API validation failed: ${error}`);
    }

    // Extract user data
    const userData = xmlResponse.response?.user?.[0] || xmlResponse.response?.user || {};
    
    // Parse config - handle both entry-based and nested config format
    const configData = await parseConfigEntries(xmlResponse);

    logger.info('API validation successful');
    logger.info(`Returned user data:`, userData);
    logger.info(`Returned config data (${Object.keys(configData).length} entries):`, configData);

    return {
      success: true,
      user: {
        name: userData.name?.[0] || userData.name || user.name,
        email: userData.email?.[0] || userData.email || user.email,
      },
      config: configData,
    };
  } catch (error: any) {
    logger.error('API validation error', error.message);
    logger.error('Stack trace:', error.stack);
    throw new Error(`Failed to validate with API: ${error.message}`);
  }
}
