/**
 * Configuration pour les environnements dev/prod
 */

const packageJson = require('./package.json');

// Lire l'environnement depuis package.json config ou variable d'environnement
const environment = process.env.APP_ENV || packageJson.config?.environment || 'dev';

const config = {
  dev: {
    serverUrl: 'https://freepbx17-dev.celya.fr/celyavox',
    appName: 'CelyaVox Dev',
    productName: 'celyavox-dev',
    appId: 'fr.celya.celyavox.dev'
  },
  prod: {
    serverUrl: 'https://celyavox.celya.fr/phone',
    appName: 'CelyaVox',
    productName: 'celyavox',
    appId: 'fr.celya.celyavox'
  }
};

// Exporter la config selon l'environnement
const currentConfig = config[environment] || config.dev;

module.exports = {
  environment,
  ...currentConfig,
  isDev: environment === 'dev',
  isProd: environment === 'prod'
};
