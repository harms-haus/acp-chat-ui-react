export type UpdateStatus = "pending" | "completed" | "failed";

export interface UpdateRowProps {
  type: string;
  title?: string | undefined;
  status?: UpdateStatus | undefined;
  timestamp?: number | undefined;
  className?: string | undefined;
}

export interface UpdateIndicatorProps {
  status: UpdateStatus;
  className?: string;
}

export interface UpdateListProps {
  updates: Array<{
    id: string;
    type: string;
    title?: string;
    status: UpdateStatus;
    timestamp?: number;
  }>;
  className?: string;
  gap?: number;
}

export interface UpdateEmptyStateProps {
  message?: string;
  className?: string;
}
