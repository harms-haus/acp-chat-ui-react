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

  const _selectedOption = useMemo(
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
      className={`acp-settings-select-trigger ${disabled ? "acp-settings-select-trigger--disabled" : ""} ${className}`}
    >
      <Combobox.Input
        data-acp-settings-select-input={dataAcpId ?? id}
        placeholder={placeholder}
        className="acp-settings-select__input"
      />
        <Combobox.Icon>▼</Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner>
      <Combobox.Popup
        data-acp-settings-select-popup={dataAcpId ?? id}
        className="acp-settings-select__popup"
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
                className="acp-settings-select__item"
              >
                        <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                        {option.name}
                      </Combobox.Item>
                    }
                  />
              {option.description && (
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup className="acp-settings-select__tooltip">
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
