# Icônes multi-tailles et par OS (Electron Builder)

Ce guide explique comment fournir des icônes adaptées pour Linux, Windows et macOS, et comment configurer `package.json`.

## 1) Où placer les fichiers

- Dossier des ressources de build: `assets/` (déjà configuré via `build.directories.buildResources`)
- Recommandé:
  - Linux: `assets/icons/` (un dossier contenant plusieurs PNG de tailles standard)
  - Windows: `assets/icon.ico` (fichier .ico multi-tailles)
  - macOS: `assets/icon.icns` (fichier .icns)
  - Optionnel commun: `assets/icon.png` (une grande image source ≥ 512x512 ou 1024x1024)

## 2) Tailles recommandées

- Linux (PNG dans un dossier): 16, 24, 32, 48, 64, 128, 256, 512 px
  - Nommage conseillé: `16x16.png`, `24x24.png`, ..., `512x512.png`
- Windows (.ico): inclure au moins 16, 32, 48, 64, 128, 256 px dans le .ico
- macOS (.icns): source ≥ 512x512 (idéal 1024x1024) pour une bonne qualité Retina

## 3) Génération automatique depuis un PNG

Si vous avez une image source (par ex. `app/Phone/avatars/logo.png`) de grande taille (≥ 512x512), vous pouvez générer `ico` et `icns` automatiquement.

Option 1: via `icon-gen` (cross-platform)

```bash
# Installer en dev (une seule fois)
npm i -D icon-gen

# Générer les formats depuis un PNG (idéalement 1024x1024)
# -i: input PNG, -o: dossier de sortie
npx icon-gen -i assets/icon.png -o assets --ico --icns
```

Option 2: générer seulement Windows (ICO)

```bash
npm i -D png-to-ico
# Exemple Node script (scripts/generate-ico.mjs) puis: node scripts/generate-ico.mjs
```

Option 3: générer les PNG Linux multi-tailles

```bash
# Exemple avec ImageMagick (convert)
# Placez votre source haute résolution en assets/icon.png
mkdir -p assets/icons
for s in 16 24 32 48 64 128 256 512; do 
  convert assets/icon.png -resize ${s}x${s} assets/icons/${s}x${s}.png
done
```

## 4) Configuration package.json (exemples)

Dans `package.json > build`:

- Linux (dossier d'icônes PNG):
```json
{
  "build": {
    "linux": {
      "icon": "assets/icons"
    }
  }
}
```

- Windows (.ico):
```json
{
  "build": {
    "win": {
      "icon": "assets/icon.ico"
    }
  }
}
```

- macOS (.icns):
```json
{
  "build": {
    "mac": {
      "icon": "assets/icon.icns"
    }
  }
}
```

Note: Si vous fournissez uniquement `assets/icon.png` (très haute résolution), Electron Builder peut générer `icns`/`ico` automatiquement dans de nombreux cas, mais il est plus robuste de fournir explicitement `icon.icns`/`icon.ico` et un dossier PNG pour Linux.

## 5) Icône de Tray (barre système)

Dans le code (`main.js`), vous pouvez redimensionner l’icône du Tray selon l’OS pour éviter un rendu énorme ou tronqué (déjà fait):
- Linux: ~24px
- Windows: ~16px
- macOS: ~18px (template monochrome)

Si vous ciblez des écrans HiDPI, vous pouvez adapter dynamiquement la taille avec le `scaleFactor` (Ex: 16 * 1.25, 16 * 2, etc.).

## 6) Conseils

- Préférez une source vectorielle ou un PNG 1024x1024 propre.
- Vérifiez le rendu réel sous chaque OS (menus, dock, explorateur, app launcher).
- Pour Linux, fournir plusieurs PNG évite les flous et upscale approximatifs.

