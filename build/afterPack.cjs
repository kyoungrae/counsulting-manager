const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
    const { appOutDir, packager } = context;
    const platform = packager.platform.name;

    // Only run on macOS
    if (platform !== 'mac' && platform !== 'darwin') {
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);
    const entitlementsPath = path.resolve(__dirname, 'entitlements.mac.plist');

    console.log(`[Custom Signing] Signing ${appPath} with ad-hoc identity and entitlements...`);

    try {
        // Force manual code signing with entitlements
        execSync(`codesign --force --deep --options runtime --sign "-" --entitlements "${entitlementsPath}" "${appPath}"`);
        console.log('[Custom Signing] Success! Ad-hoc signature applied with entitlements.');
    } catch (error) {
        console.error('[Custom Signing] Error during manual signing:', error);
        throw error;
    }
};
