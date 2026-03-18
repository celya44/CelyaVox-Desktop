const { notarize } = require('@electron/notarize');
const { build } = require('../package.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
        console.error('Notarization failed:', error);
        throw error;
      }

      const delayMs = Math.min(60000, 5000 * 2 ** (attempt - 1));
      console.warn(
        `Notarization attempt ${attempt}/${maxAttempts} failed with a transient Apple error. Retrying in ${Math.round(delayMs / 1000)}s...`
      );
      await sleep(delayMs);
    }
  }
};
