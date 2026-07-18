import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.navopath.app",
  appName: "NavoPath",
  webDir: "dist",
  backgroundColor: "#151310",
  ios: {
    allowsLinkPreview: false,
    backgroundColor: "#151310",
    contentInset: "never",
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "DEFAULT",
    },
  },
};

export default config;
