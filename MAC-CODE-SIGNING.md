# Guide de Signature et Notarisation macOS

## 📋 Étapes à suivre

### 1. Inscription Apple Developer
- Allez sur https://developer.apple.com
- Coût : 99 USD/an
- Nécessaire pour obtenir les certificats

### 2. Création des Certificats

#### A. Developer ID Application Certificate
1. Ouvrez **Trousseau d'accès** (Keychain Access) sur macOS
2. Menu : **Trousseau d'accès > Assistant de certificat > Demander un certificat à une autorité de certification**
3. Remplissez :
   - Adresse email : votre email Apple Developer
   - Nom commun : votre nom ou nom d'entreprise
   - Sélectionnez "Enregistré sur le disque"
   - Cliquez sur "Continuer"
4. Sauvegardez le fichier `.certSigningRequest`
5. Allez sur https://developer.apple.com/account/resources/certificates/list
6. Cliquez sur "+" pour créer un nouveau certificat
7. Sélectionnez **"Developer ID Application"**
8. Uploadez le fichier `.certSigningRequest`
9. Téléchargez le certificat `.cer`
10. Double-cliquez sur le `.cer` pour l'installer dans votre trousseau

#### B. Vérification du certificat
Ouvrez le Terminal et exécutez :
```bash
security find-identity -v -p codesigning
```

Vous devriez voir une ligne comme :
```
1) ABC1234DEF "Developer ID Application: Votre Nom (ABC1234DEF)"
```

### 3. App-Specific Password

1. Allez sur https://appleid.apple.com
2. Section **"Connexion et sécurité"** > **"Mots de passe d'app"**
3. Cliquez sur **"Générer un mot de passe d'app"**
4. Donnez-lui un nom (ex: "CelyaVox Notarization")
5. **Copiez le mot de passe généré** (format: xxxx-xxxx-xxxx-xxxx)
6. Sauvegardez-le précieusement

### 4. Récupération du Team ID

1. Allez sur https://developer.apple.com/account
2. Section **"Membership details"**
3. Notez votre **Team ID** (10 caractères, ex: ABC1234DEF)

## 🔧 Configuration Locale (Build sur Mac)

### Installation des dépendances
```bash
npm install
```

### Création du fichier .env
Copiez `.env.example` en `.env` et remplissez :

```bash
cp .env.example .env
```

Éditez `.env` avec vos valeurs :
```bash
# Optionnel si le certificat est dans le trousseau macOS
# CSC_LINK=/path/to/certificate.p12
# CSC_KEY_PASSWORD=your_password

# Pour la notarisation (obligatoire)
APPLE_ID=your_apple_id@example.com
APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=ABC1234DEF
```

### Build signé localement
```bash
# Charger les variables d'environnement
source .env

# Build
npm run dist:mac:prod
```

## ☁️ Configuration GitHub Actions

### Exportation du certificat pour CI/CD

1. Ouvrez **Trousseau d'accès**
2. Trouvez votre certificat "Developer ID Application"
3. Sélectionnez **à la fois le certificat ET sa clé privée**
4. Clic droit > **Exporter 2 éléments...**
5. Format : **Personal Information Exchange (.p12)**
6. Choisissez un mot de passe fort
7. Sauvegardez le fichier

### Conversion du certificat en Base64
```bash
base64 -i certificate.p12 | pbcopy
```
Le certificat encodé est maintenant dans votre presse-papier.

### Configuration des Secrets GitHub

Allez dans votre repo GitHub : **Settings > Secrets and variables > Actions**

Ajoutez ces secrets :

| Secret Name | Valeur | Description |
|-------------|--------|-------------|
| `MAC_CERTIFICATE` | [base64 du .p12] | Certificat encodé en base64 |
| `MAC_CERTIFICATE_PASSWORD` | [mot de passe] | Mot de passe du certificat .p12 |
| `APPLE_ID` | your@email.com | Votre Apple ID |
| `APPLE_ID_PASSWORD` | xxxx-xxxx-xxxx-xxxx | App-specific password |
| `APPLE_TEAM_ID` | ABC1234DEF | Votre Team ID |

### Activation de la signature dans GitHub Actions

Le fichier `.github/workflows/build.yml` est déjà configuré. Décommentez ces lignes :

```yaml
- name: Build for macOS
  if: matrix.platform == 'mac'
  run: npm run dist:mac:prod
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
    CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

## 🧪 Test de la signature

Après le build, vérifiez la signature :

```bash
codesign -dv --verbose=4 dist/mac/celyavox.app
```

Vérifiez la notarisation :
```bash
spctl -a -vvv -t install dist/mac/celyavox.app
```

Résultat attendu : `accepted`

## ⚠️ Dépannage

### "Application cassée" après ouverture du DMG
- Certificat non installé ou expiré
- Build non signé
- Notarisation échouée

### Vérifier les certificats installés
```bash
security find-identity -v -p codesigning
```

### Vérifier les logs de notarisation
```bash
xcrun notarytool log <submission-id> --apple-id your@email.com --team-id ABC1234DEF
```

### Build sans signature (développement seulement)
Commentez la ligne `"afterSign"` dans `package.json` :
```json
// "afterSign": "scripts/notarize.js",
```

## 📚 Ressources

- [Apple Developer Portal](https://developer.apple.com)
- [Electron Builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
