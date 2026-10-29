export type Memory = {
  id: string;
  file: File;
  preview?: string;
  status: "ready" | "uploading" | "success" | "failed";
  progress: number;
  error?: string;
  session?: string;
};
