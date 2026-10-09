import type { CapacitorConfig } from '@capacitor/cli';

// ETQ_DEV_URL points the app at a local gym-ui checkout (see tools/dev-proxy.mjs)
// instead of production, to test web changes on a device before they merge.
const devUrl = process.env.ETQ_DEV_URL;

const config: CapacitorConfig = {
  appId: 'com.etqadem.app',
  appName: 'Etqadem',
  webDir: 'www',
  backgroundColor: '#10171f',
  server: {
    url: devUrl || 'https://etqadem.cloider.app/app/',
    androidScheme: 'https',
    cleartext: !!devUrl && devUrl.startsWith('http:'),
    // Offline / unreachable on launch: show the bundled fallback page.
    errorPath: 'index.html',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Held until the web app's logo loader has painted (gym-ui
      // boot-loader.js calls SplashScreen.hide()), so launch is one
      // continuous logo with no white flash. Auto-hide after 5 s is only a
      // backstop (web code without that call, or a page that never loads).
      launchAutoHide: true,
      launchShowDuration: 5000,
      launchFadeOutDuration: 200,
      backgroundColor: '#10171f',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
      logLevel: 1,
    },
  },
};

export default config;
