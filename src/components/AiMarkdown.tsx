import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeAiReply } from "../utils/aiReply";

const SAFE_PROTOCOL = /^(https?:|mailto:|tel:)/i;

export function safeMarkdownUrl(url: string): string {
  if (url.startsWith("#") || url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
    return defaultUrlTransform(url);
  }
  return SAFE_PROTOCOL.test(url) ? defaultUrlTransform(url) : "";
}

function CodeBlock({ children, language }: { children: ReactNode; language?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return <div className="df-ai-code-block">
    <div className="df-ai-code-head">
      <span>{language || "code"}</span>
      <button type="button" onClick={() => void copy()}>{copied ? "已复制" : "复制"}</button>
    </div>
    <pre><code className={language ? `language-${language}` : undefined}>{code}</code></pre>
  </div>;
}

const components: Components = {
  a: ({ href = "", children, ...props }) => {
    const external = /^https?:/i.test(href);
    return <a {...props} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{children}</a>;
  },
  pre: ({ children }) => {
    if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) return <pre>{children}</pre>;
    const language = /language-([\w-]+)/.exec(children.props.className || "")?.[1];
    return <CodeBlock language={language}>{children.props.children}</CodeBlock>;
  },
};

export default function AiMarkdown({ children }: { children: string }) {
  return <div className="df-ai-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
      urlTransform={safeMarkdownUrl}
      skipHtml
    >
      {normalizeAiReply(children)}
    </ReactMarkdown>
  </div>;
}
