import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

if (Capacitor.getPlatform() === "ios") {
  if (window.location.pathname === "/") {
    window.history.replaceState({}, "", "/app");
  }
  document.documentElement.classList.add("is-native-ios");

  const syncStatusBarStyle = () => {
    const darkTheme = document.querySelector(".df-app.theme-dark") !== null;
    void StatusBar.setStyle({ style: darkTheme ? Style.Dark : Style.Light });
  };

  const watchAppTheme = () => {
    const root = document.getElementById("root");
    if (!root) return;

    let observedApp: Element | null = null;
    let appObserver: MutationObserver | null = null;
    const connectAppObserver = () => {
      const app = document.querySelector(".df-app");
      if (app === observedApp) return;
      appObserver?.disconnect();
      observedApp = app;
      syncStatusBarStyle();
      if (app) {
        appObserver = new MutationObserver(syncStatusBarStyle);
        appObserver.observe(app, { attributes: true, attributeFilter: ["class"] });
      }
    };

    connectAppObserver();
    new MutationObserver(connectAppObserver).observe(root, { childList: true, subtree: true });
  };

  void StatusBar.setOverlaysWebView({ overlay: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchAppTheme, { once: true });
  } else {
    watchAppTheme();
  }
}
