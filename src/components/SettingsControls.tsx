import React, { type ReactNode } from "react";

/**
 * SettingsControls — the unified setting-row primitive system for the NavoPath
 * settings page. Every setting item in every section must be rendered through
 * these components so the visual rhythm, borders, typography, and interaction
 * states stay consistent. No section should hand-roll its own label + control
 * markup.
 *
 * Visual language follows NavoPathStyle.md: paper-like surfaces, fine rules,
 * restrained annotation color, no dashboard feel, no hover lift, no glow.
 *
 * Exported primitives:
 *   - SettingSection      (titled group with optional description)
 *   - SettingRow          (title + description + control slot, single fine rule)
 *   - SettingToggle       (checkbox-style toggle, ink + accent rule)
 *   - SettingSelect       (native select styled as paper control)
 *   - SettingNumberInput  (number input with optional min/max/step)
 *   - SettingTextInput    (text input)
 *   - SettingActionButton (secondary or danger action button)
 *   - SettingDivider      (fine rule between groups)
 *   - SettingComingSoon   (disabled placeholder row for unimplemented settings)
 *   - SettingDescription  (small muted description text)
 */

export function SettingSection({
  title,
  description,
  children,
  tone = "normal",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  tone?: "normal" | "danger";
}) {
  return (
    <section className={`df-settings-group${tone === "danger" ? " df-settings-group--danger" : ""}`}>
      <header className="df-settings-group-head">
        <h3 className="df-settings-group-title">{title}</h3>
        {description ? <p className="df-settings-group-desc">{description}</p> : null}
      </header>
      <div className="df-settings-group-body">{children}</div>
    </section>
  );
}

export function SettingRow({
  title,
  description,
  control,
  disabled,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="df-settings-row" data-disabled={disabled ? "true" : undefined}>
      <div className="df-settings-row-label">
        <span className="df-settings-row-title">{title}</span>
        {description ? <span className="df-settings-row-desc">{description}</span> : null}
      </div>
      <div className="df-settings-row-control">{control ?? children}</div>
    </div>
  );
}

export function SettingToggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`df-settings-toggle${checked ? " is-on" : ""}`}
      data-state={checked ? "on" : "off"}
      data-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="df-settings-toggle-knob" />
    </button>
  );
}

export function SettingSelect<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: ReactNode }[];
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      className="df-settings-select"
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label as any}
        </option>
      ))}
    </select>
  );
}

export function SettingNumberInput({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  ariaLabel,
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  suffix?: ReactNode;
}) {
  return (
    <span className="df-settings-number-wrap">
      <input
        type="number"
        className="df-settings-number df-utility-input"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix ? <span className="df-settings-number-suffix">{suffix}</span> : null}
    </span>
  );
}

export function SettingTextInput({
  value,
  onChange,
  disabled,
  ariaLabel,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  type?: "text" | "password" | "time" | "email";
}) {
  return (
    <input
      type={type}
      className="df-settings-input df-utility-input"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SettingActionButton({
  children,
  onClick,
  disabled,
  tone = "secondary",
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "secondary" | "primary" | "danger";
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={`df-settings-action df-settings-action--${tone}`}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function SettingDivider() {
  return <hr className="df-settings-divider" />;
}

export function SettingComingSoon({
  title,
  description,
  note = "即将支持",
}: {
  title: ReactNode;
  description?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="df-settings-row df-settings-row--coming-soon" data-disabled="true">
      <div className="df-settings-row-label">
        <span className="df-settings-row-title">{title}</span>
        {description ? <span className="df-settings-row-desc">{description}</span> : null}
      </div>
      <div className="df-settings-row-control">
        <span className="df-settings-coming-soon-tag">{note}</span>
      </div>
    </div>
  );
}

export function SettingDescription({ children }: { children: ReactNode }) {
  return <p className="df-settings-group-desc">{children}</p>;
}
