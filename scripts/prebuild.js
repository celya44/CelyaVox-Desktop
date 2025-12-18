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

console.log('\n✅ package.json mis à jour pour le build\n');
