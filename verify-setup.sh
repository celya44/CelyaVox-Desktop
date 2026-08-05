#!/bin/bash
# Script de vérification de la configuration de CelyaVox

set -e

APP_ENV="${1:-dev}"
APP_NAME="CelyaVox"
if [ "$APP_ENV" = "dev" ]; then
    APP_NAME="CelyaVox-dev"
fi

USER_DATA_DIR="$HOME/.config/$APP_NAME"
CONFIG_FILE="$USER_DATA_DIR/config.ini"
SSO_FILE="$USER_DATA_DIR/sso.ini"

echo "🔍 Vérification de la configuration de $APP_NAME..."
echo ""

# Vérifier le répertoire userData
if [ -d "$USER_DATA_DIR" ]; then
    echo "✅ Répertoire userData existe: $USER_DATA_DIR"
else
    echo "❌ Répertoire userData n'existe pas: $USER_DATA_DIR"
    exit 1
fi

# Vérifier config.ini
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Fichier config.ini existe"
    echo "   Taille: $(wc -c < "$CONFIG_FILE") bytes"
    # Afficher les 5 premières lignes
    echo "   Premier aperçu:"
    head -5 "$CONFIG_FILE" | sed 's/^/      /'
else
    echo "❌ Fichier config.ini n'existe pas"
    exit 1
fi

# Vérifier sso.ini
if [ -f "$SSO_FILE" ]; then
    echo "✅ Fichier sso.ini existe"
    echo "   Taille: $(wc -c < "$SSO_FILE") bytes"
    # Afficher les 5 premières lignes
    echo "   Premier aperçu:"
    head -5 "$SSO_FILE" | sed 's/^/      /'
else
    echo "❌ Fichier sso.ini n'existe pas"
    exit 1
fi

echo ""
echo "🎉 Tous les fichiers de configuration sont prêts!"
echo ""
echo "Pour lancer CelyaVox:"
if [ "$APP_ENV" = "dev" ]; then
    echo "  npm run dev"
else
    echo "  celyavox"
fi
