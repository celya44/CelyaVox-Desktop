#!/usr/bin/env node
/**
 * Script de pré-build pour configurer l'environnement
 * Modifie dynamiquement package.json selon l'environnement
 */

const fs = require('fs');
const path = require('path');

// Le script est dans scripts/, donc on remonte d'un niveau pour trouver package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Lire l'environnement
const env = process.env.APP_ENV || packageJson.config?.environment || 'dev';

console.log(`\n🔧 Configuration du build pour l'environnement: ${env}\n`);

// Modifier le productName selon l'environnement
if (env === 'dev') {
  packageJson.build.productName = 'celyavox-dev';
  packageJson.build.appId = 'fr.celya.celyavox.dev';
  packageJson.build.linux.desktop.Name = 'CelyaVox Dev';
  
  // Ajouter le suffixe -dev à tous les artéfacts Linux
  packageJson.build.deb = packageJson.build.deb || {};
  packageJson.build.deb.artifactName = 'celyavox-dev_${version}_${arch}.${ext}';
  
  packageJson.build.rpm = packageJson.build.rpm || {};
  packageJson.build.rpm.artifactName = 'celyavox-dev-${version}.${arch}.${ext}';
  
  // Ensure deb package metadata used by fpm/app-builder-lib
  packageJson.build.deb.packageName = packageJson.build.productName;
  packageJson.build.deb.maintainer = `${packageJson.author.name} <${packageJson.author.email}>`;
  
  // Définir l'environnement par défaut pour l'exécutable
  packageJson.config.environment = 'dev';
  
  // AppImage utilise déjà le productName, donc OK
  
  console.log('✅ Mode DEV configuré');
  console.log('   - Product Name: celyavox-dev');
  console.log('   - App ID: fr.celya.celyavox.dev');
  console.log('   - Artifacts: celyavox-dev-*');
  console.log('   - Server: https://freepbx17-dev.celya.fr/celyavox');
} else {
  packageJson.build.productName = 'celyavox';
  packageJson.build.appId = 'fr.celya.celyavox';
  packageJson.build.linux.desktop.Name = 'CelyaVox';
  
  // Nom standard pour prod
  if (packageJson.build.deb?.artifactName) delete packageJson.build.deb.artifactName;
  packageJson.build.deb = packageJson.build.deb || {};
  // Ensure deb package metadata used by fpm/app-builder-lib
  packageJson.build.deb.packageName = packageJson.build.productName;
  packageJson.build.deb.maintainer = `${packageJson.author.name} <${packageJson.author.email}>`;
  if (packageJson.build.rpm?.artifactName) delete packageJson.build.rpm.artifactName;
  
  // Définir l'environnement par défaut pour l'exécutable
  packageJson.config.environment = 'prod';
  
  console.log('✅ Mode PROD configuré');
  console.log('   - Product Name: celyavox');
  console.log('   - App ID: fr.celya.celyavox');
  console.log('   - Artifacts: celyavox-*');
  console.log('   - Server: https://celyavox.celya.fr/phone');
}

// Sauvegarder le package.json modifié
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// ============================================================
// Créer config.ini s'il n'existe pas
// ============================================================
const configDir = path.join(__dirname, '..', 'config');
const configIniPath = path.join(configDir, 'config.ini');
if (!fs.existsSync(configIniPath)) {
  // Créer le dossier config s'il n'existe pas
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const defaultConfigIni = `# Configuration CelyaVox Desktop
# Fichier de configuration déployé avec l'application
# Format: INI

# Les valeurs par défaut sont utilisées si les paramètres ne sont pas définis ici

# Taille de la fenêtre principale (pixels)
# Par défaut: width=1280, height=820
[window]
# width=1280
# height=820

# Interface utilisateur
# disableBuddies: Supprime le bouton "Ajouter un contact" du profil (0=activé, 1=désactivé)
# disableDoNotDisturb: Masque le bloc "Ne pas déranger (DND)" des Fonctions avancées (0=afficher, 1=masquer)
# disableCallForward: Masque le bloc "Renvoi d'appel (CFU)" des Fonctions avancées (0=afficher, 1=masquer)
# disableGUISipAccount: Masque le bloc "Compte" des paramètres (0=afficher, 1=masquer)
[ui]
# disableBuddies=0
# disableDoNotDisturb=0
# disableCallForward=0
# disableGUISipAccount=0
`;
  
  try {
    fs.writeFileSync(configIniPath, defaultConfigIni, 'utf8');
    console.log('📝 Fichier config.ini créé avec les valeurs par défaut');
  } catch (err) {
    console.error('❌ Erreur lors de la création de config.ini:', err.message);
    process.exit(1);
  }
} else {
  console.log('✅ Fichier config.ini existant trouvé');
}

console.log('\n✅ package.json mis à jour pour le build\n');
