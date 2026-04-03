import { useState, useCallback, useEffect, useMemo } from "react";
import type { SessionController } from "@acp/chat-core";
import type { AcpMode, AcpModel, SettingsPanelState, SettingsPanelActions } from "./types.js";
import type { SessionItem } from "../session-list/types.js";
import { DEFAULT_ACP_MODES, DEFAULT_ACP_MODELS } from "./types.js";

export interface UseSettingsOptions {
  controller?: SessionController | undefined;
  initialModeId?: string | undefined;
  initialModelId?: string | undefined;
  initialSessionId?: string | undefined;
  modes?: AcpMode[] | undefined;
  models?: AcpModel[] | undefined;
  sessions?: SessionItem[] | undefined;
}

export interface UseSettingsReturn {
  state: SettingsPanelState;
  actions: SettingsPanelActions;
}

export function useSettings(options: UseSettingsOptions = {}): UseSettingsReturn {
  const {
    controller,
    initialModeId,
    initialModelId,
    initialSessionId,
    modes: providedModes,
    models: providedModels,
    sessions: providedSessions,
  } = options;

  const modes = useMemo(() => providedModes ?? DEFAULT_ACP_MODES, [providedModes]);
  const models = useMemo(() => providedModels ?? DEFAULT_ACP_MODELS, [providedModels]);

  const initialMode = useMemo(
    () => modes.find((m) => m.id === initialModeId) ?? null,
    [modes, initialModeId]
  );
  const initialModel = useMemo(
    () => models.find((m) => m.id === initialModelId) ?? null,
    [models, initialModelId]
  );

  const [selectedMode, setSelectedMode] = useState<AcpMode | null>(initialMode);
  const [selectedModel, setSelectedModel] = useState<AcpModel | null>(initialModel);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>(providedSessions ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providedSessions) {
      setSessions(providedSessions);
    }
  }, [providedSessions]);

  useEffect(() => {
    if (initialSessionId && sessions.length > 0) {
      const session = sessions.find((s) => s.sessionId === initialSessionId);
      if (session) {
        setSelectedSession(session);
      }
    }
  }, [initialSessionId, sessions]);

  const refreshSessions = useCallback(async () => {
    if (!controller || typeof controller.listSessions !== "function") {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await controller.listSessions();
      setSessions(result.sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch sessions";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [controller]);

  useEffect(() => {
    if (controller && !providedSessions) {
      refreshSessions();
    }
  }, [controller, providedSessions, refreshSessions]);

  const handleSetMode = useCallback((mode: AcpMode) => {
    setSelectedMode(mode);
  }, []);

  const handleSetModel = useCallback((model: AcpModel) => {
    setSelectedModel(model);
  }, []);

  const handleSetSession = useCallback((session: SessionItem) => {
    setSelectedSession(session);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const state: SettingsPanelState = {
    modes,
    models,
    sessions,
    selectedMode,
    selectedModel,
    selectedSession,
    isLoading,
    error,
  };

  const actions: SettingsPanelActions = {
    setMode: handleSetMode,
    setModel: handleSetModel,
    setSession: handleSetSession,
    refreshSessions,
    clearError,
  };

  return { state, actions };
}
