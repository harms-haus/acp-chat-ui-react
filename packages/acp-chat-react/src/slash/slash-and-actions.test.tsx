import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useSlashCommands } from "./use-slash-commands.js";
import { SlashSuggestions } from "./SlashSuggestions.js";
import type { SlashCommand } from "./types.js";

const mockCommands: SlashCommand[] = [
  { id: "help", name: "Help", description: "Show help information" },
  { id: "clear", name: "Clear", description: "Clear the conversation" },
  { id: "mode", name: "Mode", description: "Change agent mode" },
];

describe("useSlashCommands", () => {
  it("should initialize with closed state", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.filteredCommands).toEqual(mockCommands);
  });

  it("should open on slash key", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSlashKey();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.selectedIndex).toBe(0);
  });

  it("should close on escape key", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSlashKey();
    });
    expect(result.current.isOpen).toBe(true);

    const event = { key: "Escape", preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("should navigate with arrow keys", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSlashKey();
    });

    const downEvent = { key: "ArrowDown", preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(downEvent);
    });

    expect(result.current.selectedIndex).toBe(1);

    const upEvent = { key: "ArrowUp", preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(upEvent);
    });

    expect(result.current.selectedIndex).toBe(0);
  });

  it("should select command on enter", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSlashKey();
    });

    const enterEvent = { key: "Enter", preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
    act(() => {
      result.current.handleKeyDown(enterEvent);
    });

    expect(onSelect).toHaveBeenCalledWith(mockCommands[0]);
    expect(result.current.isOpen).toBe(false);
  });

  it("should handle direct select", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommands({ commands: mockCommands, onSelect })
    );

    act(() => {
      result.current.handleSelect(mockCommands[1]!);
    });

    expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
  });
});

describe("SlashSuggestions", () => {
  it("should not render when closed", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <SlashSuggestions
        commands={mockCommands}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
        anchorElement={null}
        open={false}
      />
    );

    expect(container.querySelector("[data-acp-slash-popover]")).toBeNull();
  });

  it("should render with data-acp-slash-popover attribute when open", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashSuggestions
        commands={mockCommands}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
        anchorElement={null}
        open={true}
      />
    );

    expect(document.querySelector("[data-acp-slash-popover]")).not.toBeNull();
  });

  it("should render command items with data attributes", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashSuggestions
        commands={mockCommands}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
        anchorElement={null}
        open={true}
      />
    );

    expect(document.querySelector("[data-acp-slash-header]")).not.toBeNull();
    expect(document.querySelector("[data-acp-slash-list]")).not.toBeNull();

    mockCommands.forEach((cmd) => {
      const item = document.querySelector(`[data-acp-slash-item-id="${cmd.id}"]`);
      expect(item).not.toBeNull();
      expect(item).toHaveAttribute("data-acp-slash-item-selected", cmd.id === "help" ? "true" : "false");
    });
  });

  it("should call onSelect when item is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashSuggestions
        commands={mockCommands}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
        anchorElement={null}
        open={true}
      />
    );

    const item = document.querySelector(`[data-acp-slash-item-id="clear"]`);
    expect(item).not.toBeNull();

    fireEvent.click(item!);

    expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
  });

  it("should render command names and descriptions", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <SlashSuggestions
        commands={mockCommands}
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
        anchorElement={null}
        open={true}
      />
    );

    mockCommands.forEach((cmd) => {
      const item = document.querySelector(`[data-acp-slash-item-id="${cmd.id}"]`);
      expect(item?.textContent).toContain(cmd.name);
      expect(item?.textContent).toContain(cmd.description);
    });
  });
});
