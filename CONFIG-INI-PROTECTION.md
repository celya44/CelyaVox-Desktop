# Configuration INI - Protection contre l'écrasement

## 🎯 Système implémenté

Le fichier `config.ini` est maintenant **protégé contre l'écrasement** lors des mises à jour. Voici comment:

## 📁 Localisation des fichiers

### Développement
- **Emplacement:** `/opt/CelyaVox-Desktop/config.ini` (à la racine du projet)
- **Lecture:** Depuis la racine du projet

### Production
- **Bundle app:** `config.ini` empaqueté avec l'exécutable (via electron-builder)
- **Utilisateur:** `~/.config/CelyaVox/config.ini` (Linux)
  - `~/Library/Application Support/CelyaVox/config.ini` (macOS)
  - `%APPDATA%\CelyaVox\config.ini` (Windows)

## 🔄 Flux au démarrage

```
1. main.js démarre
   ↓
2. initializeConfigFile() exécutée
   ├─ Détermine le chemin userData selon l'environnement
   ├─ Crée le répertoire s'il n'existe pas
   ├─ SI config.ini n'existe PAS dans userData:
   │  └─ COPIE depuis le bundle app
   └─ SI config.ini EXISTE dans userData:
      └─ L'utilise (JAMAIS écrasé)
   ↓
3. Chemin passé via process.env.CELYAVOX_USER_CONFIG_PATH
   ↓
4. config.js charge depuis process.env (userData en priorité)
   ↓
5. Configuration disponible pour l'app
```

## 🛡️ Protection contre l'écrasement

### Lors d'une mise à jour
1. L'utilisateur installe la nouvelle version
2. electron-builder installe les fichiers du bundle (y compris `config.ini`)
3. **MAIS** le fichier du userData n'est **JAMAIS** touché
4. L'app continue d'utiliser le fichier de l'utilisateur

### Priorité de chargement
```javascript
1. userData/config.ini (JAMAIS écrasé) ✅ PRIORITÉ MAXIMALE
2. ./config.ini en dev (pour développement)
3. Bundle app/config.ini (fallback, ne s'utilise que pour la première copie)
```

## 📋 Fichiers modifiés

### config.js
- Recherche d'abord dans `process.env.CELYAVOX_USER_CONFIG_PATH`
- Fallback sur chemins de développement et bundle
- Fusionne les valeurs avec les defaults

### main.js
- **Nouvelle fonction `initializeConfigFile()`** qui:
  - Détermine le chemin userData
  - Crée le répertoire si besoin
  - Copie le fichier depuis le bundle si c'est la première exécution
  - Passe le chemin via `process.env.CELYAVOX_USER_CONFIG_PATH`
- Appelée deux fois:
  - Au top-level avant de charger config.js
  - Dans `app.whenReady()` pour confirmer

## 💾 Cycle de vie du fichier

```
PREMIÈRE INSTALLATION
  ↓
Bundle app contient config.ini
  ↓
main.js détecte que userData/config.ini n'existe pas
  ↓
COPIE de bundle/config.ini → userData/config.ini
  ↓
L'utilisateur peut éditer userData/config.ini
  ↓
  
MISE À JOUR (nouvelle version)
  ↓
Nouveau bundle app avec config.ini (éventuellement mis à jour)
  ↓
main.js détecte que userData/config.ini EXISTE
  ↓
✅ NE COPIE PAS - utilise le fichier existant
  ↓
Configuration de l'utilisateur PRÉSERVÉE ✅
```

## 🔍 Logs de débogage

Au démarrage, vous verrez:
```
✅ Configuration INI chargée depuis: /home/user/.config/CelyaVox/config.ini
```

Ou lors de la première exécution:
```
📋 Fichier config.ini copié vers: /home/user/.config/CelyaVox/config.ini
```

## 🧪 Test

### Développement
```bash
npm start:dev
# Vérifier que config.ini est lu depuis la racine du projet
```

### Simuler une mise à jour
1. Modifier `config.ini` (ajouter une clé personnalisée)
2. Éditer le fichier dans userData
3. Simuler une réinstallation
4. Vérifier que le fichier userData est préservé

## 📦 Déploiement

### Linux (DEB, RPM, AppImage)
- Premier install: `config.ini` copié vers `~/.config/CelyaVox/config.ini`
- Mise à jour: Fichier utilisateur préservé ✅

### Windows (MSI, Portable)
- Premier install: `config.ini` copié vers `%APPDATA%\CelyaVox\config.ini`
- Mise à jour: Fichier utilisateur préservé ✅

### macOS (DMG, ZIP)
- Premier install: `config.ini` copié vers `~/Library/Application Support/CelyaVox/config.ini`
- Mise à jour: Fichier utilisateur préservé ✅

## ✅ Garanties

- ✅ **Première exécution:** config.ini copié depuis le bundle
- ✅ **Modifications utilisateur:** Préservées entre les versions
- ✅ **Mises à jour:** Ne touchent jamais le fichier utilisateur
- ✅ **Multiplateforme:** Fonctionne identiquement sur Windows/Mac/Linux
- ✅ **Fallback:** Si le bundle n'a pas le fichier, utilise les defaults de config.js
