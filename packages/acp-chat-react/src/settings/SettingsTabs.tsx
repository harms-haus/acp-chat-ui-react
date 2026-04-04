import { memo, useCallback } from "react";
import { Tabs } from "@base-ui-components/react/tabs";
import type { SettingsTabsProps } from "./types.js";

function SettingsTabsInner({
  tabs,
  activeTabId,
  onChange,
  className = "",
  "data-acp-id": dataAcpId,
}: SettingsTabsProps) {
  const handleValueChange = useCallback(
    (value: string | null) => {
      if (value !== null) {
        onChange(value);
      }
    },
    [onChange]
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div
      data-acp-settings-tabs={dataAcpId}
      data-acp-settings-tabs-active={activeTabId}
      className={`acp-settings-tabs ${className}`}
    >
      <Tabs.Root value={activeTabId} onValueChange={handleValueChange}>
        <Tabs.List
          data-acp-settings-tabs-list
          className="acp-settings-tabs__list"
        >
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              data-acp-settings-tab={tab.id}
              data-acp-settings-tab-active={tab.id === activeTabId}
              data-acp-settings-tab-disabled={tab.disabled}
              className={`acp-settings-tabs__tab ${
                tab.id === activeTabId ? "acp-settings-tabs__tab--active" : ""
              } ${tab.disabled ? "acp-settings-tabs__tab--disabled" : ""}`}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {activeTab && (
          <Tabs.Panel
            value={activeTabId}
            data-acp-settings-tab-panel={activeTabId}
            className="acp-settings-tabs__panel"
          >
            {activeTab.content}
          </Tabs.Panel>
        )}
      </Tabs.Root>
    </div>
  );
}

export const SettingsTabs = memo(SettingsTabsInner);
SettingsTabs.displayName = "SettingsTabs";
