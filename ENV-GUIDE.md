# Guide d'utilisation - Environnements Dev/Prod

## Configuration

L'application CelyaVox supporte deux environnements :

### **Développement (dev)**
- Nom de l'application : `CelyaVox Dev`
- Nom du produit : `celyavox-dev`
- URL du serveur : `https://freepbx17-dev.celya.fr/sipapp`
- App ID : `fr.celya.celyavox.dev`

### **Production (prod)**
- Nom de l'application : `CelyaVox`
- Nom du produit : `celyavox`
- URL du serveur : `https://celyavox.celya.fr/phone`
- App ID : `fr.celya.celyavox`

## Utilisation

### Démarrer l'application en mode développement
```bash
npm run start:dev
```

### Démarrer l'application en mode production
```bash
npm run start:prod
```

### Construire pour Linux

**Mode développement :**
```bash
npm run dist:linux:dev
```
Génère : `celyavox-dev-1.0.3.AppImage`, `celyavox-dev_1.0.3_amd64.deb`, etc.

**Mode production :**
```bash
npm run dist:linux:prod
```
Génère : `celyavox-1.0.3.AppImage`, `celyavox_1.0.3_amd64.deb`, etc.

### Construire pour Windows

**Mode développement :**
```bash
npm run dist:win:dev
```
Génère : `celyavox-dev-1.0.3.exe`

**Mode production :**
```bash
npm run dist:win:prod
```
Génère : `celyavox-1.0.3.exe`

### Construire pour toutes les plateformes

**Mode développement :**
```bash
npm run dist:all:dev
```

**Mode production :**
```bash
npm run dist:all:prod
```

## Modifier l'environnement par défaut

Éditez `package.json` :
```json
"config": {
  "environment": "dev"  // ou "prod"
}
```

## Fichiers de configuration

- **`config.js`** : Contient la configuration pour chaque environnement
- **`scripts/prebuild.js`** : Script qui modifie le package.json avant le build
- **`package.json`** : Scripts npm et configuration de build

## Vérifier l'environnement au démarrage

Au lancement de l'application, vous verrez dans la console :
```
🚀 Démarrage de l'application en mode: dev
📡 URL du serveur: https://freepbx17-dev.celya.fr/sipapp
📦 Nom de l'application: CelyaVox Dev
```

## Installation côte à côte

Les versions dev et prod peuvent être installées simultanément sur le même système car elles ont des App IDs différents :
- Dev : `fr.celya.celyavox.dev`
- Prod : `fr.celya.celyavox`
