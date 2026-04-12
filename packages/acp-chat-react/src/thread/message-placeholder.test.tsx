import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MessagePlaceholder } from "./MessagePlaceholder.js";

describe("MessagePlaceholder", () => {
  const createMessageItem = (role: "user" | "agent", content: string) => ({
    type: "message" as const,
    id: "msg-1",
    data: {
      role,
      content,
    } as any,
  });

  it("renders user message correctly", () => {
    const item = createMessageItem("user", "Hello from user");
    render(<MessagePlaceholder item={item} />);
    
    expect(screen.getByTestId("acp-message-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("acp-message-placeholder")).toHaveAttribute("data-acp-message-role", "user");
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("renders agent message correctly", () => {
    const item = createMessageItem("agent", "Hello from agent");
    render(<MessagePlaceholder item={item} />);
    
    expect(screen.getByTestId("acp-message-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("acp-message-placeholder")).toHaveAttribute("data-acp-message-role", "agent");
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("truncates long content to 200 characters", () => {
    const longContent = "a".repeat(250);
    const item = createMessageItem("agent", longContent);
    render(<MessagePlaceholder item={item} />);
    
    const content = screen.getByTestId("acp-message-placeholder-content");
    expect(content.textContent).toBe(longContent.slice(0, 200) + "...");
  });

  it("does not truncate short content", () => {
    const shortContent = "Short message";
    const item = createMessageItem("agent", shortContent);
    render(<MessagePlaceholder item={item} />);
    
    const content = screen.getByTestId("acp-message-placeholder-content");
    expect(content.textContent).toBe(shortContent);
  });

  it("applies correct CSS classes", () => {
    const item = createMessageItem("user", "Test");
    render(<MessagePlaceholder item={item} />);
    
    expect(screen.getByTestId("acp-message-placeholder")).toHaveClass("acp-message-placeholder");
    expect(screen.getByTestId("acp-message-placeholder")).toHaveClass("acp-message-placeholder--user");
  });
});
