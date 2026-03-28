/**
 * ネイティブ機能のブリッジ
 * Capacitorがない環境（Web）ではno-opで動作
 */

import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();

// ハプティクス
export async function hapticLight() {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function hapticMedium() {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  await Haptics.impact({ style: ImpactStyle.Medium });
}

export async function hapticSuccess() {
  if (!isNative) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Success });
}

export async function hapticError() {
  if (!isNative) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  await Haptics.notification({ type: NotificationType.Error });
}

// プッシュ通知
export async function registerPushNotifications() {
  if (!isNative) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive === "granted") {
    await PushNotifications.register();
  }

  PushNotifications.addListener("registration", (token) => {
    console.log("[Push] Token:", token.value);
    // TODO: サーバーにトークンを送信
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[Push] Registration error:", err);
  });
}

// ステータスバー
export async function setupStatusBar() {
  if (!isNative) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#0a0a0a" });
}

// スプラッシュスクリーン
export async function hideSplash() {
  if (!isNative) return;
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide();
}

// キーボード
export async function setupKeyboard() {
  if (!isNative) return;
  const { Keyboard } = await import("@capacitor/keyboard");
  Keyboard.addListener("keyboardWillShow", () => {
    document.body.classList.add("keyboard-open");
  });
  Keyboard.addListener("keyboardWillHide", () => {
    document.body.classList.remove("keyboard-open");
  });
}

// 初期化（アプリ起動時に1回呼ぶ）
export async function initNative() {
  if (!isNative) return;
  await setupStatusBar();
  await setupKeyboard();
  await hideSplash();
  await registerPushNotifications();
}

export { isNative };
