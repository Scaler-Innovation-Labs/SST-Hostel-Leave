// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentList } from "@/features/leaves/components/DocumentList";

// Mock useDocuments hook
vi.mock("@/hooks/use-documents", () => ({
  useDocuments: vi.fn(),
}));

// Mock the API client
vi.mock("@/lib/api/leave-api", () => ({
  deleteLeaveDocument: vi.fn(),
  getQuestionsUrl: vi.fn((id: string) => `/api/v1/leaves/${id}/questions`),
}));

// Mock ConfirmationDialog
vi.mock("@/components/shared/ConfirmationDialog", () => ({
  ConfirmationDialog: ({ open, title }: { open: boolean; title: string }) =>
    open ? <div data-testid="confirm-dialog">{title}</div> : null,
}));

import { useDocuments } from "@/hooks/use-documents";

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

  it("renders the documents section with no cards when no documents", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    const { container } = render(<DocumentList leaveId="leave-1" />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("No documents attached.")).toBeInTheDocument();
    expect(container.querySelectorAll("a[download]").length).toBe(0);
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
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show supporting document upload box by default when canUpload is true and admin has not asked", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" canUpload hasAdminAsked={false} />);
    expect(screen.queryByText("Supporting document")).not.toBeInTheDocument();
    expect(screen.getByText("No documents attached.")).toBeInTheDocument();
  });

  it("shows supporting document upload box when admin has asked", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<DocumentList leaveId="leave-1" canUpload hasAdminAsked={true} />);
    expect(screen.getByText("Supporting document")).toBeInTheDocument();
    expect(
      screen.getByText("Add any other document that will help reviewers assess this request."),
    ).toBeInTheDocument();
  });

  it("shows missing required document upload even if admin has not asked generic supporting document", () => {
    vi.mocked(useDocuments).mockReturnValue({
      documents: [],
      isLoading: false,
      isError: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(
      <DocumentList
        leaveId="leave-1"
        canUpload
        hasAdminAsked={false}
        requiredDocuments={[{ type: "medical", label: "Medical Certificate" }]}
      />,
    );
    expect(screen.getByText("Medical Certificate required")).toBeInTheDocument();
    expect(screen.queryByText("Supporting document")).not.toBeInTheDocument();
  });
});
