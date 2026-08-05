#!/bin/bash
# postinstall.sh - Script post-installation pour le .deb

## postinstall: create a small wrapper that execs the real binary with flags
## Support both packages so dev and prod can co-exist: CelyaVox and CelyaVox-dev

# NOTE: Ce script s'exécute en tant que root, donc $HOME = /root
# Les fichiers de configuration utilisateur seront créés par l'application 
# au premier lancement, pas par le paquet d'installation

echo "✅ [postinstall] Installation de CelyaVox réussie"
echo ""

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
