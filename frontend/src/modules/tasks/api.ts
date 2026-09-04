import { api } from "@/shared/api/client";
import type {
  Task,
  TaskResponse,
  TasksResponse,
  UpdateTaskPayload,
} from "./types";

export async function getTasks(): Promise<Task[]> {
  const result = await api.get<TasksResponse>("/api/tasks");
  return result.data ?? [];
}

export async function getCampaignTasks(
  campaignId: string,
): Promise<Task[]> {
  const result = await api.get<TasksResponse>(
    `/api/tasks/campaign/${campaignId}`,
  );
  return result.data ?? [];
}

export async function updateTask(
  id: string,
  data: UpdateTaskPayload,
): Promise<Task> {
  const result = await api.patch<TaskResponse>(
    `/api/tasks/${id}`,
    data,
  );
  return result.data;
}