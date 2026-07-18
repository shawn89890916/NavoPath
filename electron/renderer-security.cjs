const path = require("node:path");
const { fileURLToPath } = require("node:url");

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function resolveDevAppUrl(devServerUrl, query = {}) {
  if (!devServerUrl) throw new Error("VITE_DEV_SERVER_URL is required when the local app build is unavailable.");
  const baseUrl = new URL(devServerUrl);
  if (!isLoopbackHost(baseUrl.hostname) || !["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("Electron development content must be served from a loopback URL.");
  }
  const appUrl = new URL("/app", baseUrl);
  for (const [key, value] of Object.entries(query)) appUrl.searchParams.set(key, String(value));
  return appUrl;
}

function createRendererPolicy({ localIndexPath, devServerUrl }) {
  const normalizePath = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  const trustedIndex = normalizePath(localIndexPath);
  const devAppUrl = devServerUrl ? resolveDevAppUrl(devServerUrl) : null;

  function isTrustedUrl(rawUrl) {
    try {
      const target = new URL(rawUrl);
      if (target.protocol === "file:") {
        return normalizePath(fileURLToPath(target)) === trustedIndex;
      }
      return Boolean(
        devAppUrl
        && target.origin === devAppUrl.origin
        && (target.pathname === "/app" || target.pathname.startsWith("/app/")),
      );
    } catch {
      return false;
    }
  }

  function assertTrustedSender(event) {
    const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || "";
    if (!isTrustedUrl(senderUrl)) throw new Error("Blocked IPC call from an untrusted renderer.");
  }

  function secureWindowNavigation(win, openExternal) {
    win.webContents.on("will-navigate", (event, url) => {
      if (isTrustedUrl(url)) return;
      event.preventDefault();
      if (/^https?:/i.test(url)) openExternal?.(url);
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url) && !isTrustedUrl(url)) openExternal?.(url);
      return { action: "deny" };
    });
  }

  return { assertTrustedSender, isTrustedUrl, secureWindowNavigation };
}

module.exports = { createRendererPolicy, isLoopbackHost, resolveDevAppUrl };
