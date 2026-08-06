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
// Ordre de priorité:
// 1. Répertoire d'installation (bundle app) - pour déploiements centralisés
// 2. Répertoire utilisateur (userData) - pour personnalisation utilisateur
// 3. Chemins de développement
const getConfigPath = () => {
  const configPaths = [];
  
  // Priorité 1: Répertoire d'installation (bundle app)
  if (process.resourcesPath) {
    configPaths.push(path.join(process.resourcesPath, 'resources', 'config.ini'));
    configPaths.push(path.join(process.resourcesPath, 'config.ini'));
  }
  configPaths.push(path.join(__dirname, 'resources', 'config.ini'));
  configPaths.push(path.join(__dirname, 'config.ini'));
  
  // Priorité 2: Répertoire utilisateur (userData)
  if (process.env.CELYAVOX_USER_CONFIG_PATH) {
    configPaths.push(process.env.CELYAVOX_USER_CONFIG_PATH);
  }
  
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    if (environment === 'dev') {
      if (process.platform === 'linux') {
        configPaths.push(path.join(homeDir, '.config', 'CelyaVox-dev', 'config.ini'));
      } else if (process.platform === 'darwin') {
        configPaths.push(path.join(homeDir, 'Library', 'Application Support', 'CelyaVox-dev', 'config.ini'));
      } else if (process.platform === 'win32') {
        const appData = process.env.APPDATA || homeDir;
        configPaths.push(path.join(appData, 'CelyaVox-dev', 'config.ini'));
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
  
  // Priorité 3: Chemins de développement
  if (environment === 'dev') {
    configPaths.push(path.join(__dirname, 'config', 'config.ini'));
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
    productName: 'CelyaVox-dev',
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
    },
    audio: {
      ringerOutputLabel: null,  // Label du device de sortie pour la sonnerie
      ringerGain: 1.0           // Volume de la sonnerie (0.0 à 1.0)
    }
  },
  prod: {
    serverUrl: 'https://celyavox.celya.fr/phone',
    appName: 'CelyaVox',
    productName: 'CelyaVox',
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
    },
    audio: {
      ringerOutputLabel: null,  // Label du device de sortie pour la sonnerie
      ringerGain: 1.0           // Volume de la sonnerie (0.0 à 1.0)
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

if (iniConfig.audio) {
  mergedConfig.audio = mergedConfig.audio || {};
  console.log(`  🔊 Paramètres Audio trouvés dans INI:`, iniConfig.audio);
  if (iniConfig.audio.ringerOutputLabel !== undefined) {
    mergedConfig.audio.ringerOutputLabel = iniConfig.audio.ringerOutputLabel || null;
    console.log(`    ✅ ringerOutputLabel: ${mergedConfig.audio.ringerOutputLabel}`);
  }
  if (iniConfig.audio.ringerGain !== undefined) {
    const gain = parseFloat(iniConfig.audio.ringerGain);
    if (isFinite(gain)) {
      mergedConfig.audio.ringerGain = Math.min(Math.max(gain, 0), 1);
      console.log(`    ✅ ringerGain: ${mergedConfig.audio.ringerGain}`);
    }
  }
}

if (iniConfig.server) {
  console.log(`  🌐 Paramètres Serveur trouvés dans INI:`, iniConfig.server);
  if (iniConfig.server.serverUrl) {
    mergedConfig.serverUrl = iniConfig.server.serverUrl;
    console.log(`    ✅ serverUrl: ${mergedConfig.serverUrl}`);
  }
}

if (iniConfig.app) {
  console.log(`  📦 Paramètres App trouvés dans INI:`, iniConfig.app);
  if (iniConfig.app.appName) {
    mergedConfig.appName = iniConfig.app.appName;
    console.log(`    ✅ appName: ${mergedConfig.appName}`);
  }
  if (iniConfig.app.appId) {
    mergedConfig.appId = iniConfig.app.appId;
    console.log(`    ✅ appId: ${mergedConfig.appId}`);
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
  ui: mergedConfig.ui || currentConfig.ui,
  // Exposer les paramètres Audio
  audio: mergedConfig.audio || currentConfig.audio
};

console.log(`
✨ CONFIG FINALE EXPORTÉE:
  Environnement: ${environment}
  App Name: ${mergedConfig.appName}
  App ID: ${mergedConfig.appId}
  Server URL: ${mergedConfig.serverUrl}
  Window: ${JSON.stringify(mergedConfig.window || currentConfig.window)}
  UI: ${JSON.stringify(mergedConfig.ui || currentConfig.ui)}
  Audio: ${JSON.stringify(mergedConfig.audio || currentConfig.audio)}
`);
