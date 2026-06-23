// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentList } from "@/features/leaves/components/DocumentList";

// Mock useDocuments hook
vi.mock("@/hooks/useDocuments", () => ({
  useDocuments: vi.fn(),
}));

// Mock the API client
vi.mock("@/lib/api/leave-api", () => ({
  deleteLeaveDocument: vi.fn(),
}));

// Mock ConfirmationDialog
vi.mock("@/components/shared/ConfirmationDialog", () => ({
  ConfirmationDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="confirm-dialog">{title}</div> : null,
}));



import { useDocuments } from "@/hooks/useDocuments";

describe("DocumentList", () => {
  it("shows loading state", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: true,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    const { container } = render(<DocumentList leaveId="leave-1" />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: false,
      isError: true,
      error: new Error("Failed to load"),
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" />);
    expect(screen.getByText((content) => content.includes("Failed to load"))).toBeInTheDocument();
  });

  it("shows empty state when no documents", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" />);
    expect(screen.getByText("No documents uploaded yet")).toBeInTheDocument();
  });

  it("renders document cards", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [
        {
          id: "doc-1",
          fileName: "certificate.pdf",
          fileUrl: "https://example.com/doc.pdf",
          mimeType: "application/pdf",
          fileSize: 102400,
          documentType: "GENERAL",
          documentStatus: "ACTIVE",
          createdAt: "2024-01-15T10:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" />);
    expect(screen.getByText("certificate.pdf")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("100.0 KB"))).toBeInTheDocument();
  });

  it("formats file sizes correctly", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [
        {
          id: "doc-1",
          fileName: "small.txt",
          fileUrl: "https://example.com/small.txt",
          mimeType: "text/plain",
          fileSize: 500,
          documentType: "GENERAL",
          documentStatus: "ACTIVE",
          createdAt: "2024-01-15T10:00:00Z",
        },
        {
          id: "doc-2",
          fileName: "large.pdf",
          fileUrl: "https://example.com/large.pdf",
          mimeType: "application/pdf",
          fileSize: 5 * 1024 * 1024,
          documentType: "GENERAL",
          documentStatus: "ACTIVE",
          createdAt: "2024-01-15T10:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" />);
    expect(screen.getByText((content) => content.includes("500 B"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("5.0 MB"))).toBeInTheDocument();
  });

  it("shows delete button when canDelete is true", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [
        {
          id: "doc-1",
          fileName: "test.pdf",
          fileUrl: "https://example.com/test.pdf",
          mimeType: "application/pdf",
          fileSize: 1000,
          documentType: "GENERAL",
          documentStatus: "ACTIVE",
          createdAt: "2024-01-15T10:00:00Z",
        },
      ],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" canDelete />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
