const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Expo Config Plugin to configure Android Foreground Service for @notifee/react-native
 * Required for Android 14+ (API 34+) to allow WebRTC microphone and call streaming in background.
 */
const withNotifeeForegroundService = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure tools namespace is defined
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    if (!Array.isArray(app.service)) {
      app.service = [];
    }

    let service = app.service.find(
      (item) => item.$ && item.$['android:name'] === 'app.notifee.core.ForegroundService'
    );

    if (!service) {
      service = {
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone|phoneCall',
          'tools:replace': 'android:foregroundServiceType',
        },
      };
      app.service.push(service);
    } else {
      service.$['android:foregroundServiceType'] = 'microphone|phoneCall';
      service.$['tools:replace'] = 'android:foregroundServiceType';
    }

    return config;
  });
};

module.exports = withNotifeeForegroundService;
