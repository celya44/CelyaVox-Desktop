#!/bin/bash
# postinstall.sh - Script post-installation pour le .deb

# Sauvegarder l'exécutable original
if [ -f /opt/CelyaVox-dev/celyavox-dev ] && [ ! -f /opt/CelyaVox-dev/celyavox-dev.bin ]; then
    mv /opt/CelyaVox-dev/celyavox-dev /opt/CelyaVox-dev/celyavox-dev.bin
fi

# Créer le wrapper
cat > /opt/CelyaVox-dev/celyavox-dev << 'EOF'
#!/bin/bash
exec "/opt/CelyaVox-dev/celyavox-dev.bin" --no-sandbox --disable-dev-shm-usage "$@"
EOF

chmod +x /opt/CelyaVox-dev/celyavox-dev
