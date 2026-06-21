const path = require("node:path");

module.exports = async function brandElectronBuild(context) {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const productName = "NavoPath";
  const executablePath = path.join(context.appOutDir, `${productName}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const version = context.packager.appInfo.version;

  await rcedit(executablePath, {
    icon: iconPath,
    "file-version": version,
    "product-version": version,
    "version-string": {
      CompanyName: productName,
      FileDescription: `${productName} — Navigate your next step.`,
      InternalName: productName,
      LegalCopyright: `Copyright © ${new Date().getFullYear()} ${productName}`,
      OriginalFilename: `${productName}.exe`,
      ProductName: productName
    }
  });
};
