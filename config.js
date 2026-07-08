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
// En production: userDataPath/config.ini (déterminé à partir des chemins standards)
const getConfigPath = () => {
  const configPaths = [];
  
  // Vérifier d'abord si main.js a défini l'env var (pour production après app.whenReady())
  if (process.env.CELYAVOX_USER_CONFIG_PATH) {
    configPaths.push(process.env.CELYAVOX_USER_CONFIG_PATH);
  }
  
  // Chemins userData standardisés (pour dev ET prod)
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    if (environment === 'dev') {
      if (process.platform === 'linux') {
        configPaths.push(path.join(homeDir, '.config', 'celyavox-dev', 'config.ini'));
      } else if (process.platform === 'darwin') {
        configPaths.push(path.join(homeDir, 'Library', 'Application Support', 'celyavox-dev', 'config.ini'));
      } else if (process.platform === 'win32') {
        const appData = process.env.APPDATA || homeDir;
        configPaths.push(path.join(appData, 'celyavox-dev', 'config.ini'));
      }
    } else {
      if (process.platform === 'linux') {
        configPaths.push(path.join(homeDir, '.config', 'CelyaVox', 'config.ini'));
      } else if (process.platform === 'darwin') {
        configPaths.push(path.join(homeDir, 'Library', 'Application Support', 'CelyaVox', 'config.ini'));
      } else if (process.platform === 'win32') {
        const appData = process.env.APPDATA || homeDir;
        configPaths.push(path.join(appData, 'CelyaVox', 'config.ini'));
      }
    }
  }
  
  // Développement: chercher dans resources/, config/ ou à la racine du projet
  if (environment === 'dev') {
    configPaths.push(path.join(__dirname, 'resources', 'config.ini'));
    configPaths.push(path.join(__dirname, 'config', 'config.ini'));
    configPaths.push(path.join(__dirname, 'config.ini'));
  }
  
  // Fallback: chercher dans le bundle app
  if (process.resourcesPath) {
    configPaths.push(path.join(process.resourcesPath, 'resources', 'config.ini'));
    configPaths.push(path.join(process.resourcesPath, 'config.ini'));
  }
  
  return configPaths;
};

// Charger le fichier config.ini
const configPaths = getConfigPath();
console.log(`
🔍 RECHERCHE CONFIG.INI (Environnement: ${environment})
Chemins à tester:
${configPaths.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}
`);

for (const configPath of configPaths) {
  if (fs.existsSync(configPath)) {
    try {
      const iniContent = fs.readFileSync(configPath, 'utf-8');
      iniConfig = ini.parse(iniContent);
      console.log(`✅ Config INI chargée depuis: ${configPath}`);
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
      disableBuddies: false,
      disableDoNotDisturb: false,
      disableCallForward: false,
      disableGUISipAccount: false
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
      disableBuddies: false,
      disableDoNotDisturb: false,
      disableCallForward: false,
      disableGUISipAccount: false
    }
  }
};

// Exporter la config selon l'environnement
const currentConfig = config[environment] || config.dev;

console.log(`
📋 FUSION CONFIG:
INI trouvé:
${JSON.stringify(iniConfig, null, 2)}

Config par défaut (${environment}):
${JSON.stringify(currentConfig, null, 2)}
`);

// Deep merge avec la config INI (surcharge les valeurs par défaut)
const mergedConfig = JSON.parse(JSON.stringify(currentConfig)); // Clone profond

if (iniConfig.window) {
  mergedConfig.window = mergedConfig.window || {};
  console.log(`  📐 Paramètres window trouvés dans INI:`, iniConfig.window);
  // Convertir en nombres si c'est des strings
  if (iniConfig.window.width) {
    mergedConfig.window.width = parseInt(iniConfig.window.width, 10) || currentConfig.window.width;
    console.log(`    ✅ width: ${mergedConfig.window.width}`);
  }
  if (iniConfig.window.height) {
    mergedConfig.window.height = parseInt(iniConfig.window.height, 10) || currentConfig.window.height;
    console.log(`    ✅ height: ${mergedConfig.window.height}`);
  }
}

if (iniConfig.ui) {
  mergedConfig.ui = mergedConfig.ui || {};
  console.log(`  🎛️  Paramètres UI trouvés dans INI:`, iniConfig.ui);
  // Convertir les booléens (0/1 ou true/false)
  if (iniConfig.ui.disableBuddies !== undefined) {
    mergedConfig.ui.disableBuddies = iniConfig.ui.disableBuddies === '1' || iniConfig.ui.disableBuddies === true;
    console.log(`    ✅ disableBuddies: ${mergedConfig.ui.disableBuddies}`);
  }
  if (iniConfig.ui.disableDoNotDisturb !== undefined) {
    mergedConfig.ui.disableDoNotDisturb = iniConfig.ui.disableDoNotDisturb === '1' || iniConfig.ui.disableDoNotDisturb === true;
    console.log(`    ✅ disableDoNotDisturb: ${mergedConfig.ui.disableDoNotDisturb}`);
  }
  if (iniConfig.ui.disableCallForward !== undefined) {
    mergedConfig.ui.disableCallForward = iniConfig.ui.disableCallForward === '1' || iniConfig.ui.disableCallForward === true;
    console.log(`    ✅ disableCallForward: ${mergedConfig.ui.disableCallForward}`);
  }
  if (iniConfig.ui.disableGUISipAccount !== undefined) {
    mergedConfig.ui.disableGUISipAccount = iniConfig.ui.disableGUISipAccount === '1' || iniConfig.ui.disableGUISipAccount === true;
    console.log(`    ✅ disableGUISipAccount: ${mergedConfig.ui.disableGUISipAccount}`);
  }
}

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

console.log(`
✨ CONFIG FINALE EXPORTÉE:
  Environnement: ${environment}
  Window: ${JSON.stringify(mergedConfig.window || currentConfig.window)}
  UI: ${JSON.stringify(mergedConfig.ui || currentConfig.ui)}
`);
