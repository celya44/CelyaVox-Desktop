const { notarize } = require('@electron/notarize');
const { build } = require('../package.json');

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

  try {
    await notarize({
      appBundleId: build.appId,
      appPath: appPath,
      appleId,
      appleIdPassword,
      teamId: appleTeamId,
    });
    console.log('Notarization completed successfully');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
