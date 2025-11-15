#!/bin/bash
# postinstall.sh - Script post-installation pour le .deb

# Sauvegarder l'exécutable original
if [ -f /opt/SipApp-dev/sipapp-dev ] && [ ! -f /opt/SipApp-dev/sipapp-dev.bin ]; then
    mv /opt/SipApp-dev/sipapp-dev /opt/SipApp-dev/sipapp-dev.bin
fi

# Créer le wrapper
cat > /opt/SipApp-dev/sipapp-dev << 'EOF'
#!/bin/bash
exec "/opt/SipApp-dev/sipapp-dev.bin" --no-sandbox --disable-dev-shm-usage "$@"
EOF

chmod +x /opt/SipApp-dev/sipapp-dev
