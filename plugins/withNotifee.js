const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Expo Config Plugin for @notifee/react-native
 * Android 14+ (API 34+) Foreground Service Type configuration.
 */
const withNotifee = (config, options = {}) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    const rawTypes = options?.android?.foregroundServiceTypes || ['microphone', 'phoneCall'];
    const serviceTypeString = Array.isArray(rawTypes) ? rawTypes.join('|') : rawTypes;

    // Ensure xmlns:tools exists for tools:replace
    if (!manifest.$) {
      manifest.$ = {};
    }
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const mainApplication = manifest.application?.[0];
    if (mainApplication) {
      mainApplication.service = mainApplication.service || [];

      let service = mainApplication.service.find(
        (s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService',
      );

      if (!service) {
        service = {
          $: {
            'android:name': 'app.notifee.core.ForegroundService',
            'android:exported': 'false',
          },
        };
        mainApplication.service.push(service);
      }

      service.$['android:foregroundServiceType'] = serviceTypeString;
      service.$['tools:replace'] = 'android:foregroundServiceType';
    }

    return config;
  });
};

module.exports = withNotifee;
