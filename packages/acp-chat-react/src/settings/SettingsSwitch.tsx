import { memo, useCallback } from "react";
import { Switch } from "@base-ui-components/react/switch";
import type { SettingsSwitchProps } from "./types.js";

function SettingsSwitchInner({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = "",
  id,
  "data-acp-id": dataAcpId,
}: SettingsSwitchProps) {
  const handleCheckedChange = useCallback(
    (newChecked: boolean) => {
      onChange(newChecked);
    },
    [onChange]
  );

  return (
    <div
      data-acp-settings-switch={dataAcpId ?? id}
      data-acp-settings-switch-checked={checked}
      data-acp-settings-switch-disabled={disabled}
      className={`acp-settings-switch ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {label && (
          <label
            htmlFor={id}
            data-acp-settings-switch-label
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
            data-acp-settings-switch-description
            style={{
              fontSize: "12px",
              color: "var(--acp-muted, #666)",
            }}
          >
            {description}
          </span>
        )}
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "12px",
          border: "none",
          backgroundColor: checked
            ? "var(--acp-accent, #0066cc)"
            : "var(--acp-border, #ccc)",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          transition: "background-color 150ms ease",
        }}
      >
        <Switch.Thumb
          style={{
            display: "block",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: "var(--acp-bg, #fff)",
            position: "absolute",
            top: "3px",
            left: checked ? "23px" : "3px",
            transition: "left 150ms ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </Switch.Root>
    </div>
  );
}

export const SettingsSwitch = memo(SettingsSwitchInner);
SettingsSwitch.displayName = "SettingsSwitch";
