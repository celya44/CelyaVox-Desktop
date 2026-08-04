# SAML Package - Guide d'Intégration

## Vue d'ensemble

Ce package fournit une implémentation SAML réutilisable et streamlined pour les applications Electron sans interface utilisateur. Il permet :

- **Authentification automatique au lancement**
- **Gestion simplifiée du flux SAML**
- **API de validation (optionnel)**
- **Callbacks personnalisés**

## Installation

### 1. Copier le package dans votre projet

```bash
cp -r saml-package /chemin/vers/votre/project/src/saml
```

### 2. Installer les dépendances

```bash
npm install express passport passport-saml axios xml2js ini
npm install --save-dev @types/express @types/passport @types/node
```

### 3. Configurer sso.ini

Créez `~/.config/CelyaVox/sso.ini` avec la configuration :

```ini
[SAML]
# Option 1: Télécharger les métadonnées (recommandé)
metadataUrl=https://your-idp.com/metadata.xml

# OU Option 2: Configuration manuelle
certificateFilePath=/path/to/idp-certificate.pem
entryPoint=https://your-idp.com/saml/sso

issuer=urn:your-app:identifier
callbackUrl=http://localhost:3001/auth/saml/callback

# Optionnel: URL pour valider l'assertion SAML côté backend
validateUrl=https://your-backend.com/api/validate-saml
```

## Utilisation - Mode Automatique (Recommandé)

Pour une authentification automatique au lancement, sans fenêtre popup :

```typescript
// src/main.ts
import { app, BrowserWindow } from 'electron';
import { SamlClient, loadSAMLConfig } from './saml/src';

let mainWindow: BrowserWindow | null = null;
let samlClient: SamlClient | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', async () => {
  createWindow();
  
  if (mainWindow) {
    try {
      // Charger la configuration SAML
      const samlConfig = loadSAMLConfig();
      
      // Créer et initialiser le client SAML
      samlClient = new SamlClient(samlConfig, {
        port: 3001,
        autoLaunch: true,
        closeWindowOnSuccess: true,
      });
      
      samlClient.setMainWindow(mainWindow);
      
      // Initialiser avec des callbacks personnalisés
      await samlClient.initialize({
        onSuccess: (result) => {
          console.log('✅ Authentication successful!');
          console.log('User:', result.user);
          console.log('Config:', result.config);
          
          // Faire quelque chose avec les données utilisateur
          mainWindow?.webContents.send('user-authenticated', result.user);
        },
        onError: (error) => {
          console.error('❌ Authentication failed:', error.message);
          // Gérer l'erreur
          mainWindow?.webContents.send('auth-error', { error: error.message });
        },
      });
      
      // Démarrer le serveur SAML
      await samlClient.start();
      
      // Ouvrir automatiquement le navigateur pour l'authentification
      const { shell } = require('electron');
      shell.openExternal(samlClient.getLoginURL());
      
    } catch (error) {
      console.error('Failed to initialize SAML:', error);
      app.quit();
    }
  }
});

app.on('window-all-closed', async () => {
  // Arrêter le serveur SAML avant de quitter
  if (samlClient) {
    await samlClient.stop();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

## Utilisation - Mode Popup (Avec Fenêtre de Connexion)

Pour une authentification avec fenêtre popup interactive :

```typescript
// src/auth.ts
import { ipcMain, BrowserWindow, shell } from 'electron';
import { SamlClient, loadSAMLConfig } from './saml/src';

let samlClient: SamlClient | null = null;
let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;

export function initSAML(window: BrowserWindow) {
  mainWindow = window;
}

ipcMain.handle('auth:login-saml', async (event) => {
  try {
    if (!samlClient) {
      const samlConfig = loadSAMLConfig();
      samlClient = new SamlClient(samlConfig, { port: 3001 });
      samlClient.setMainWindow(mainWindow);
      await samlClient.initialize();
      await samlClient.start();
    }

    // Créer une fenêtre popup pour l'authentification
    authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      parent: mainWindow || undefined,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    authWindow.loadURL(samlClient.getLoginURL());
    authWindow.show();

    samlClient.setAuthWindow(authWindow);

    authWindow.once('closed', () => {
      authWindow = null;
    });

    return { success: true, message: 'Auth window opened' };
  } catch (error: any) {
    console.error('SAML Login failed:', error);
    return { success: false, error: error.message };
  }
});
```

## Utilisation - Mode Renderer (React/Frontend)

Si vous avez une interface React, écoutez les événements IPC :

```typescript
// src/App.tsx
import React, { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Écouter les événements d'authentification
    const unsubscribeSAML = (window as any).electron?.on?.('auth:saml-success', (result: any) => {
      console.log('✅ SAML Success:', result);
      setUser(result.user);
      setError(null);
    });

    const unsubscribeError = (window as any).electron?.on?.('auth:saml-error', (result: any) => {
      console.error('❌ SAML Error:', result);
      setError(result.error);
      setUser(null);
    });

    return () => {
      unsubscribeSAML?.();
      unsubscribeError?.();
    };
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await (window as any).electron?.invoke?.('auth:login-saml');
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Authentification en cours...</div>;
  }

  if (user) {
    return (
      <div>
        <h1>✅ Connecté!</h1>
        <p>Nom: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Méthode: {user.method}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>❌ Erreur d'authentification</h1>
        <p>{error}</p>
        <button onClick={handleLogin}>Réessayer</button>
      </div>
    );
  }

  return <button onClick={handleLogin}>Se connecter via SAML</button>;
}

export default App;
```

## Intégration du Backend (Validation SAML)

Si vous avez un backend qui valide les assertions SAML, configurez `validateUrl` dans sso.ini :

```ini
[SAML]
validateUrl=https://your-api.com/api/saml/validate
```

Votre endpoint API doit accepter POST avec le format suivant :

```json
{
  "assertion": "<?xml version=\"1.0\"...assertion XML...</assertion>",
  "user": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

Et retourner une réponse XML :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <success>true</success>
  <user>
    <name>John Doe</name>
    <email>john@example.com</email>
  </user>
  <config>
    <role>admin</role>
    <department>IT</department>
  </config>
</response>
```

## Dépannage

### "Certificate not found"
- Vérifiez que `metadataUrl` est accessible
- Ou fournissez `certificateFilePath` dans sso.ini
- Vérifiez les chemins : les chemins relatifs sont résolusMaintenant par rapport au répertoire de travail

### "SAML configuration file not found"
- Vérifiez que `~/.config/CelyaVox/sso.ini` existe
- Copiez `sso.ini.example` si nécessaire

### Timeouts lors de la récupération des métadonnées
- Vérifiez la connectivité réseau
- Augmentez le timeout en modifiant `loadCertificate()` (default: 10s)

### "Route not found" errors
- Le serveur SAML doit écouter sur le port configuré
- Vérifiez qu'aucune autre application n'utilise le même port

## Configuration Avancée

### Personnaliser les callbacks

```typescript
const callbacks = {
  onSuccess: (result) => {
    // Sauvegarder le token dans localStorage/indexedDB
    // Envoyer les données au serveur
    // Mettre à jour l'UI
  },
  onError: (error) => {
    // Logger l'erreur
    // Afficher un message à l'utilisateur
    // Réessayer automatiquement
  },
};

await samlClient.initialize(callbacks);
```

### Accéder aux données utilisateur

```typescript
const currentUser = samlClient.getCurrentUser();
if (currentUser) {
  console.log('Utilisateur connecté:', currentUser.name);
  console.log('Claims SAML:', currentUser.claims);
}
```

### Arrêter et redémarrer le serveur

```typescript
// Arrêter
await samlClient.stop();

// Redémarrer
await samlClient.start();
```

## Support

Pour des problèmes ou des questions :
1. Vérifiez les logs dans la console Electron
2. Activez le mode DEBUG : `DEBUG=true npm run dev`
3. Consultez [SAML_IMPLEMENTATION.md](../SAML_IMPLEMENTATION.md) pour plus d'informations

## Licence

MIT
