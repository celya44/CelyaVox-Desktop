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
 * Vérifie les credentials Apple AVANT de tenter la notarisation.
 * Utilise `xcrun notarytool history` qui échoue immédiatement si les
 * credentials sont invalides (contrairement à `submit --wait` qui prend
 * plusieurs minutes avant de retourner une erreur 500).
 * Le mot de passe est passé via @env: pour éviter son exposition dans la
 * liste des processus.
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

  if (result.status === 0) {
    return { ok: true };
  }

  const detail = (result.stderr || result.stdout || '').trim();
  return { ok: false, detail };
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  const appleId = normalizeSecret(process.env.NOTARIZE_APPLE_ID || process.env.APPLE_ID);
  const appleIdPassword = normalizeSecret(
    process.env.NOTARIZE_APPLE_ID_PASSWORD || process.env.APPLE_ID_PASSWORD || process.env.APPLE_APP_SPECIFIC_PASSWORD
  );
  const appleTeamId = normalizeSecret(process.env.NOTARIZE_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID);
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization if credentials are not provided
  if (!appleId || !appleIdPassword || !appleTeamId) {
    console.log('Skipping notarization: Apple credentials are not set');
    setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '0');
    setGithubEnv('NOTARIZATION_STATUS', 'skipped');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  // Masked diagnostic: help identify credential mismatches without leaking secrets
  const maskedId = appleId.length > 3 ? `${appleId.slice(0, 3)}***` : '***';
  console.log(`Notarizing ${appPath}`);
  console.log(`  Apple ID : ${maskedId}`);
  console.log(`  Team ID  : ${appleTeamId}`);
  console.log(`  Bundle ID: ${build.appId}`);

  // --- Preflight credential check ---
  // xcrun notarytool history répond en < 5s avec une erreur claire si les
  // credentials sont invalides, évitant 13+ minutes d'attente pour rien.
  console.log('Checking notarization credentials via notarytool history...');
  const credCheck = verifyNotaryCredentials(appleId, appleIdPassword, appleTeamId);
  if (!credCheck.ok) {
    const msg =
      'Notarization credential check FAILED. The build cannot be notarized.\n' +
      'Likely causes:\n' +
      '  1. App-specific password expired/revoked → regenerate at https://appleid.apple.com\n' +
      '  2. Apple Developer Agreement updated → accept at https://developer.apple.com\n' +
      '  3. Wrong Team ID in NOTARIZE_APPLE_TEAM_ID secret\n' +
      '  4. Account subscription expired\n' +
      (credCheck.detail ? `\nnotarytool output:\n${credCheck.detail}` : '');
    console.error(msg);
    setGithubEnv('NOTARIZATION_STATUS', 'credential-error');
    setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '0');
    // Credential errors are never soft-failed, regardless of NOTARIZE_ALLOW_TRANSIENT_FAILURE
    throw new Error('Notarization credential check failed — fix credentials and retry.');
  }
  console.log('Credentials check passed.');

  const maxAttempts = parsePositiveInt(process.env.NOTARIZE_MAX_ATTEMPTS, 1);
  const baseDelayMs = parsePositiveInt(process.env.NOTARIZE_RETRY_BASE_MS, 15000);
  const maxDelayMs = parsePositiveInt(process.env.NOTARIZE_RETRY_MAX_MS, 180000);
  const allowTransientFailure = parseBoolean(process.env.NOTARIZE_ALLOW_TRANSIENT_FAILURE, false);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`Notarization attempt ${attempt}/${maxAttempts}`);
    try {
      await notarize({
        appPath: appPath,
        appleId,
        appleIdPassword,
        teamId: appleTeamId,
      });
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
};
