/**
 * Filesystem types and interfaces for ACP filesystem event handling.
 */

export interface FileReadRequest {
  path: string;
  line?: number;
  limit?: number;
}

export interface FileReadResponse {
  content: string;
}

export interface FileWriteRequest {
  path: string;
  content: string;
}

export interface FileWriteResponse {
  success: boolean;
}

export type FileReadHandler = (request: FileReadRequest) => Promise<FileReadResponse | null>;
export type FileWriteHandler = (request: FileWriteRequest) => Promise<FileWriteResponse | null>;

export interface FileSystemSubscription {
  unsubscribe(): void;
}
