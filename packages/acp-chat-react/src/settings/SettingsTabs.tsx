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
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <Tabs.Root value={activeTabId} onValueChange={handleValueChange}>
        <Tabs.List
          data-acp-settings-tabs-list
          style={{
            display: "flex",
            borderBottom: "1px solid var(--acp-border, #ccc)",
            gap: "4px",
          }}
        >
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              data-acp-settings-tab={tab.id}
              data-acp-settings-tab-active={tab.id === activeTabId}
              data-acp-settings-tab-disabled={tab.disabled}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                border: "none",
                background: "transparent",
                color:
                  tab.id === activeTabId
                    ? "var(--acp-accent, #0066cc)"
                    : "var(--acp-text, #000)",
                borderBottom:
                  tab.id === activeTabId
                    ? "2px solid var(--acp-accent, #0066cc)"
                    : "2px solid transparent",
                cursor: tab.disabled ? "not-allowed" : "pointer",
                opacity: tab.disabled ? 0.5 : 1,
                fontWeight: tab.id === activeTabId ? 600 : 400,
              }}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {activeTab && (
          <Tabs.Panel
            value={activeTabId}
            data-acp-settings-tab-panel={activeTabId}
            style={{
              padding: "16px",
            }}
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
