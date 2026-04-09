import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionList } from "./SessionList.js";
import type { SessionController, SessionControllerState } from "@harms-haus/acp-chat-core";
import type { SessionItem } from "./types.js";

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

describe("SessionList", () => {
  let mockController: SessionController;

  beforeEach(() => {
    mockController = createMockController();
  });

  describe("rendering", () => {
    it("should render loading state initially", () => {
      render(<SessionList controller={mockController} />);

      expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
    });

    it("should render sessions after loading", async () => {
      render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Project 1 Session")).toBeInTheDocument();
        expect(screen.getByText("Project 2 Session")).toBeInTheDocument();
      });
    });

    it("should render empty state when no sessions", async () => {
      mockController = createMockController({
        listSessions: vi.fn(() => Promise.resolve({ sessions: [] })),
      });

      render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("No sessions found")).toBeInTheDocument();
      });
    });

    it("should render custom empty text", async () => {
      mockController = createMockController({
        listSessions: vi.fn(() => Promise.resolve({ sessions: [] })),
      });

      render(<SessionList controller={mockController} emptyText="Custom empty message" />);

      await waitFor(() => {
        expect(screen.getByText("Custom empty message")).toBeInTheDocument();
      });
    });
  });

  describe("session selection", () => {
    it("should select a session when clicked", async () => {
      const onSessionSelect = vi.fn();

      const { container } = render(<SessionList controller={mockController} onSessionSelect={onSessionSelect} />);

      await waitFor(() => {
        expect(screen.getByText("Project 1 Session")).toBeInTheDocument();
      });

      const selectButton = container.querySelector('[data-acp-session-select-button]');
      expect(selectButton).not.toBeNull();
      fireEvent.click(selectButton!);

      await waitFor(() => {
        expect(onSessionSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "session-1",
            title: "Project 1 Session",
          })
        );
      });
    });

    it("should mark selected session with data attribute", async () => {
      const { container } = render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Project 1 Session")).toBeInTheDocument();
      });

      const sessionRows = container.querySelectorAll("[data-acp-session-row]");
      expect(sessionRows.length).toBeGreaterThan(0);
    });
  });

  describe("session loading", () => {
    it("should call loadSession when load button clicked", async () => {
      render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Project 1 Session")).toBeInTheDocument();
      });

      const loadButtons = screen.getAllByText("Load");
      fireEvent.click(loadButtons[0]!);

      await waitFor(() => {
        expect(mockController.loadSession).toHaveBeenCalledWith("session-1", "/home/user/project1");
      });
    });

    it("should call onSessionLoaded callback on success", async () => {
      const onSessionLoaded = vi.fn();

      render(<SessionList controller={mockController} onSessionLoaded={onSessionLoaded} />);

      await waitFor(() => {
        expect(screen.getByText("Project 1 Session")).toBeInTheDocument();
      });

      const loadButtons = screen.getAllByText("Load");
      fireEvent.click(loadButtons[0]!);

      await waitFor(() => {
        expect(onSessionLoaded).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "session-1",
            title: "Project 1 Session",
          })
        );
      });
    });

    it("should call onSessionLoadError callback on failure", async () => {
      const error = new Error("Failed to load");
      mockController = createMockController({
        loadSession: vi.fn(() => Promise.reject(error)),
      });

      const onSessionLoadError = vi.fn();

      render(<SessionList controller={mockController} onSessionLoadError={onSessionLoadError} />);

      await waitFor(() => {
        expect(screen.getByText("Project 1 Session")).toBeInTheDocument();
      });

      const loadButtons = screen.getAllByText("Load");
      fireEvent.click(loadButtons[0]!);

      await waitFor(() => {
        expect(onSessionLoadError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            sessionId: "session-1",
            title: "Project 1 Session",
          })
        );
      });
    });
  });

  describe("error handling", () => {
    it("should display error when fetch fails", async () => {
      mockController = createMockController({
        listSessions: vi.fn(() => Promise.reject(new Error("Network error"))),
      });

      render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should allow retry after error", async () => {
      let shouldFail = true;
      mockController = createMockController({
        listSessions: vi.fn(() => {
          if (shouldFail) {
            shouldFail = false;
            return Promise.reject(new Error("Network error"));
          }
          return Promise.resolve({
            sessions: [
              { sessionId: "session-1", cwd: "/home/user/project1", title: "Session 1" },
            ],
          });
        }),
      });

      render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      const retryButton = screen.getByText("Retry");
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Session 1")).toBeInTheDocument();
      });
    });
  });

  describe("pagination", () => {
    it("should show load more button when hasMore is true", async () => {
      mockController = createMockController({
        listSessions: vi.fn(() =>
          Promise.resolve({
            sessions: [{ sessionId: "session-1", cwd: "/home/user/project1", title: "Session 1" }],
            nextCursor: "cursor-2",
          })
        ),
      });

      render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Load More")).toBeInTheDocument();
      });
    });

    it("should fetch next page when load more clicked", async () => {
      const listSessions = vi.fn();
      let callCount = 0;

      listSessions.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            sessions: [{ sessionId: "session-1", cwd: "/home/user/project1", title: "Session 1" }],
            nextCursor: "cursor-2",
          });
        }
        return Promise.resolve({
          sessions: [{ sessionId: "session-2", cwd: "/home/user/project2", title: "Session 2" }],
          nextCursor: undefined,
        });
      });

      mockController = createMockController({ listSessions });

      const { container } = render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(screen.getByText("Session 1")).toBeInTheDocument();
      });

      await waitFor(() => {
        const loadMoreContainer = container.querySelector("[data-acp-session-list-load-more]");
        expect(loadMoreContainer).not.toBeNull();
      });

      const loadMoreContainer = container.querySelector("[data-acp-session-list-load-more]");
      const loadMoreButton = loadMoreContainer?.querySelector("button");
      expect(loadMoreButton).not.toBeNull();
      fireEvent.click(loadMoreButton!);

      await waitFor(() => {
        expect(screen.getByText("Session 2")).toBeInTheDocument();
      });

      expect(listSessions).toHaveBeenCalledTimes(2);
      expect(listSessions).toHaveBeenLastCalledWith("cursor-2", undefined);
    });
  });

  describe("cwd filtering", () => {
    it("should pass cwd to listSessions", async () => {
      const listSessions = vi.fn(() =>
        Promise.resolve({
          sessions: [{ sessionId: "session-1", cwd: "/home/user/project1", title: "Session 1" }],
        })
      );

      mockController = createMockController({ listSessions });

      render(<SessionList controller={mockController} cwd="/home/user/project1" />);

      await waitFor(() => {
        expect(listSessions).toHaveBeenCalledWith(undefined, "/home/user/project1");
      });
    });
  });

  describe("autoFetch", () => {
    it("should not fetch on mount when autoFetch is false", async () => {
      const listSessions = vi.fn(() => Promise.resolve({ sessions: [] }));

      mockController = createMockController({ listSessions });

      render(<SessionList controller={mockController} autoFetch={false} />);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(listSessions).not.toHaveBeenCalled();
    });
  });

  describe("data attributes", () => {
    it("should have data-acp-session-list attribute", async () => {
      const { container } = render(<SessionList controller={mockController} />);

      await waitFor(() => {
        expect(container.querySelector("[data-acp-session-list]")).not.toBeNull();
      });
    });

    it("should have data-acp-session-row attributes", async () => {
      const { container } = render(<SessionList controller={mockController} />);

      await waitFor(() => {
        const rows = container.querySelectorAll("[data-acp-session-row]");
        expect(rows.length).toBe(2);
      });
    });

    it("should have data-acp-session-id on each row", async () => {
      const { container } = render(<SessionList controller={mockController} />);

      await waitFor(() => {
        const row1 = container.querySelector('[data-acp-session-id="session-1"]');
        const row2 = container.querySelector('[data-acp-session-id="session-2"]');
        expect(row1).not.toBeNull();
        expect(row2).not.toBeNull();
      });
    });
  });
});
