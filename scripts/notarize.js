const { notarize } = require('@electron/notarize');
const { build } = require('../package.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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
    message.includes('Please try again at a later time') ||
    message.includes('internalError')
  );
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  const appleId = process.env.NOTARIZE_APPLE_ID || process.env.APPLE_ID;
  const appleIdPassword = process.env.NOTARIZE_APPLE_ID_PASSWORD || process.env.APPLE_ID_PASSWORD || process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const appleTeamId = process.env.NOTARIZE_APPLE_TEAM_ID || process.env.APPLE_TEAM_ID;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization if credentials are not provided
  if (!appleId || !appleIdPassword) {
    console.log('Skipping notarization: Apple credentials are not set');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  const maxAttempts = parsePositiveInt(process.env.NOTARIZE_MAX_ATTEMPTS, 8);
  const baseDelayMs = parsePositiveInt(process.env.NOTARIZE_RETRY_BASE_MS, 15000);
  const maxDelayMs = parsePositiveInt(process.env.NOTARIZE_RETRY_MAX_MS, 180000);
  const allowTransientFailure = parseBoolean(process.env.NOTARIZE_ALLOW_TRANSIENT_FAILURE, false);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`Notarization attempt ${attempt}/${maxAttempts}`);
    try {
      await notarize({
        appBundleId: build.appId,
        appPath: appPath,
        appleId,
        appleIdPassword,
        teamId: appleTeamId,
      });
      console.log('Notarization completed successfully');
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
            setGithubEnv('NOTARIZATION_TRANSIENT_FAILURE', '1');
            setGithubEnv('NOTARIZATION_STATUS', 'transient-failure');
            return;
          }
        }
        console.error('Notarization failed:', error);
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
