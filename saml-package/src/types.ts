/**
 * Types pour le package SAML
 */

export interface SAMLConfig {
  metadataUrl?: string;
  certificateFilePath?: string;
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  validateUrl?: string; // URL pour valider l'assertion SAML côté backend
}

export interface User {
  name: string;
  email: string;
  method: string;
  claims?: any;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  config?: Record<string, string>;
}

export interface SamlServerConfig {
  port: number;
  autoLaunch: boolean; // Démarrer automatiquement l'authentification
  closeWindowOnSuccess: boolean; // Fermer la fenêtre après succès
}

export interface OnAuthCallbacks {
  onSuccess: (result: AuthResult) => void;
  onError: (error: Error) => void;
}
