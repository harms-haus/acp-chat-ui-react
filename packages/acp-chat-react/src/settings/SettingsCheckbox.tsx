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
      className={`acp-settings-checkbox ${disabled ? "acp-settings-checkbox--disabled" : ""} ${className}`}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        className={`acp-settings-checkbox__root ${checked ? "acp-settings-checkbox__root--checked" : ""} ${disabled ? "acp-settings-checkbox__root--disabled" : ""}`}
      >
        <Checkbox.Indicator className="acp-settings-checkbox__indicator">
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
      <div className="acp-settings-checkbox__label-container">
      {label && (
        <label
          htmlFor={id}
          data-acp-settings-checkbox-label
          className={`acp-settings-checkbox__label ${disabled ? "acp-settings-checkbox__label--disabled" : ""}`}
        >
          {label}
        </label>
      )}
      {description && (
        <span
          data-acp-settings-checkbox-description
          className="acp-settings-checkbox__description"
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
