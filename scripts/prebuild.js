#!/usr/bin/env node
/**
 * Script de pré-build pour configurer l'environnement
 * Modifie dynamiquement package.json selon l'environnement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Le script est dans scripts/, donc on remonte d'un niveau pour trouver package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Lire l'environnement
const env = process.env.APP_ENV || packageJson.config?.environment || 'dev';

console.log(`\n🔧 Configuration du build pour l'environnement: ${env}\n`);

// ============================================================
// Vérifier le saml-package
// ============================================================
const samlPackagePath = path.join(__dirname, '..', 'saml-package');
const samlDistPath = path.join(samlPackagePath, 'dist');
const samlNodeModulesPath = path.join(samlPackagePath, 'node_modules');
const samlDistIndexPath = path.join(samlDistPath, 'index.js');

console.log('🔨 Vérification du saml-package...');

try {
  // Vérifier si le saml-package est compilé
  if (!fs.existsSync(samlDistIndexPath)) {
    console.log('⚠️  dist/index.js manquant, compilation du saml-package...');
    
    // Vérifier si les dépendances du saml-package sont installées
    if (!fs.existsSync(samlNodeModulesPath)) {
      console.log('📦 Installation des dépendances du saml-package...');
      
      // Déterminer le shell approprié selon la plateforme
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd' : true;  // true = shell par défaut
      
      execSync('npm install', { 
        cwd: samlPackagePath,
        stdio: 'inherit',
        shell: shell
      });
      console.log('✅ Dépendances du saml-package installées\n');
    }
    
    if (!fs.existsSync(samlDistPath)) {
      fs.mkdirSync(samlDistPath, { recursive: true });
    }
    
    // Exécuter tsc dans le répertoire saml-package
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : true;  // true = shell par défaut
    
    execSync('npx tsc', { 
      cwd: samlPackagePath,
      stdio: 'inherit',
      shell: shell
    });
    
    console.log('✅ Compilation du saml-package réussie\n');
  } else {
    console.log('✅ saml-package compilé (dist/index.js trouvé)\n');
  }
} catch (err) {
  console.error('❌ Erreur lors de la compilation du saml-package:', err.message);
  console.error('   Exécutez manuellement: cd saml-package && npm install && npx tsc');
  process.exit(1);
}

// Modifier le productName selon l'environnement
if (env === 'dev') {
  packageJson.build.productName = 'CelyaVox-dev';  // Dossier userData
  packageJson.build.appId = 'fr.celya.celyavox.dev';
  packageJson.build.linux.desktop.Name = 'CelyaVox Dev';
  
  // Ajouter le suffixe -dev à tous les artéfacts Linux
  packageJson.build.deb = packageJson.build.deb || {};
  packageJson.build.deb.artifactName = 'celyavox-dev_${version}_${arch}.${ext}';  // Paquet Linux en minuscules
  packageJson.build.deb.packageName = 'celyavox-dev';  // Nom du paquet en minuscules
  
  packageJson.build.rpm = packageJson.build.rpm || {};
  packageJson.build.rpm.artifactName = 'celyavox-dev-${version}.${arch}.${ext}';
  packageJson.build.rpm.packageName = 'celyavox-dev';
  
  packageJson.build.deb.maintainer = `${packageJson.author.name} <${packageJson.author.email}>`;
  
  // Définir l'environnement par défaut pour l'exécutable
  packageJson.config.environment = 'dev';
  
  // AppImage utilise déjà le productName, donc OK
  
  console.log('✅ Mode DEV configuré');
  console.log('   - Product Name: CelyaVox-dev');
  console.log('   - App ID: fr.celya.celyavox.dev');
  console.log('   - Artifacts: celyavox-dev-*');
  console.log('   - Server: https://freepbx17-dev.celya.fr/celyavox');
} else {
  packageJson.build.productName = 'CelyaVox';  // Dossier userData
  packageJson.build.appId = 'fr.celya.celyavox';
  packageJson.build.linux.desktop.Name = 'CelyaVox';
  
  // Nom standard pour prod
  if (packageJson.build.deb?.artifactName) delete packageJson.build.deb.artifactName;
  packageJson.build.deb = packageJson.build.deb || {};
  packageJson.build.deb.packageName = 'celyavox';  // Paquet Linux en minuscules
  
  if (packageJson.build.rpm?.artifactName) delete packageJson.build.rpm.artifactName;
  packageJson.build.rpm = packageJson.build.rpm || {};
  packageJson.build.rpm.packageName = 'celyavox';  // RPM en minuscules
  
  packageJson.build.deb.maintainer = `${packageJson.author.name} <${packageJson.author.email}>`;
  
  // Définir l'environnement par défaut pour l'exécutable
  packageJson.config.environment = 'prod';
  
  console.log('✅ Mode PROD configuré');
  console.log('   - Product Name: CelyaVox');
  console.log('   - App ID: fr.celya.celyavox');
  console.log('   - Artifacts: celyavox-*');
  console.log('   - Server: https://celyavox.celya.fr/phone');
}

// Sauvegarder le package.json modifié
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// ============================================================
// Créer config.ini s'il n'existe pas
// ============================================================
const resourcesDir = path.join(__dirname, '..', 'resources');
const configIniPath = path.join(resourcesDir, 'config.ini');
if (!fs.existsSync(configIniPath)) {
  // Créer le dossier resources s'il n'existe pas
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
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
