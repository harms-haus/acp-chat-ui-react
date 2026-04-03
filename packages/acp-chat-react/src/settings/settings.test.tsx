/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel.js";
import { useSettings } from "./use-settings.js";
import { DEFAULT_ACP_MODES, DEFAULT_ACP_MODELS } from "./types.js";
import type { SessionController, SessionControllerState } from "@acp/chat-core";
import type { SessionItem } from "../session-list/types.js";
import type { AcpMode, AcpModel } from "./types.js";

const createMockController = (
  overrides: Partial<SessionController> = {}
): SessionController => {
  const mockState: SessionControllerState = {
    connectionStatus: "connected",
    bridgeStatus: "connected",
    sessionId: null,
    initialized: true,
    capabilities: {},
  };

  return {
    getState: () => mockState,
    on: vi.fn(() => () => {}),
    connect: vi.fn(),
    disconnect: vi.fn(),
    initialize: vi.fn(() => Promise.resolve({})),
    createSession: vi.fn(() => Promise.resolve({ sessionId: "test-session" })),
    listSessions: vi.fn(() =>
      Promise.resolve({
        sessions: [
          {
            sessionId: "session-1",
            cwd: "/home/user/project1",
            title: "Project 1 Session",
            updatedAt: "2026-03-28T10:00:00Z",
          },
          {
            sessionId: "session-2",
            cwd: "/home/user/project2",
            title: "Project 2 Session",
            updatedAt: "2026-03-28T11:00:00Z",
          },
        ],
        nextCursor: undefined,
      })
    ),
    loadSession: vi.fn(() => Promise.resolve({})),
    sendPrompt: vi.fn(() => Promise.resolve()),
    cancelPrompt: vi.fn(() => Promise.resolve()),
    ...overrides,
  } as unknown as SessionController;
};

describe("SettingsPanel", () => {
  let mockController: SessionController;

  beforeEach(() => {
    mockController = createMockController();
  });

  describe("rendering", () => {
    it("should render with interactive mode selector", () => {
      render(<SettingsPanel controller={mockController} />);

      expect(screen.getByPlaceholderText("Select mode...")).toBeInTheDocument();
    });

    it("should render with interactive model selector", () => {
      render(<SettingsPanel controller={mockController} />);

      expect(screen.getByPlaceholderText("Select model...")).toBeInTheDocument();
    });

    it("should render with interactive session selector", async () => {
      render(<SettingsPanel controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Select session...")).toBeInTheDocument();
      });
    });

    it("should have data-acp-settings-select-trigger attributes", () => {
      const { container } = render(<SettingsPanel controller={mockController} />);

      expect(container.querySelector('[data-acp-settings-select-trigger="mode"]')).not.toBeNull();
      expect(container.querySelector('[data-acp-settings-select-trigger="model"]')).not.toBeNull();
    });

    it("should render with custom modes and models", () => {
      const customModes: AcpMode[] = [
        { id: "custom-1", name: "Custom 1", description: "Custom mode 1" },
      ];
      const customModels: AcpModel[] = [
        { id: "model-1", name: "Model 1", description: "Custom model 1" },
      ];

      render(
        <SettingsPanel
          controller={mockController}
          modes={customModes}
          models={customModels}
        />
      );

      expect(screen.getByPlaceholderText("Select mode...")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Select model...")).toBeInTheDocument();
    });

    it("should show loading state", () => {
      const { container } = render(<SettingsPanel controller={mockController} />);

      expect(container.querySelector('[data-acp-settings-panel]')).toHaveAttribute(
        "data-acp-settings-loading"
      );
    });
  });

  describe("interactive selection", () => {
    it("should render interactive mode selector", () => {
      const { container } = render(
        <SettingsPanel
          controller={mockController}
          modes={DEFAULT_ACP_MODES}
        />
      );

      const modeTrigger = container.querySelector('[data-acp-settings-select-trigger="mode"]');
      expect(modeTrigger).not.toBeNull();
      expect(modeTrigger).toHaveAttribute("type", "button");
    });

    it("should render interactive model selector", () => {
      const { container } = render(
        <SettingsPanel
          controller={mockController}
          models={DEFAULT_ACP_MODELS}
        />
      );

      const modelTrigger = container.querySelector('[data-acp-settings-select-trigger="model"]');
      expect(modelTrigger).not.toBeNull();
      expect(modelTrigger).toHaveAttribute("type", "button");
    });

    it("should render interactive session selector", async () => {
      const sessions: SessionItem[] = [
        {
          sessionId: "session-1",
          cwd: "/home/user/project1",
          title: "Project 1",
          updatedAt: "2026-03-28T10:00:00Z",
        },
      ];

      const { container } = render(
        <SettingsPanel
          controller={mockController}
          sessions={sessions}
        />
      );

      await waitFor(() => {
        const sessionTrigger = container.querySelector('[data-acp-settings-select-trigger="session"]');
        expect(sessionTrigger).not.toBeNull();
      });
    });
  });

  describe("custom render", () => {
    it("should use custom renderSettingsRow when provided", () => {
      const customRender = vi.fn(() => (
        <div data-acp-settings-row="custom">Custom Settings Row</div>
      ));

      const { container } = render(
        <SettingsPanel controller={mockController} renderSettingsRow={customRender} />
      );

      expect(container.querySelector('[data-acp-settings-row="custom"]')).not.toBeNull();
      expect(screen.getByText("Custom Settings Row")).toBeInTheDocument();
    });

    it("should pass correct props to custom render", () => {
      const customRender = vi.fn(() => <div data-acp-settings-row>Custom</div>);
      const customModes: AcpMode[] = [{ id: "test", name: "Test Mode" }];
      const customModels: AcpModel[] = [{ id: "model-1", name: "Test Model" }];

      render(
        <SettingsPanel
          controller={mockController}
          modes={customModes}
          models={customModels}
          renderSettingsRow={customRender}
        />
      );

      expect(customRender).toHaveBeenCalled();
      const props = (customRender.mock.calls[0] as unknown[])[0] as { modes: AcpMode[]; models: AcpModel[] };
      expect(props.modes).toEqual(customModes);
      expect(props.models).toEqual(customModels);
    });
  });

  describe("data attributes", () => {
    it("should have data-acp-settings-panel attribute", () => {
      const { container } = render(<SettingsPanel controller={mockController} />);

      expect(container.querySelector("[data-acp-settings-panel]")).not.toBeNull();
    });

    it("should have data-acp-settings-row in default render", () => {
      const { container } = render(<SettingsPanel controller={mockController} />);

      expect(container.querySelector("[data-acp-settings-row]")).not.toBeNull();
    });

    it("should have data-acp-settings-select-input attributes", () => {
      const { container } = render(<SettingsPanel controller={mockController} />);

      expect(container.querySelector('[data-acp-settings-select-input="mode"]')).not.toBeNull();
      expect(container.querySelector('[data-acp-settings-select-input="model"]')).not.toBeNull();
    });
  });

  describe("disabled state", () => {
    it("should disable selectors when disabled prop is true", () => {
      const { container } = render(
        <SettingsPanel controller={mockController} disabled={true} />
      );

      const modeTrigger = container.querySelector('[data-acp-settings-select-trigger="mode"]');
      expect(modeTrigger).toHaveAttribute("data-disabled");
    });
  });
});

describe("useSettings", () => {
  let mockController: SessionController;

  beforeEach(() => {
    mockController = createMockController();
  });

  it("should expose modes and models", async () => {
    function TestComponent() {
      const { state } = useSettings({ controller: mockController });
      return (
        <div>
          <span data-testid="modes-count">{state.modes.length}</span>
          <span data-testid="models-count">{state.models.length}</span>
        </div>
      );
    }

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId("modes-count").textContent).toBe("2");
      expect(screen.getByTestId("models-count").textContent).toBe("3");
    });
  });

  it("should allow custom modes and models", async () => {
    const customModes: AcpMode[] = [{ id: "test", name: "Test" }];
    const customModels: AcpModel[] = [{ id: "test-model", name: "Test Model" }];

    function TestComponent() {
      const { state } = useSettings({
        controller: mockController,
        modes: customModes,
        models: customModels,
      });
      return (
        <div>
          <span data-testid="modes-count">{state.modes.length}</span>
          <span data-testid="models-count">{state.models.length}</span>
        </div>
      );
    }

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId("modes-count").textContent).toBe("1");
      expect(screen.getByTestId("models-count").textContent).toBe("1");
    });
  });

  it("should set selected mode", async () => {
    function TestComponent() {
      const { state, actions } = useSettings({ controller: mockController });
      return (
        <div>
          <span data-testid="selected-mode">
            {state.selectedMode?.name ?? "none"}
          </span>
          <button
            type="button"
            data-testid="set-mode"
            onClick={() =>
              actions.setMode({ id: "proxy", name: "Proxy", description: "Test" })
            }
          >
            Set Mode
          </button>
        </div>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("selected-mode").textContent).toBe("none");

    await act(async () => {
      fireEvent.click(screen.getByTestId("set-mode"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("selected-mode").textContent).toBe("Proxy");
    });
  });

  it("should fetch sessions from controller", async () => {
    function TestComponent() {
      const { state } = useSettings({ controller: mockController });
      return (
        <div>
          <span data-testid="sessions-count">{state.sessions.length}</span>
        </div>
      );
    }

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId("sessions-count").textContent).toBe("2");
    });
  });
});
