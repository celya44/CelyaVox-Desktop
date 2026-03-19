'use strict';
/**
 * Hook afterAllArtifactBuild pour electron-builder.
 * Notarise et staple chaque fichier .dmg produit par le build macOS.
 *
 * @electron/notarize's notarize() soumet le fichier à Apple, attend l'approbation,
 * puis staple automatiquement le ticket dans le fichier.
 */

const { notarize } = require('@electron/notarize');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

function normalizeSecret(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().replace(/\r/g, '');
}

exports.default = async function notarizeDmgArtifacts(buildResult) {
  if (process.platform !== 'darwin') return;

  const dmgs = (buildResult.artifactPaths || []).filter(p => p.endsWith('.dmg'));
  if (dmgs.length === 0) {
    console.log('[notarize-dmg] No DMG artifacts to notarize.');
    return;
  }

  // --- Identifiants : API Key (prioritaire) ---
  const apiKeyContent = normalizeSecret(process.env.NOTARIZE_API_KEY_CONTENT);
  const apiKeyId      = normalizeSecret(process.env.NOTARIZE_API_KEY_ID);
  const apiIssuer     = normalizeSecret(process.env.NOTARIZE_API_ISSUER);
  const useApiKey     = !!(apiKeyContent && apiKeyId && apiIssuer);

  // --- Identifiants : Apple ID (fallback) ---
  const appleId         = normalizeSecret(process.env.NOTARIZE_APPLE_ID || process.env.APPLE_ID);
  const appleIdPassword = normalizeSecret(
    process.env.NOTARIZE_APPLE_ID_PASSWORD || process.env.APPLE_ID_PASSWORD || process.env.APPLE_APP_SPECIFIC_PASSWORD
  );
  const appleTeamId = normalizeSecret(process.env.NOTARIZE_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID);

  if (!useApiKey && (!appleId || !appleIdPassword || !appleTeamId)) {
    console.log('[notarize-dmg] Skipping DMG notarization: no credentials configured.');
    return;
  }

  let tempKeyPath = null;

  try {
    let baseOptions;

    if (useApiKey) {
      tempKeyPath = path.join(os.tmpdir(), `AuthKey_${apiKeyId}_dmgbuild.p8`);
      fs.writeFileSync(tempKeyPath, apiKeyContent, { mode: 0o600 });
      baseOptions = { appleApiKey: tempKeyPath, appleApiKeyId: apiKeyId, appleApiIssuer: apiIssuer };
      console.log(`[notarize-dmg] Auth: App Store Connect API Key (${apiKeyId})`);
    } else {
      baseOptions = { appleId, appleIdPassword, teamId: appleTeamId };
      console.log('[notarize-dmg] Auth: Apple ID');
    }

    for (const dmgPath of dmgs) {
      const name = path.basename(dmgPath);
      console.log(`[notarize-dmg] Notarizing + stapling: ${name}`);
      await notarize({ ...baseOptions, appPath: dmgPath });
      console.log(`[notarize-dmg] Done: ${name}`);
    }

  } finally {
    if (tempKeyPath) {
      try { fs.unlinkSync(tempKeyPath); } catch (_) {}
    }
  }
};
