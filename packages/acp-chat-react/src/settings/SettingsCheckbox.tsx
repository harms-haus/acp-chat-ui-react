import { memo, useCallback } from "react";
import { Checkbox } from "@base-ui-components/react/checkbox";
import type { SettingsCheckboxProps } from "./types.js";

function SettingsCheckboxInner({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
  id,
  "data-acp-id": dataAcpId,
}: SettingsCheckboxProps) {
  const handleCheckedChange = useCallback(
    (newChecked: boolean) => {
      onChange(newChecked);
    },
    [onChange]
  );

  return (
    <div
      data-acp-settings-checkbox={dataAcpId ?? id}
      data-acp-settings-checkbox-checked={checked}
      data-acp-settings-checkbox-disabled={disabled}
      className={`acp-settings-checkbox ${className}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "18px",
          height: "18px",
          borderRadius: "3px",
          border: "1px solid var(--acp-border, #ccc)",
          backgroundColor: checked
            ? "var(--acp-accent, #0066cc)"
            : "var(--acp-bg, #fff)",
          color: "var(--acp-bg, #fff)",
          cursor: disabled ? "not-allowed" : "pointer",
          flexShrink: 0,
          marginTop: "2px",
        }}
      >
        <Checkbox.Indicator
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {label && (
          <label
            htmlFor={id}
            data-acp-settings-checkbox-label
            style={{
              fontSize: "14px",
              color: "var(--acp-text, #000)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {label}
          </label>
        )}
        {description && (
          <span
            data-acp-settings-checkbox-description
            style={{
              fontSize: "12px",
              color: "var(--acp-muted, #666)",
            }}
          >
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

export const SettingsCheckbox = memo(SettingsCheckboxInner);
SettingsCheckbox.displayName = "SettingsCheckbox";
