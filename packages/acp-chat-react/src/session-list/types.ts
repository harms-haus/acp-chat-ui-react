import type { SessionController } from "@acp/chat-core";

/**
 * Represents a session item returned from SessionController.listSessions()
 */
export interface SessionItem {
  sessionId: string;
  cwd: string;
  title?: string;
  updatedAt?: string;
  _meta?: unknown;
}

/**
 * Props for the SessionList component
 */
export interface SessionListProps {
  /** Session controller instance for fetching and loading sessions */
  controller: SessionController;
  /** Current working directory filter (optional) */
  cwd?: string;
  /** Callback when a session is selected */
  onSessionSelect?: (session: SessionItem) => void;
  /** Callback when a session is loaded successfully */
  onSessionLoaded?: ((session: SessionItem) => void) | undefined;
  /** Callback when loading fails */
  onSessionLoadError?: ((error: Error, session: SessionItem) => void) | undefined;
  /** Additional CSS class name */
  className?: string;
  /** Custom render function for session items */
  renderSessionItem?: (props: SessionItemRenderProps) => React.ReactNode;
  /** Whether to auto-fetch sessions on mount */
  autoFetch?: boolean;
  /** Placeholder text when no sessions */
  emptyText?: string;
  /** Placeholder text when loading */
  loadingText?: string;
  /** Text for the load button */
  loadButtonText?: string;
  /** Inline styles for the container */
  style?: React.CSSProperties;
}

/**
 * Props passed to custom session item render function
 */
export interface SessionItemRenderProps {
  session: SessionItem;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onLoad: () => void;
}

/**
 * State for the session list
 */
export interface SessionListState {
  sessions: SessionItem[];
  selectedSessionId: string | null;
  isLoading: boolean;
  isLoadingSession: boolean;
  error: string | null;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Actions for the session list
 */
export interface SessionListActions {
  fetchSessions: (cursor?: string) => Promise<void>;
  selectSession: (sessionId: string) => void;
  loadSession: (session: SessionItem) => Promise<void>;
  clearError: () => void;
}
