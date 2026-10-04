/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'ZincirWidget',
  displayName: 'Sözüm Söz',
  bundleIdentifier: '.widget',
  // Etkileşimli widget'lar (AppIntent düğmeleri) iOS 17 gerektirir.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  colors: {
    $accent: '#FF6B3D',
    $widgetBackground: { light: '#FFFFFF', dark: '#1A1816' },
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
