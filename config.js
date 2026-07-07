/**
 * Configuration pour les environnements dev/prod
 * Charge la configuration depuis config.ini si disponible
 * En production, le fichier est dans le dossier utilisateur et n'est jamais écrasé
 */

const packageJson = require('./package.json');
const path = require('path');
const fs = require('fs');
const ini = require('ini');

// Lire l'environnement depuis package.json config ou variable d'environnement
const environment = process.env.APP_ENV || packageJson.config?.environment || 'dev';

// Charger la configuration .ini si elle existe
let iniConfig = {};

// Déterminer le chemin du fichier config.ini
// En développement: ./config.ini à la racine
// En production: userDataPath/config.ini (passé par main.js via env var)
const getConfigPath = () => {
  const configPaths = [];
  
  // Développement: chercher à la racine du projet
  if (environment === 'dev') {
    configPaths.push(path.join(__dirname, 'config.ini'));
  }
  
  // Production: chercher dans le userData (passé par main.js)
  if (process.env.CELYAVOX_USER_CONFIG_PATH) {
    configPaths.unshift(process.env.CELYAVOX_USER_CONFIG_PATH);
  }
  
  // Fallback: chercher dans le bundle app
  if (process.resourcesPath) {
    configPaths.push(path.join(process.resourcesPath, 'config.ini'));
  }
  
  return configPaths;
};

// Charger le fichier config.ini
const configPaths = getConfigPath();
for (const configPath of configPaths) {
  if (fs.existsSync(configPath)) {
    try {
      const iniContent = fs.readFileSync(configPath, 'utf-8');
      iniConfig = ini.parse(iniContent);
      console.log(`✅ Configuration INI chargée depuis: ${configPath}`);
    } catch (err) {
      console.error(`❌ Erreur lors de la lecture de config.ini: ${err.message}`);
    }
    break;
  }
}

// Configuration par défaut pour chaque environnement
const config = {
  dev: {
    serverUrl: 'https://freepbx17-dev.celya.fr/celyavox',
    appName: 'CelyaVox Dev',
    productName: 'celyavox-dev',
    appId: 'fr.celya.celyavox.dev',
    window: {
      width: 1280,
      height: 820
    },
    ui: {
      disableBuddies: false
    }
  },
  prod: {
    serverUrl: 'https://celyavox.celya.fr/phone',
    appName: 'CelyaVox',
    productName: 'celyavox',
    appId: 'fr.celya.celyavox',
    window: {
      width: 1280,
      height: 820
    },
    ui: {
      disableBuddies: false
    }
  }
};

// Exporter la config selon l'environnement
const currentConfig = config[environment] || config.dev;

// Fusionner avec la config INI (la config INI surcharge les valeurs par défaut)
const mergedConfig = {
  ...currentConfig,
  ...iniConfig
};

module.exports = {
  environment,
  ...mergedConfig,
  isDev: environment === 'dev',
  isProd: environment === 'prod',
  // Exposer la config INI pour débogage
  _iniConfig: iniConfig,
  _configPath: configPaths,
  // Exposer les paramètres de fenêtre
  window: mergedConfig.window || currentConfig.window,
  // Exposer les paramètres UI
  ui: mergedConfig.ui || currentConfig.ui
};
