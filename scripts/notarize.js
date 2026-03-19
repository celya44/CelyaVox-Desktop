const { notarize } = require('@electron/notarize');
const { build } = require('../package.json');
const { spawnSync } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeSecret(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim().replace(/\r/g, '');
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function setGithubEnv(key, value) {
  const githubEnvPath = process.env.GITHUB_ENV;
  if (!githubEnvPath) {
    return;
  }

  const fs = require('node:fs');
  fs.appendFileSync(githubEnvPath, `${key}=${value}\n`);
}

function isTransientNotaryError(error) {
  if (!error) {
    return false;
  }
  const message = String(error.message || error);
  return (
    message.includes('statusCode: 500') ||
    message.includes('UNEXPECTED_ERROR') ||
    message.includes('Please try again at a later time')
  );
}

/**
 * Preflight avec Apple ID + app-specific password.
 * Le mot de passe est passé via @env: pour éviter son exposition.
 */
function verifyNotaryCredentials(appleId, appleIdPassword, appleTeamId) {
  const env = { ...process.env, _NOTARIZE_CHK_PWD: appleIdPassword };
  const result = spawnSync(
    'xcrun',
    [
      'notarytool', 'history',
      '--apple-id', appleId,
      '--password', '@env:_NOTARIZE_CHK_PWD',
      '--team-id', appleTeamId,
      '--output-format', 'json',
    ],
    { encoding: 'utf8', timeout: 30000, env }
  );
  if (result.status === 0) return { ok: true };
  return { ok: false, detail: (result.stderr || result.stdout || '').trim() };
}

/**
 * Preflight avec App Store Connect API Key.
 */
function verifyNotaryCredentialsApiKey(keyPath, keyId, issuer) {
  const result = spawnSync(
    'xcrun',
    [
      'notarytool', 'history',
      '--key', keyPath,
      '--key-id', keyId,
      '--issuer', issuer,
      '--output-format', 'json',
    ],
    { encoding: 'utf8', timeout: 30000 }
  );
  if (result.status === 0) return { ok: true };
  return { ok: false, detail: (result.stderr || result.stdout || '').trim() };
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  // --- Méthode 1: App Store Connect API Key (prioritaire, ne dépend pas de 2FA) ---
  const apiKeyContent = normalizeSecret(process.env.APPLE_API_KEY_CONTENT);
  const apiKeyId     = normalizeSecret(process.env.APPLE_API_KEY_ID);
  const apiIssuer    = normalizeSecret(process.env.APPLE_API_ISSUER);
  const useApiKey    = !!(apiKeyContent && apiKeyId && apiIssuer);

  // --- Méthode 2: Apple ID + app-specific password (fallback) ---
  const appleId = normalizeSecret(process.env.NOTARIZE_APPLE_ID || process.env.APPLE_ID);
  const appleIdPassword = normalizeSecret(
    process.env.NOTARIZE_APPLE_ID_PASSWORD || process.env.APPLE_ID_PASSWORD || process.env.APPLE_APP_SPECIFIC_PASSWORD
  );
  const appleTeamId = normalizeSecret(process.env.NOTARIZE_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID);

  if (!useApiKey && (!appleId || !appleIdPassword || !appleTeamId)) {
    console.log('Skipping notarization: no credentials configured.');
    console.log('  Set APPLE_API_KEY_CONTENT + APPLE_API_KEY_ID + APPLE_API_ISSUER (recommended)');
    console.log('  or APPLE_ID + APPLE_ID_PASSWORD + APPLE_TEAM_ID');
    setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '0');
    setGithubEnv('NOTARIZATION_STATUS', 'skipped');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const fs   = require('node:fs');
  const os   = require('node:os');
  const path = require('node:path');

  let notarizeOptions;
  let tempKeyPath = null;

  if (useApiKey) {
    console.log(`Notarizing ${appPath}`);
    console.log(`  Auth     : App Store Connect API Key`);
    console.log(`  Key ID   : ${apiKeyId}`);
    console.log(`  Issuer   : ${apiIssuer.slice(0, 8)}...`);
    console.log(`  Bundle ID: ${build.appId}`);

    // Écrire le contenu .p8 dans un fichier temporaire sécurisé
    tempKeyPath = path.join(os.tmpdir(), `AuthKey_${apiKeyId}.p8`);
    fs.writeFileSync(tempKeyPath, apiKeyContent, { mode: 0o600 });

    console.log('Checking API key credentials via notarytool history...');
    const credCheck = verifyNotaryCredentialsApiKey(tempKeyPath, apiKeyId, apiIssuer);
    if (!credCheck.ok) {
      fs.unlinkSync(tempKeyPath);
      tempKeyPath = null;
      console.error(
        'API Key credential check FAILED.\n' +
        'Verify secrets: APPLE_API_KEY_CONTENT, APPLE_API_KEY_ID, APPLE_API_ISSUER.\n' +
        (credCheck.detail ? `\nnotarytool output:\n${credCheck.detail}` : '')
      );
      setGithubEnv('NOTARIZATION_STATUS', 'credential-error');
      setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '0');
      throw new Error('Notarization API key credential check failed — fix credentials and retry.');
    }
    console.log('API Key credentials check passed.');

    notarizeOptions = { appPath, appleApiKey: tempKeyPath, appleApiKeyId: apiKeyId, appleApiIssuer: apiIssuer };

  } else {
    const atIdx = appleId.indexOf('@');
    const maskedId = atIdx > 0
      ? `${appleId.slice(0, Math.min(3, atIdx))}***${appleId.slice(atIdx)}`
      : (appleId.length > 3 ? `${appleId.slice(0, 3)}***` : '***');
    const maskedTeam = appleTeamId.length > 4 ? `***${appleTeamId.slice(-4)}` : '***';

    console.log(`Notarizing ${appPath}`);
    console.log(`  Auth     : Apple ID + app-specific password`);
    console.log(`  Apple ID : ${maskedId}`);
    console.log(`  Team ID  : ${maskedTeam}`);
    console.log(`  Bundle ID: ${build.appId}`);

    console.log('Checking credentials via notarytool history...');
    const credCheck = verifyNotaryCredentials(appleId, appleIdPassword, appleTeamId);
    if (!credCheck.ok) {
      console.error(
        'Notarization credential check FAILED. The build cannot be notarized.\n' +
        'Likely causes:\n' +
        '  1. App-specific password expired/revoked → regenerate at https://appleid.apple.com\n' +
        '  2. Apple Developer Agreement updated → accept at https://developer.apple.com\n' +
        '  3. Wrong Team ID in NOTARIZE_APPLE_TEAM_ID secret\n' +
        '  4. Account subscription expired\n' +
        (credCheck.detail ? `\nnotarytool output:\n${credCheck.detail}` : '')
      );
      setGithubEnv('NOTARIZATION_STATUS', 'credential-error');
      setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '0');
      throw new Error('Notarization credential check failed — fix credentials and retry.');
    }
    console.log('Credentials check passed.');

    notarizeOptions = { appPath, appleId, appleIdPassword, teamId: appleTeamId };
  }

  const maxAttempts         = parsePositiveInt(process.env.NOTARIZE_MAX_ATTEMPTS, 1);
  const baseDelayMs         = parsePositiveInt(process.env.NOTARIZE_RETRY_BASE_MS, 15000);
  const maxDelayMs          = parsePositiveInt(process.env.NOTARIZE_RETRY_MAX_MS, 180000);
  const allowTransientFailure = parseBoolean(process.env.NOTARIZE_ALLOW_TRANSIENT_FAILURE, false);

  try {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`Notarization attempt ${attempt}/${maxAttempts}`);
    try {
      await notarize(notarizeOptions);
      console.log('Notarization completed successfully');
      setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '0');
      setGithubEnv('NOTARIZATION_STATUS', 'ok');
      return;
    } catch (error) {
      const transient = isTransientNotaryError(error);
      const isLastAttempt = attempt === maxAttempts;

      if (!transient || isLastAttempt) {
        if (transient && isLastAttempt) {
          console.error(
            `Notarization failed after ${maxAttempts} attempts due to Apple transient server errors (HTTP 500). Re-run the workflow later.`
          );

          if (allowTransientFailure) {
            console.warn('Continuing build because NOTARIZE_ALLOW_TRANSIENT_FAILURE is enabled.');
            console.warn('(Credentials were verified OK — this is a real Apple server outage)');
            setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '1');
            setGithubEnv('NOTARIZATION_STATUS', 'transient-failure');
            return;
          }
        }
        const errorMsg = String(error.message || error);
        console.error('Notarization failed.');
        console.error('Full error:', errorMsg);
        if (errorMsg.includes('UNEXPECTED_ERROR') || errorMsg.includes('statusCode: 500')) {
          console.error(
            'Apple returned UNEXPECTED_ERROR (500). Possible causes:\n' +
            '  - App-specific password expired or revoked (regenerate at appleid.apple.com)\n' +
            '  - Wrong Team ID (should match certificate: verify in Apple Developer portal)\n' +
            '  - New Apple Terms of Service not accepted\n' +
            '  - Certificate is App Store type instead of Developer ID Application'
          );
        }
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 3000);
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)) + jitterMs;
      console.warn(
        `Notarization attempt ${attempt}/${maxAttempts} failed with a transient Apple error. Retrying in ${Math.round(delayMs / 1000)}s...`
      );
      await sleep(delayMs);
    }
  }
  } finally {
    // Supprimer le fichier .p8 temporaire après usage
    if (tempKeyPath) {
      try { require('node:fs').unlinkSync(tempKeyPath); } catch (_) {}
    }
  }
};
