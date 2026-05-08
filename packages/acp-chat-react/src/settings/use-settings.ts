import { useState, useCallback, useEffect, useMemo } from "react";
import type { SessionController, ConfigOption } from "@harms-haus/acp-chat-core";
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

function extractModesFromConfigOptions(configOptions: ConfigOption[] | null | undefined): AcpMode[] {
  if (!configOptions) return [];
  const modeOption = configOptions.find(opt => opt.category === "mode" || opt.id === "mode");
  if (!modeOption) return [];
  return modeOption.options.map(opt => ({
    id: opt.value,
    name: opt.name,
    ...(opt.description && { description: opt.description }),
  }));
}

function extractModelsFromConfigOptions(configOptions: ConfigOption[] | null | undefined): AcpModel[] {
  if (!configOptions) return [];
  const modelOption = configOptions.find(opt => opt.category === "model" || opt.id === "model");
  if (!modelOption) return [];
  return modelOption.options.map(opt => ({
    id: opt.value,
    name: opt.name,
    ...(opt.description && { description: opt.description }),
  }));
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

  const [configOptions, setConfigOptions] = useState<ConfigOption[] | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>(providedSessions ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modesFromConfig = useMemo(() => extractModesFromConfigOptions(configOptions), [configOptions]);
  const modelsFromConfig = useMemo(() => extractModelsFromConfigOptions(configOptions), [configOptions]);
  
  const modes = useMemo(() => {
    if (providedModes) return providedModes;
    const extracted = configOptions ? modesFromConfig : [];
    return extracted.length > 0 ? extracted : DEFAULT_ACP_MODES;
  }, [providedModes, configOptions, modesFromConfig]);
  const models = useMemo(() => {
    if (providedModels) return providedModels;
    const extracted = configOptions ? modelsFromConfig : [];
    return extracted.length > 0 ? extracted : DEFAULT_ACP_MODELS;
  }, [providedModels, configOptions, modelsFromConfig]);

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

  useEffect(() => {
    if (!controller) return;
    
    const unsubConfig = controller.on("configOptionsChange", (newConfigOptions) => {
      setConfigOptions(newConfigOptions);
    });
    
    if (typeof controller.getConfigOptions === 'function') {
      const currentConfig = controller.getConfigOptions();
      if (currentConfig) {
        setConfigOptions(currentConfig);
      }
    }
    
    return () => {
      unsubConfig();
    };
  }, [controller]);

  const refreshSessions = useCallback(async () => {
    if (!controller || typeof controller.listSessions !== "function") {
      setIsLoading(false);
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
