import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Language } from "./i18n";

type DialogKind = "prompt" | "confirm" | "alert";

type DialogRequest = {
  kind: DialogKind;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | boolean | null) => void;
};

function labels(lang: Language) {
  return lang === "zh"
    ? { cancel: "取消", confirm: "确定", ok: "知道了" }
    : { cancel: "Cancel", confirm: "Confirm", ok: "OK" };
}

export function useInAppDialog(lang: Language) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const pendingRef = useRef<DialogRequest | null>(null);

  const close = useCallback((value: string | boolean | null) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setRequest(null);
    current.resolve(value);
  }, []);

  const open = useCallback((next: Omit<DialogRequest, "resolve">) => {
    if (pendingRef.current) pendingRef.current.resolve(null);
    return new Promise<string | boolean | null>((resolve) => {
      const requestWithResolver = { ...next, resolve };
      pendingRef.current = requestWithResolver;
      setRequest(requestWithResolver);
    });
  }, []);

  const prompt = useCallback(
    (title: string, initialValue = "", options?: { message?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }) =>
      open({ kind: "prompt", title, initialValue, ...options }) as Promise<string | null>,
    [open],
  );

  const confirm = useCallback(
    (title: string, options?: { message?: string; confirmLabel?: string; cancelLabel?: string }) =>
      open({ kind: "confirm", title, ...options }) as Promise<boolean>,
    [open],
  );

  const alert = useCallback(
    (title: string, options?: { message?: string; confirmLabel?: string }) =>
      open({ kind: "alert", title, ...options }).then(() => undefined),
    [open],
  );

  const host = request ? <InAppDialogHost lang={lang} request={request} onClose={close} /> : null;
  return { prompt, confirm, alert, host };
}

function InAppDialogHost({
  lang,
  request,
  onClose,
}: {
  lang: Language;
  request: DialogRequest;
  onClose: (value: string | boolean | null) => void;
}) {
  const text = labels(lang);
  const [value, setValue] = useState(request.initialValue || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const isPrompt = request.kind === "prompt";
  const isAlert = request.kind === "alert";

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(isAlert ? true : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAlert, onClose]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isPrompt) onClose(value);
    else onClose(true);
  };

  return createPortal(
    <div className="df-dialog-overlay" role="presentation" onMouseDown={() => onClose(isAlert ? true : null)}>
      <section
        className="df-dialog"
        role={isAlert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="df-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <h2 id="df-dialog-title">{request.title}</h2>
          {request.message && <p>{request.message}</p>}
          {isPrompt && (
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={request.placeholder}
            />
          )}
          <div className="df-dialog-actions">
            {!isAlert && (
              <button type="button" className="df-dialog-secondary" onClick={() => onClose(null)}>
                {request.cancelLabel || text.cancel}
              </button>
            )}
            <button type="submit" className="df-dialog-primary">
              {request.confirmLabel || (isAlert ? text.ok : text.confirm)}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
