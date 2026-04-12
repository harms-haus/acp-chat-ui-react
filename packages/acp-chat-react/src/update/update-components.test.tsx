import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UpdateList } from "./UpdateList.js";
import { UpdateRow } from "./UpdateRow.js";
import { UpdateIndicator } from "./UpdateIndicator.js";

describe("UpdateIndicator", () => {
  it("renders with pending status", () => {
    render(<UpdateIndicator status="pending" />);
    
    const indicator = screen.getByTestId("update-indicator-pending");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-acp-update-status", "pending");
    expect(indicator).toHaveClass("acp-update__indicator");
  });

  it("renders with completed status", () => {
    render(<UpdateIndicator status="completed" />);
    
    const indicator = screen.getByTestId("update-indicator-completed");
    expect(indicator).toHaveAttribute("data-acp-update-status", "completed");
  });

  it("renders with failed status", () => {
    render(<UpdateIndicator status="failed" />);
    
    const indicator = screen.getByTestId("update-indicator-failed");
    expect(indicator).toHaveAttribute("data-acp-update-status", "failed");
  });

  it("accepts custom className", () => {
    render(<UpdateIndicator status="pending" className="custom-class" />);
    
    const indicator = screen.getByTestId("update-indicator-pending");
    expect(indicator).toHaveClass("custom-class");
  });
});

describe("UpdateRow", () => {
  const baseProps = {
    type: "file",
    title: "test.txt",
    status: "pending" as const,
    timestamp: 1712851200000,
  };

  it("renders with all props", () => {
    render(<UpdateRow {...baseProps} />);

    const update = screen.getByTestId("acp-update-file");
    expect(update).toBeInTheDocument();
    expect(update).toHaveAttribute("data-acp-update-type", "file");
    expect(screen.getByText("file")).toBeInTheDocument();
    expect(screen.getByText("test.txt")).toBeInTheDocument();
  });

  it("renders without optional title", () => {
    render(<UpdateRow type="file" status="pending" />);
    
    expect(screen.getByText("file")).toBeInTheDocument();
    expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
  });

  it("renders without optional timestamp", () => {
    render(<UpdateRow type="file" title="test.txt" status="pending" />);
    
    expect(screen.getByText("test.txt")).toBeInTheDocument();
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });

  it("applies status class based on status prop", () => {
    const { rerender } = render(<UpdateRow type="file" status="pending" />);
    const update = screen.getByTestId("acp-update-file");
    expect(update).toHaveClass("acp-update--status-pending");

    rerender(<UpdateRow type="file" status="completed" />);
    expect(screen.getByTestId("acp-update-file")).toHaveClass("acp-update--status-completed");
  });

  it("accepts custom className", () => {
    render(<UpdateRow type="file" status="pending" className="custom-class" />);

    const update = screen.getByTestId("acp-update-file");
    expect(update).toHaveClass("custom-class");
  });
});

describe("UpdateList", () => {
  const mockUpdates = [
    { id: "1", type: "file", title: "file1.txt", status: "completed" as const, timestamp: 1712851200000 },
    { id: "2", type: "file", title: "file2.txt", status: "pending" as const, timestamp: 1712851300000 },
  ];

  it("renders empty state when no updates", () => {
    render(<UpdateList updates={[]} />);
    
    expect(screen.getByText("No updates")).toBeInTheDocument();
    expect(screen.getByTestId("acp-update-list-empty")).toBeInTheDocument();
  });

  it("renders list of updates", () => {
    render(<UpdateList updates={mockUpdates} />);
    
    expect(screen.getByTestId("acp-update-list")).toBeInTheDocument();
    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("file2.txt")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(<UpdateList updates={mockUpdates} className="custom-class" />);
    
    expect(screen.getByTestId("acp-update-list")).toHaveClass("custom-class");
  });

  it("applies gap style", () => {
    render(<UpdateList updates={mockUpdates} gap={16} />);
    
    const list = screen.getByTestId("acp-update-list");
    expect(list).toHaveStyle("--acp-update-list-gap: 16px");
  });

  it("renders update wrappers with correct indices", () => {
    render(<UpdateList updates={mockUpdates} />);
    
    expect(screen.getByTestId("acp-update-wrapper-0")).toBeInTheDocument();
    expect(screen.getByTestId("acp-update-wrapper-1")).toBeInTheDocument();
  });
});
