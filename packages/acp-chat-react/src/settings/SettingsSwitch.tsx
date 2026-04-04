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
      className={`acp-settings-switch ${disabled ? "acp-settings-switch--disabled" : ""} ${className}`}
    >
      <div className="acp-settings-switch__label-container">
      {label && (
        <label
          htmlFor={id}
          data-acp-settings-switch-label
          className={`acp-settings-switch__label ${disabled ? "acp-settings-switch__label--disabled" : ""}`}
        >
          {label}
        </label>
      )}
      {description && (
        <span
          data-acp-settings-switch-description
          className="acp-settings-switch__description"
        >
          {description}
        </span>
      )}
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        className={`acp-settings-switch__root ${checked ? "acp-settings-switch__root--checked" : ""} ${disabled ? "acp-settings-switch__root--disabled" : ""}`}
      >
        <Switch.Thumb
          data-acp-settings-switch-thumb-position={checked ? "right" : "left"}
          className={`acp-settings-switch__thumb ${checked ? "acp-settings-switch__thumb--checked" : ""}`}
        />
      </Switch.Root>
    </div>
  );
}

export const SettingsSwitch = memo(SettingsSwitchInner);
SettingsSwitch.displayName = "SettingsSwitch";
