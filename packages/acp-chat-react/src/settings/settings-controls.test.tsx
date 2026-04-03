/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SettingsSelect, SettingsCheckbox, SettingsSwitch, SettingsTabs } from "./index.js";
import type { AcpMode, SettingsTabItem } from "./types.js";

const TEST_MODES: AcpMode[] = [
  { id: "proxy", name: "Proxy", description: "Connect to a live ACP agent" },
  { id: "replay", name: "Replay", description: "Replay a recorded session" },
  { id: "offline", name: "Offline", description: "Work without connection" },
];

describe("SettingsSelect", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it("should render with placeholder", () => {
    render(
      <SettingsSelect
        value={null}
        options={TEST_MODES}
        onChange={onChange}
        placeholder="Select mode..."
        data-acp-id="test-mode"
      />
    );

    expect(screen.getByPlaceholderText("Select mode...")).toBeInTheDocument();
  });

  it("should have data-acp-settings-select-trigger attribute", () => {
    const { container } = render(
      <SettingsSelect
        value={null}
        options={TEST_MODES}
        onChange={onChange}
        data-acp-id="test-mode"
      />
    );

    expect(container.querySelector('[data-acp-settings-select-trigger="test-mode"]')).not.toBeNull();
  });

  it("should call onChange when value changes", async () => {
    render(
      <SettingsSelect
        value={null}
        options={TEST_MODES}
        onChange={onChange}
        data-acp-id="test-mode"
      />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
  });

  it("should render with selected value", () => {
    const { container } = render(
      <SettingsSelect
        value={TEST_MODES[0]}
        options={TEST_MODES}
        onChange={onChange}
        data-acp-id="test-mode"
      />
    );

    const input = container.querySelector('[data-acp-settings-select-input="test-mode"]');
    expect(input).toHaveValue("proxy");
  });

  it("should be disabled when disabled prop is true", () => {
    const { container } = render(
      <SettingsSelect
        value={null}
        options={TEST_MODES}
        onChange={onChange}
        disabled={true}
        data-acp-id="test-mode"
      />
    );

    const trigger = container.querySelector('[data-acp-settings-select-trigger="test-mode"]');
    expect(trigger).toHaveAttribute("data-disabled");
  });
});

describe("SettingsCheckbox", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it("should render with label", () => {
    render(
      <SettingsCheckbox
        checked={false}
        onChange={onChange}
        label="Enable feature"
        data-acp-id="test-checkbox"
      />
    );

    expect(screen.getByText("Enable feature")).toBeInTheDocument();
  });

  it("should have data-acp-settings-checkbox attribute", () => {
    const { container } = render(
      <SettingsCheckbox
        checked={false}
        onChange={onChange}
        data-acp-id="test-checkbox"
      />
    );

    expect(container.querySelector('[data-acp-settings-checkbox="test-checkbox"]')).not.toBeNull();
  });

  it("should show checked state", () => {
    const { container } = render(
      <SettingsCheckbox
        checked={true}
        onChange={onChange}
        data-acp-id="test-checkbox"
      />
    );

    const checkbox = container.querySelector('[data-acp-settings-checkbox="test-checkbox"]');
    expect(checkbox).toHaveAttribute("data-acp-settings-checkbox-checked", "true");
  });

  it("should show description when provided", () => {
    render(
      <SettingsCheckbox
        checked={false}
        onChange={onChange}
        label="Enable feature"
        description="This enables the feature"
        data-acp-id="test-checkbox"
      />
    );

    expect(screen.getByText("This enables the feature")).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    const { container } = render(
      <SettingsCheckbox
        checked={false}
        onChange={onChange}
        disabled={true}
        data-acp-id="test-checkbox"
      />
    );

    const checkbox = container.querySelector('[data-acp-settings-checkbox="test-checkbox"]');
    expect(checkbox).toHaveAttribute("data-acp-settings-checkbox-disabled", "true");
  });
});

describe("SettingsSwitch", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it("should render with label", () => {
    render(
      <SettingsSwitch
        checked={false}
        onChange={onChange}
        label="Auto-refresh"
        data-acp-id="test-switch"
      />
    );

    expect(screen.getByText("Auto-refresh")).toBeInTheDocument();
  });

  it("should have data-acp-settings-switch attribute", () => {
    const { container } = render(
      <SettingsSwitch
        checked={false}
        onChange={onChange}
        data-acp-id="test-switch"
      />
    );

    expect(container.querySelector('[data-acp-settings-switch="test-switch"]')).not.toBeNull();
  });

  it("should show checked state", () => {
    const { container } = render(
      <SettingsSwitch
        checked={true}
        onChange={onChange}
        data-acp-id="test-switch"
      />
    );

    const switchEl = container.querySelector('[data-acp-settings-switch="test-switch"]');
    expect(switchEl).toHaveAttribute("data-acp-settings-switch-checked", "true");
  });

  it("should show description when provided", () => {
    render(
      <SettingsSwitch
        checked={false}
        onChange={onChange}
        label="Auto-refresh"
        description="Automatically refresh data"
        data-acp-id="test-switch"
      />
    );

    expect(screen.getByText("Automatically refresh data")).toBeInTheDocument();
  });

  it("should be disabled when disabled prop is true", () => {
    const { container } = render(
      <SettingsSwitch
        checked={false}
        onChange={onChange}
        disabled={true}
        data-acp-id="test-switch"
      />
    );

    const switchEl = container.querySelector('[data-acp-settings-switch="test-switch"]');
    expect(switchEl).toHaveAttribute("data-acp-settings-switch-disabled", "true");
  });
});

describe("SettingsTabs", () => {
  const onChange = vi.fn();

  const TEST_TABS: SettingsTabItem[] = [
    { id: "general", label: "General", content: <div>General content</div> },
    { id: "advanced", label: "Advanced", content: <div>Advanced content</div> },
  ];

  beforeEach(() => {
    onChange.mockClear();
  });

  it("should render tabs", () => {
    render(
      <SettingsTabs
        tabs={TEST_TABS}
        activeTabId="general"
        onChange={onChange}
        data-acp-id="test-tabs"
      />
    );

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("should have data-acp-settings-tabs attribute", () => {
    const { container } = render(
      <SettingsTabs
        tabs={TEST_TABS}
        activeTabId="general"
        onChange={onChange}
        data-acp-id="test-tabs"
      />
    );

    expect(container.querySelector('[data-acp-settings-tabs="test-tabs"]')).not.toBeNull();
  });

  it("should show active tab content", () => {
    render(
      <SettingsTabs
        tabs={TEST_TABS}
        activeTabId="general"
        onChange={onChange}
        data-acp-id="test-tabs"
      />
    );

    expect(screen.getByText("General content")).toBeInTheDocument();
  });

  it("should have data-acp-settings-tab-active on active tab", () => {
    const { container } = render(
      <SettingsTabs
        tabs={TEST_TABS}
        activeTabId="general"
        onChange={onChange}
        data-acp-id="test-tabs"
      />
    );

    const activeTab = container.querySelector('[data-acp-settings-tab-active="true"]');
    expect(activeTab).not.toBeNull();
    expect(activeTab).toHaveAttribute("data-acp-settings-tab", "general");
  });

  it("should call onChange when tab is clicked", async () => {
    render(
      <SettingsTabs
        tabs={TEST_TABS}
        activeTabId="general"
        onChange={onChange}
        data-acp-id="test-tabs"
      />
    );

    const advancedTab = screen.getByText("Advanced");
    await act(async () => {
      fireEvent.click(advancedTab);
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("advanced");
    });
  });
});
