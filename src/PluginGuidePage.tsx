import { useState } from "react";
import { detectSystemLanguage } from "./i18n";
import { registerBuiltinPlugins } from "./plugins/builtin";
import { listPlugins, pluginText } from "./plugins/registry";
import type { Language } from "./types";
import "./plugin-guide.css";

const MCP_ENDPOINT = import.meta.env.VITE_MCP_ENDPOINT || "https://navopath-mcp.shawn89890916.workers.dev/mcp";

function localizedPluginName(plugin: ReturnType<typeof listPlugins>[number], lang: Language) {
  return pluginText(plugin.name, plugin.nameI18n, lang);
}

function localizedPluginDescription(plugin: ReturnType<typeof listPlugins>[number], lang: Language) {
  return pluginText(plugin.description, plugin.descriptionI18n, lang);
}

function localizedPluginEnabledSummary(plugin: ReturnType<typeof listPlugins>[number], lang: Language) {
  return pluginText(
    lang === "zh" ? "启用后会在下方工具区显示可直接使用的官方工具。" : "After enabling, its official tool appears below.",
    plugin.enabledSummaryI18n,
    lang,
  );
}

function DocCodeBlock({ value, label, language }: { value: string; label: string; language: Language }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <div className="df-doc-code-block">
    <div><span>{label}</span><button type="button" onClick={() => void copy()}>{copied ? (language === "zh" ? "已复制" : "Copied") : (language === "zh" ? "复制" : "Copy")}</button></div>
    <pre><code>{value}</code></pre>
  </div>;
}

export default function PluginGuidePage() {
  registerBuiltinPlugins();
  const [language, setLanguage] = useState<Language>(detectSystemLanguage());
  const zh = language === "zh";
  const labels = {
    back: zh ? "返回工作区" : "Back to app",
    tag: zh ? "官方插件 / MCP" : "OFFICIAL PLUGINS / MCP",
    title: zh ? "Plugins 和 MCP 使用说明" : "Plugins and MCP guide",
    intro: zh
      ? "随 NavoPath 发布的官方内置插件可提供直接使用的工具；桌面设置也可展示经过校验的本地 manifest 和配置，但不会加载或执行本地目录或远程脚本。"
      : "Official built-in plugins shipped with NavoPath can provide usable tools. Desktop settings may also display validated local manifests and configuration, but local directory scripts and remote scripts are not loaded or executed.",
    mcp: zh ? "在新电脑上连接 NavoPath" : "Connect NavoPath on a new computer",
    plugins: zh ? "官方插件作用" : "Official plugin roles",
    security: zh ? "安全边界" : "Security boundary",
    host: zh ? "宿主能力" : "Host capabilities",
  };
  const codexConfig = `[mcp_servers.navopath]\nurl = "${MCP_ENDPOINT}"\nbearer_token_env_var = "NAVOPATH_MCP_TOKEN"`;
  const windowsTokenCommand = `[Environment]::SetEnvironmentVariable("NAVOPATH_MCP_TOKEN", "nvp_YOUR_TOKEN", "User")`;
  const unixTokenCommand = `# macOS (zsh)\necho 'export NAVOPATH_MCP_TOKEN="nvp_YOUR_TOKEN"' >> ~/.zshrc\n\n# Linux (bash)\necho 'export NAVOPATH_MCP_TOKEN="nvp_YOUR_TOKEN"' >> ~/.bashrc`;
  const claudeWindowsConfig = `{
  "mcpServers": {
    "navopath": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y", "mcp-remote",
        "${MCP_ENDPOINT}",
        "--header", "Authorization: Bearer nvp_YOUR_TOKEN"
      ]
    }
  }
}`;
  const claudeUnixConfig = `{
  "mcpServers": {
    "navopath": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "${MCP_ENDPOINT}",
        "--header", "Authorization: Bearer nvp_YOUR_TOKEN"
      ]
    }
  }
}`;

  return <main className="df-doc-page changelog-like">
    <nav className="df-doc-sidebar" aria-label={zh ? "文档导航" : "Documentation navigation"}>
      <a href="/app">← {labels.back}</a>
      <div className="df-doc-language" aria-label={zh ? "文档语言" : "Guide language"}>
        <button type="button" className={zh ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
        <button type="button" className={!zh ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
      </div>
    </nav>
    <article className="df-doc-content">
      <header className="df-doc-hero"><span>{labels.tag}</span><h1>{labels.title}</h1><p>{labels.intro}</p></header>
      <section id="mcp" className="df-doc-section">
        <h2>{labels.mcp}</h2>
        <p className="df-doc-lede">{zh ? "每台电脑准备一个独立令牌。完成下面三步后，Codex 或 Claude 就能读取项目、任务与日程，并在你允许时更新它们。" : "Give each computer its own token. After these three steps, Codex or Claude can read your projects, tasks, and schedule, then update them when you allow it."}</p>
        <div className="df-doc-steps" aria-label={zh ? "连接步骤" : "Connection steps"}>
          <article><span>01</span><div><h3>{zh ? "登录同一账户" : "Sign in to the same account"}</h3><p>{zh ? "在新电脑打开 NavoPath，登录保存规划数据的云端账户。" : "Open NavoPath on the new computer and sign in to the cloud account that holds your planner data."}</p></div></article>
          <article><span>02</span><div><h3>{zh ? "生成设备令牌" : "Create a device token"}</h3><p>{zh ? "前往设置 → 高级 → 日历与集成 → MCP。用设备名称生成令牌，并立即复制以 nvp_ 开头的完整内容。" : "Go to Settings → Advanced → Calendar & Integrations → MCP. Name the device, create a token, and immediately copy the complete value beginning with nvp_."}</p></div></article>
          <article><span>03</span><div><h3>{zh ? "选择客户端并验证" : "Choose a client and verify"}</h3><p>{zh ? "按下方对应客户端完成配置，彻底退出客户端后重新打开，再让它列出 NavoPath 项目。" : "Follow the matching client guide below, fully quit and reopen the client, then ask it to list your NavoPath projects."}</p></div></article>
        </div>
        <aside className="df-doc-note"><span>{zh ? "连接资料" : "Connection details"}</span><dl>
          <div><dt>{zh ? "服务地址" : "Endpoint"}</dt><dd><code>{MCP_ENDPOINT}</code></dd></div>
          <div><dt>{zh ? "传输方式" : "Transport"}</dt><dd>Streamable HTTP</dd></div>
          <div><dt>{zh ? "认证请求头" : "Authentication header"}</dt><dd><code>Authorization: Bearer nvp_...</code></dd></div>
        </dl></aside>
      </section>
      <section id="codex" className="df-doc-section df-doc-client">
        <div className="df-doc-section-heading"><span>CLIENT 01</span><h2>Codex</h2></div>
        <p>{zh ? "Codex 桌面端、CLI 与 IDE 扩展共享同一份本机配置。令牌放在系统环境变量中，配置文件可以安全地在自己的设备间复制。" : "Codex desktop, CLI, and the IDE extension share one local configuration. Keep the token in a system environment variable so the configuration file can be copied safely between your own devices."}</p>
        <ol className="df-doc-checklist"><li>{zh ? <>把下面内容加入 <code>~/.codex/config.toml</code>。Windows 的完整位置为 <code>$HOME\.codex\config.toml</code>。</> : <>Add the following block to <code>~/.codex/config.toml</code>. On Windows, the full path is <code>$HOME\.codex\config.toml</code>.</>}</li></ol>
        <DocCodeBlock value={codexConfig} label="CONFIG.TOML" language={language} />
        <div className="df-doc-platforms">
          <article><span>WINDOWS · POWERSHELL</span><p>{zh ? "把占位内容替换为刚生成的令牌，然后运行：" : "Replace the placeholder with the token you just created, then run:"}</p><DocCodeBlock value={windowsTokenCommand} label="POWERSHELL" language={language} /></article>
          <article><span>MACOS / LINUX</span><p>{zh ? "选择当前系统对应的命令；使用其他 shell 时请写入相应配置文件。" : "Use the command for your system. If you use another shell, add the export to its matching profile."}</p><DocCodeBlock value={unixTokenCommand} label="SHELL" language={language} /></article>
        </div>
        <ol className="df-doc-checklist" start={2}><li>{zh ? "彻底退出 Codex 后重新打开。" : "Fully quit Codex, then reopen it."}</li><li>{zh ? <>打开 MCP 列表确认 <code>navopath</code> 已连接，或输入“列出我的 NavoPath 项目”。</> : <>Open the MCP list and confirm <code>navopath</code> is connected, or ask “List my NavoPath projects.”</>}</li></ol>
      </section>
      <section id="claude" className="df-doc-section df-doc-client">
        <div className="df-doc-section-heading"><span>CLIENT 02</span><h2>Claude Desktop</h2></div>
        <p>{zh ? "Claude Desktop 可通过 mcp-remote 连接带 Bearer Token 的远程服务。Windows 需要 cmd 包装 npx；macOS 与 Linux 可以直接运行 npx。" : "Claude Desktop can use mcp-remote to reach a bearer-token protected remote server. Windows wraps npx with cmd; macOS and Linux can run npx directly."}</p>
        <ol className="df-doc-checklist"><li>{zh ? <>安装 Node.js，并先启动一次 Claude Desktop。打开配置文件：Windows 使用 <code>%APPDATA%\Claude\claude_desktop_config.json</code>，macOS 使用 <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>。</> : <>Install Node.js and launch Claude Desktop once. Open <code>%APPDATA%\Claude\claude_desktop_config.json</code> on Windows or <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS.</>}</li><li>{zh ? "把 nvp_YOUR_TOKEN 换成这台电脑的令牌，再保存对应配置。" : "Replace nvp_YOUR_TOKEN with this computer's token, then save the matching configuration."}</li></ol>
        <div className="df-doc-platforms">
          <article><span>WINDOWS</span><DocCodeBlock value={claudeWindowsConfig} label="CLAUDE_DESKTOP_CONFIG.JSON" language={language} /></article>
          <article><span>MACOS / LINUX</span><DocCodeBlock value={claudeUnixConfig} label="CLAUDE_DESKTOP_CONFIG.JSON" language={language} /></article>
        </div>
        <ol className="df-doc-checklist" start={3}><li>{zh ? "彻底退出 Claude Desktop 后重新打开，在聊天输入框旁的连接器列表中确认 NavoPath 已出现。" : "Fully quit Claude Desktop and reopen it. Confirm that NavoPath appears in the connectors list beside the composer."}</li></ol>
      </section>
      <section id="move" className="df-doc-section">
        <div className="df-doc-section-heading"><span>{zh ? "换机清单" : "NEW COMPUTER"}</span><h2>{zh ? "带到另一台电脑" : "Move to another computer"}</h2></div>
        <div className="df-doc-transfer"><p>{zh ? "在新电脑重复生成令牌、保存令牌、写入客户端配置、重启并验证这五个动作。保留旧电脑的独立令牌，设备遗失或停用时即可单独撤销。" : "On the new computer, create a token, store it, add the client configuration, restart, and verify. Keep a separate token for the old computer so you can revoke either device independently."}</p><ul>
          <li>{zh ? "令牌按设备命名，例如 Office-PC、Home-Mac。" : "Name tokens by device, such as Office-PC or Home-Mac."}</li>
          <li>{zh ? "不要把令牌发送到聊天、截图、网盘共享目录或 Git 仓库。" : "Keep tokens out of chats, screenshots, shared cloud folders, and Git repositories."}</li>
          <li>{zh ? "令牌泄露后，立即在 NavoPath 的 MCP 设置中撤销并重新生成。" : "If a token is exposed, revoke it in NavoPath MCP settings and create a replacement immediately."}</li>
        </ul></div>
      </section>
      <section id="troubleshooting" className="df-doc-section">
        <div className="df-doc-section-heading"><span>{zh ? "快速诊断" : "QUICK DIAGNOSIS"}</span><h2>{zh ? "连接没有出现" : "Connection does not appear"}</h2></div>
        <table className="df-doc-troubleshooting"><tbody>
          <tr><th><code>401</code></th><td>{zh ? "令牌不完整、已撤销或请求头格式有误。重新生成设备令牌并更新完整的 nvp_ 值。" : "The token is incomplete, revoked, or sent with a malformed header. Create a new device token and update the complete nvp_ value."}</td></tr>
          <tr><th>{zh ? "找不到工作区" : "Workspace missing"}</th><td>{zh ? "先在 NavoPath 登录同一云端账户并等待工作区加载完成。" : "Sign in to the same NavoPath cloud account and wait for the workspace to finish loading."}</td></tr>
          <tr><th>{zh ? "客户端无服务" : "Server absent"}</th><td>{zh ? "检查地址末尾是否包含 /mcp，保存配置后彻底退出客户端并重新打开。" : "Confirm the address ends in /mcp, save the configuration, then fully quit and reopen the client."}</td></tr>
          <tr><th><code>PROFILE_REVISION_CONFLICT</code></th><td>{zh ? "让客户端重新读取相关数据，再重试当前写入。" : "Ask the client to read the affected data again, then retry the current write."}</td></tr>
          <tr><th>{zh ? "Claude 启动失败" : "Claude launch failure"}</th><td>{zh ? "确认 Node.js 与 npx 可用；Windows 配置需要 command: cmd 和首个参数 /c。" : "Confirm Node.js and npx are available. On Windows, use command: cmd with /c as the first argument."}</td></tr>
        </tbody></table>
      </section>
      <section id="plugins" className="df-doc-section"><h2>{labels.plugins}</h2><div className="df-doc-grid">
        {listPlugins().map((plugin) => <article key={plugin.id}><h3>{localizedPluginName(plugin, language)}</h3><p>{localizedPluginDescription(plugin, language)}</p><small>{localizedPluginEnabledSummary(plugin, language)}</small></article>)}
      </div></section>
      <section id="security" className="df-doc-section"><h2>{labels.security}</h2><p>{zh ? "内置插件代码随 NavoPath 一起发布。桌面端本地插件只会把经过大小与结构校验的 manifest 元数据和配置登记到界面，不读取或执行目录脚本；网页版同样不会加载任意本地或远程插件代码。" : "Built-in plugin code ships with NavoPath. Desktop local plugins contribute only manifest metadata and configuration that pass size and structure validation; directory scripts are not read or executed, and the web build likewise loads no arbitrary local or remote plugin code."}</p></section>
      <section id="host" className="df-doc-section"><h2>{labels.host}</h2><table><tbody>
        <tr><th><code>getData()</code></th><td>{zh ? "读取当前规划快照。" : "Read the current planner snapshot."}</td></tr>
        <tr><th><code>savePluginConfig(id, patch)</code></th><td>{zh ? "保存插件自己的设置。" : "Persist plugin-owned settings."}</td></tr>
        <tr><th><code>emit(event, payload)</code></th><td>{zh ? "广播 NavoPath 插件事件。" : "Broadcast a NavoPath plugin event."}</td></tr>
        <tr><th><code>toast(message)</code></th><td>{zh ? "显示短暂的应用内状态提示。" : "Show a transient in-app status message."}</td></tr>
      </tbody></table></section>
    </article>
  </main>;
}
