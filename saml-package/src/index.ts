/**
 * SAML Package - Public API
 */

export { SamlClient } from './saml-client';
export { loadSAMLConfig, getConfigPath } from './config';
export { logger } from './logger';
export { fetchSAMLMetadata, loadCertificate, validateSAMLViaAPI, applyConfigToStorage } from './utils';
export type {
  SAMLConfig,
  User,
  AuthResult,
  SamlServerConfig,
  OnAuthCallbacks,
} from './types';
