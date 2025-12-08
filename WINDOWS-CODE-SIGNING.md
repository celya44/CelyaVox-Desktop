# Signature de code pour Windows

## Pourquoi l'exécutable est marqué comme dangereux ?

Windows SmartScreen et les antivirus marquent les exécutables non signés comme potentiellement dangereux, surtout s'ils ne sont pas couramment téléchargés.

## Solutions

### 1. Signature de code (Solution recommandée)

Pour signer votre exécutable, vous avez besoin d'un **certificat de signature de code** :

#### Obtenir un certificat :
- **Fournisseurs recommandés :**
  - DigiCert (~300-400€/an)
  - Sectigo/Comodo (~150-300€/an)
  - GlobalSign (~200-350€/an)

- **Certificats EV (Extended Validation)** : Plus chers mais évitent immédiatement le SmartScreen (~400-600€/an)

#### Configurer la signature dans electron-builder :

```json
"win": {
  "icon": "assets/icon.ico",
  "publisherName": "CELYA",
  "certificateFile": "chemin/vers/certificat.pfx",
  "certificatePassword": "MOT_DE_PASSE",
  "signingHashAlgorithms": ["sha256"],
  "target": [...]
}
```

**Important :** Ne jamais commiter le certificat et le mot de passe dans git !

Utilisez plutôt des variables d'environnement :
```bash
export CSC_LINK=/chemin/vers/certificat.pfx
export CSC_KEY_PASSWORD=votre_mot_de_passe
npm run dist:win
```

### 2. Alternatives temporaires (moins efficaces)

#### A. Construire une réputation
- Plus votre fichier est téléchargé sans problème, moins il sera marqué
- Peut prendre plusieurs semaines/mois

#### B. Soumettre à Microsoft SmartScreen
- https://www.microsoft.com/en-us/wdsi/filesubmission
- Soumettre l'exécutable pour analyse

#### C. Documentation utilisateur
Créez une page d'instructions pour vos utilisateurs :
- Expliquer que c'est normal pour un nouveau logiciel
- Montrer comment contourner l'avertissement :
  1. Clic droit > Propriétés > Débloquer
  2. Ou cliquer sur "Plus d'infos" > "Exécuter quand même"

### 3. Alternative : Installeur NSIS

Au lieu du portable, utilisez un installeur NSIS (peut être partiellement signé) :

```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ]
},
"nsis": {
  "oneClick": false,
  "perMachine": false,
  "allowElevation": true,
  "createDesktopShortcut": true,
  "artifactName": "${productName}-${version}-setup.${ext}"
}
```

## Recommandation pour CELYA

Pour une entreprise, **la signature de code est indispensable** :
1. Investir dans un certificat de signature de code
2. Utiliser un certificat EV pour éviter immédiatement SmartScreen
3. Configurer un pipeline CI/CD sécurisé pour la signature
4. Stocker le certificat dans un coffre-fort sécurisé (Azure Key Vault, AWS KMS, etc.)

**Coût estimé :** 
- Certificat standard : ~200-300€/an
- Certificat EV : ~400-600€/an
- HSM/Token USB (pour EV) : ~50-100€

**ROI :** Confiance des utilisateurs, image professionnelle, moins de support pour les problèmes de téléchargement.
