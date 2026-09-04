import { api } from "@/shared/api/client";
import type { Escalation } from "./types";

interface ApiResponse<T> {
  success?: boolean;
  data: T;
}

export async function getEscalations(): Promise<Escalation[]> {
  const result = await api.get<ApiResponse<Escalation[]> | Escalation[]>("/api/escalations");
  if (Array.isArray(result)) return result;
  return (result as any)?.data ?? [];
}

export async function getTaskEscalations(
  taskId: string,
): Promise<Escalation[]> {
  const result = await api.get<ApiResponse<Escalation[]> | Escalation[]>(
    `/api/tasks/${taskId}/escalations`,
  );
  if (Array.isArray(result)) return result;
  return (result as any)?.data ?? [];
}