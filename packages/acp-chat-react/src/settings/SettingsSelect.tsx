import { memo, useCallback, useMemo } from "react";
import { Combobox } from "@base-ui-components/react/combobox";
import { Tooltip } from "@base-ui-components/react/tooltip";
import type { SettingsSelectProps, SettingsSelectOption } from "./types.js";

function SettingsSelectInner<T extends SettingsSelectOption>({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  id,
  "data-acp-id": dataAcpId,
}: SettingsSelectProps<T>) {
  const selectedValue = value?.id ?? "";

  const handleValueChange = useCallback(
    (newValue: string | null) => {
      if (newValue === null) return;
      const option = options.find((o: T) => o.id === newValue);
      if (option) {
        onChange(option);
      }
    },
    [options, onChange]
  );

  const selectedOption = useMemo(
    () => options.find((o) => o.id === selectedValue),
    [options, selectedValue]
  );

  return (
    <Combobox.Root
      value={selectedValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <Combobox.Trigger
        data-acp-settings-select-trigger={dataAcpId ?? id}
        className={`acp-settings-select-trigger ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "6px 10px",
          borderRadius: "4px",
          border: "1px solid var(--acp-border, #ccc)",
          backgroundColor: "var(--acp-bg, #fff)",
          color: "var(--acp-text, #000)",
          fontSize: "13px",
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: "120px",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Combobox.Input
          data-acp-settings-select-input={dataAcpId ?? id}
          placeholder={placeholder}
          style={{
            border: "none",
            background: "transparent",
            color: "inherit",
            fontSize: "inherit",
            width: "100%",
            outline: "none",
          }}
        />
        <Combobox.Icon>▼</Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup
            data-acp-settings-select-popup={dataAcpId ?? id}
            style={{
              backgroundColor: "var(--acp-bg, #fff)",
              border: "1px solid var(--acp-border, #ccc)",
              borderRadius: "4px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              maxHeight: "200px",
              overflow: "auto",
            }}
          >
            <Combobox.List>
              {options.map((option) => (
                <Tooltip.Root key={option.id}>
                  <Tooltip.Trigger
                    render={
                      <Combobox.Item
                        data-acp-settings-select-item={dataAcpId ?? id}
                        data-acp-settings-select-item-value={option.id}
                        value={option.id}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                        {option.name}
                      </Combobox.Item>
                    }
                  />
                  {option.description && (
                    <Tooltip.Portal>
                      <Tooltip.Positioner>
                        <Tooltip.Popup
                          style={{
                            backgroundColor: "var(--acp-text, #000)",
                            color: "var(--acp-bg, #fff)",
                            padding: "6px 10px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            maxWidth: "200px",
                          }}
                        >
                          {option.description}
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  )}
                </Tooltip.Root>
              ))}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export const SettingsSelect = memo(SettingsSelectInner) as <T extends SettingsSelectOption>(
  props: SettingsSelectProps<T>
) => React.ReactElement;
(SettingsSelect as React.NamedExoticComponent<unknown>).displayName = "SettingsSelect";
