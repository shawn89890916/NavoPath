/* Deep DOM inspection — checks article children, accent span, border properties, full panel */
const { app, BrowserWindow } = require("electron");

app.commandLine.appendSwitch("disable-gpu");
app.disableHardwareAcceleration();

let win;
app.whenReady().then(() => {
  win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { contextIsolation: false, nodeIntegration: false },
  });

  const appUrl = "http://127.0.0.1:4173/app?preview=local";
  win.loadURL(appUrl).catch((err) => { console.error("Failed to load:", err); app.quit(); });

  setTimeout(async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const result = await win.webContents.executeJavaScript(`
        (function() {
          var panel = document.querySelector(".df-candidate-panel");
          var list = document.querySelector(".df-candidate-list");
          if (!list) return JSON.stringify({ error: "no candidate list" });

          // 1. Full panel structure (all children of candidate-panel)
          var panelChildren = panel ? Array.from(panel.children).map(function(c) {
            var r = c.getBoundingClientRect();
            var s = window.getComputedStyle(c);
            return {
              tag: c.tagName,
              class: c.className,
              rect: { top: Math.round(r.top), height: Math.round(r.height), bottom: Math.round(r.bottom) },
              computed: { display: s.display, margin: s.margin, padding: s.padding, border: s.border, background: s.backgroundColor, minHeight: s.minHeight },
              childCount: c.children.length,
            };
          }) : [];

          // 2. First task row: full outerHTML (truncated) + article children
          var firstRow = list.querySelector(".df-candidate-task-row");
          var article = firstRow ? firstRow.querySelector(".df-task-block") : null;

          var articleChildren = article ? Array.from(article.children).map(function(c) {
            var r = c.getBoundingClientRect();
            var s = window.getComputedStyle(c);
            return {
              tag: c.tagName,
              class: c.className,
              rect: { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) },
              computed: {
                display: s.display,
                position: s.position,
                width: s.width, height: s.height,
                top: s.top, left: s.left, right: s.right, bottom: s.bottom,
                background: s.backgroundColor,
                opacity: s.opacity,
                visibility: s.visibility,
                borderRadius: s.borderRadius,
              },
              text: (c.textContent || "").substring(0, 30).trim(),
            };
          }) : [];

          // 3. Article individual border properties
          var articleBorder = article ? (function() {
            var s = window.getComputedStyle(article);
            return {
              borderTopWidth: s.borderTopWidth, borderTopStyle: s.borderTopStyle, borderTopColor: s.borderTopColor,
              borderRightWidth: s.borderRightWidth, borderRightStyle: s.borderRightStyle, borderRightColor: s.borderRightColor,
              borderBottomWidth: s.borderBottomWidth, borderBottomStyle: s.borderBottomStyle, borderBottomColor: s.borderBottomColor,
              borderLeftWidth: s.borderLeftWidth, borderLeftStyle: s.borderLeftStyle, borderLeftColor: s.borderLeftColor,
              boxShadow: s.boxShadow,
              background: s.backgroundColor,
              padding: s.padding,
              margin: s.margin,
              minHeight: s.minHeight,
            };
          })() : null;

          // 4. Accent span specifically
          var accent = article ? article.querySelector(".df-task-block-accent") : null;
          var accentInfo = accent ? (function() {
            var r = accent.getBoundingClientRect();
            var s = window.getComputedStyle(accent);
            return {
              rect: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom },
              computed: {
                display: s.display, position: s.position,
                width: s.width, height: s.height,
                top: s.top, left: s.left, right: s.right, bottom: s.bottom,
                background: s.backgroundColor, opacity: s.opacity,
                borderRadius: s.borderRadius,
              }
            };
          })() : null;

          // 5. Check for .df-card-strip or any other visual elements inside article
          var cardStrip = article ? article.querySelector(".df-card-strip") : null;
          var cardStripInfo = cardStrip ? (function() {
            var r = cardStrip.getBoundingClientRect();
            var s = window.getComputedStyle(cardStrip);
            return { rect: { top: r.top, left: r.left, width: r.width, height: r.height }, computed: { display: s.display, position: s.position, background: s.backgroundColor } };
          })() : null;

          // 6. Full outerHTML of first row (truncated)
          var rowHTML = firstRow ? firstRow.outerHTML.substring(0, 2000) : null;

          // 7. Check for any element with position:absolute in the panel that has visible dimensions
          var absElements = panel ? Array.from(panel.querySelectorAll("*")).filter(function(e) {
            var s = window.getComputedStyle(e);
            return s.position === "absolute" && s.display !== "none" && s.visibility !== "hidden" && e.getBoundingClientRect().height > 0;
          }).map(function(e) {
            var r = e.getBoundingClientRect();
            return { tag: e.tagName, class: e.className, rect: { top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } };
          }) : [];

          return JSON.stringify({
            panelChildren: panelChildren,
            articleChildren: articleChildren,
            articleBorder: articleBorder,
            accentSpan: accentInfo,
            cardStrip: cardStripInfo,
            rowHTML: rowHTML,
            absoluteVisibleElements: absElements,
          }, null, 2);
        })()
      `);

      console.log("=== DEEP DOM INSPECTION ===");
      console.log(result);
    } catch (err) {
      console.error("Inspection failed:", err);
    } finally {
      app.quit();
    }
  }, 5000);
});

app.on("window-all-closed", () => app.quit());
