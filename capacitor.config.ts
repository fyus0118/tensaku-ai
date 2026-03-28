import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.tensaku.app",
  appName: "TENSAKU",
  webDir: "out",
  server: {
    // 本番はWebアプリのURLを指定（ネイティブシェル + WebView）
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    cleartext: true,
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "tensaku",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
    Keyboard: {
      resize: "body" as unknown as import("@capacitor/keyboard").KeyboardResize,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
