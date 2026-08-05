#!/bin/bash
# postinstall.sh - Script post-installation pour le .deb

## postinstall: create a small wrapper that execs the real binary with flags
## Support both packages so dev and prod can co-exist: CelyaVox and CelyaVox-dev

# Déterminer si c'est une installation dev ou prod
PACKAGE_NAME="${DEB_PACKAGE_NAME:-celyavox}"  # Défaut: prod
IS_DEV=false
if [[ "$PACKAGE_NAME" == *"dev"* ]] || [[ "$0" == *"dev"* ]]; then
    IS_DEV=true
fi

# Déterminer les chemins
if [ "$IS_DEV" = true ]; then
    CONFIG_DIR="$HOME/.config/CelyaVox-dev"
    BINARY_NAME="celyavox-dev"
else
    CONFIG_DIR="$HOME/.config/CelyaVox"
    BINARY_NAME="celyavox"
fi

echo "🔧 [postinstall] Configuration pour: $BINARY_NAME"
echo "📁 [postinstall] Répertoire utilisateur: $CONFIG_DIR"

# Créer le répertoire de configuration s'il n'existe pas
if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    echo "📁 [postinstall] Répertoire créé: $CONFIG_DIR"
else
    echo "ℹ️  [postinstall] Répertoire existe déjà: $CONFIG_DIR"
fi

# Chercher les fichiers de sample dans le répertoire d'installation
INSTALL_DIR=""
for d in /opt/*; do
    [ -d "$d" ] || continue
    base=$(basename "$d")
    lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    if [[ "$lower" == *"$BINARY_NAME"* ]] || [[ "$lower" == *"celyavox"* ]]; then
        INSTALL_DIR="$d"
        break
    fi
done

if [ -n "$INSTALL_DIR" ]; then
    echo "📦 [postinstall] Répertoire d'installation trouvé: $INSTALL_DIR"
    
    # Copier config.ini.example s'il n'existe pas
    if [ -f "$INSTALL_DIR/config.ini.example" ] && [ ! -f "$CONFIG_DIR/config.ini" ]; then
        cp "$INSTALL_DIR/config.ini.example" "$CONFIG_DIR/config.ini"
        echo "✅ [postinstall] config.ini copié depuis example"
    fi
    
    # Copier sso.ini.example s'il n'existe pas
    if [ -f "$INSTALL_DIR/sso.ini.example" ] && [ ! -f "$CONFIG_DIR/sso.ini" ]; then
        cp "$INSTALL_DIR/sso.ini.example" "$CONFIG_DIR/sso.ini"
        echo "✅ [postinstall] sso.ini copié depuis example"
    fi
else
    echo "⚠️  [postinstall] Répertoire d'installation non trouvé"
fi

# Names of executables we expect to expose inside each installation dir
NAMES=("celyavox" "celyavox-dev")

for NAME in "${NAMES[@]}"; do
    TARGET_DIR=""
    for d in /opt/*; do
        [ -d "$d" ] || continue
        base=$(basename "$d")
        lower=$(echo "$base" | tr '[:upper:]' '[:lower:]')
        if [[ "$lower" == *"$NAME"* ]]; then
            TARGET_DIR="$d"
            break
        fi
    done

    # If we found a matching dir, create wrapper there
    if [ -n "$TARGET_DIR" ]; then
        TARGET_BIN="$TARGET_DIR/$NAME"
        TARGET_BIN_REAL="$TARGET_DIR/$NAME.bin"

        mkdir -p "$TARGET_DIR"

        if [ -f "$TARGET_BIN" ] && [ ! -f "$TARGET_BIN_REAL" ]; then
            mv "$TARGET_BIN" "$TARGET_BIN_REAL" || true
        fi

        cat > "$TARGET_BIN" << EOF
#!/bin/bash
exec "$TARGET_BIN_REAL" --no-sandbox --disable-dev-shm-usage "\$@"
EOF

        if [ -f "$TARGET_BIN" ]; then
            chmod +x "$TARGET_BIN" || true
        fi
    fi
done
