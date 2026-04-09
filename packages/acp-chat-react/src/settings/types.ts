import type { SessionController } from "@harms-haus/acp-chat-core";
import type { SessionItem } from "../session-list/types.js";

/**
 * Represents an ACP mode option
 */
export interface AcpMode {
  id: string;
  name: string;
  description?: string;
}

/**
 * Represents an ACP model option
 */
export interface AcpModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
}

/**
 * Props for the SettingsPanel component
 */
export interface SettingsPanelProps {
  /** Session controller for fetching sessions */
  controller?: SessionController;
  /** Currently selected mode ID */
  selectedModeId?: string | undefined;
  /** Currently selected model ID */
  selectedModelId?: string | undefined;
  /** Currently selected session ID */
  selectedSessionId?: string | undefined;
  /** Callback when mode changes */
  onModeChange?: (mode: AcpMode) => void;
  /** Callback when model changes */
  onModelChange?: (model: AcpModel) => void;
  /** Callback when session changes */
  onSessionChange?: (session: SessionItem) => void;
  /** Available modes (optional - uses defaults if not provided) */
  modes?: AcpMode[];
  /** Available models (optional - uses defaults if not provided) */
  models?: AcpModel[];
  /** Available sessions (optional - fetched from controller if not provided) */
  sessions?: SessionItem[];
  /** Whether the panel is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Custom renderer for the settings row */
  renderSettingsRow?: (props: SettingsRowRenderProps) => React.ReactNode;
}

/**
 * Props passed to custom settings row render function
 */
export interface SettingsRowRenderProps {
  /** Available modes */
  modes: AcpMode[];
  /** Available models */
  models: AcpModel[];
  /** Available sessions */
  sessions: SessionItem[];
  /** Currently selected mode ID */
  selectedModeId: string | undefined;
  /** Currently selected model ID */
  selectedModelId: string | undefined;
  /** Currently selected session ID */
  selectedSessionId: string | undefined;
  /** Callback when mode changes */
  onModeChange: (mode: AcpMode) => void;
  /** Callback when model changes */
  onModelChange: (model: AcpModel) => void;
  /** Callback when session changes */
  onSessionChange: (session: SessionItem) => void;
  /** Whether the settings are disabled */
  disabled: boolean;
}

/**
 * State for the settings panel
 */
export interface SettingsPanelState {
  /** Available modes */
  modes: AcpMode[];
  /** Available models */
  models: AcpModel[];
  /** Available sessions */
  sessions: SessionItem[];
  /** Currently selected mode */
  selectedMode: AcpMode | null;
  /** Currently selected model */
  selectedModel: AcpModel | null;
  /** Currently selected session */
  selectedSession: SessionItem | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Actions for the settings panel
 */
export interface SettingsPanelActions {
  /** Set the selected mode */
  setMode: (mode: AcpMode) => void;
  /** Set the selected model */
  setModel: (model: AcpModel) => void;
  /** Set the selected session */
  setSession: (session: SessionItem) => void;
  /** Refresh the available sessions */
  refreshSessions: () => Promise<void>;
  /** Clear any error */
  clearError: () => void;
}

/**
 * Default ACP modes
 */
export const DEFAULT_ACP_MODES: AcpMode[] = [
  { id: "proxy", name: "Proxy", description: "Connect to a live ACP agent" },
  { id: "replay", name: "Replay", description: "Replay a recorded session" },
];

/**
 * Default ACP models (placeholder - these would typically come from the server)
 */
export const DEFAULT_ACP_MODELS: AcpModel[] = [
  { id: "gpt-4", name: "GPT-4", description: "OpenAI GPT-4 model", provider: "openai" },
  { id: "gpt-4o", name: "GPT-4o", description: "OpenAI GPT-4o model", provider: "openai" },
  { id: "claude-3", name: "Claude 3", description: "Anthropic Claude 3 model", provider: "anthropic" },
];

/**
 * Base interface for settings select options
 */
export interface SettingsSelectOption {
  id: string;
  name: string;
  description?: string;
}

/**
 * Props for the SettingsSelect component
 */
export interface SettingsSelectProps<T extends SettingsSelectOption> {
  /** Currently selected value */
  value: T | null;
  /** Available options */
  options: T[];
  /** Callback when selection changes */
  onChange: (option: T) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** HTML id for the select */
  id?: string;
  /** Data attribute identifier for testing */
  "data-acp-id"?: string;
}

/**
 * Props for the SettingsCheckbox component
 */
export interface SettingsCheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback when checked state changes */
  onChange: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text shown below label */
  description?: string;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** HTML id for the checkbox */
  id?: string;
  /** Data attribute identifier for testing */
  "data-acp-id"?: string;
}

/**
 * Props for the SettingsSwitch component
 */
export interface SettingsSwitchProps {
  /** Whether the switch is on */
  checked: boolean;
  /** Callback when switch state changes */
  onChange: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text shown below label */
  description?: string;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
  /** HTML id for the switch */
  id?: string;
  /** Data attribute identifier for testing */
  "data-acp-id"?: string;
}

/**
 * Props for individual tab items in SettingsTabs
 */
export interface SettingsTabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

/**
 * Props for the SettingsTabs component
 */
export interface SettingsTabsProps {
  /** Tab items to display */
  tabs: SettingsTabItem[];
  /** Currently active tab ID */
  activeTabId: string;
  /** Callback when tab changes */
  onChange: (tabId: string) => void;
  /** Additional CSS class */
  className?: string;
  /** Data attribute identifier for testing */
  "data-acp-id"?: string;
}
