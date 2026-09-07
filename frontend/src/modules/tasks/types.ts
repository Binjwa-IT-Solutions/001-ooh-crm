export type TaskType =
  | "Printing"
  | "Installation"
  | "Verification"
  | "Removal"
  | "Custom";

export type TaskStatus =
  | "Pending"
  | "InProgress"
  | "Completed"
  | "Overdue";

export interface TaskCampaign {
  _id: string;
  name?: string;
  campaignCode?: string;
}

export interface TaskSite {
  _id: string;
  code?: string;
  name?: string;
  city?: string;
}

export interface TaskManager {
  _id: string;
  name?: string;
  email?: string;
}

export interface Task {
  _id: string;
  campaignId: string | TaskCampaign;
  siteId: string | TaskSite;
  title: string;
  type: TaskType;
  assignedTo?: string | TaskManager | null;
  deadline: string;
  status: TaskStatus;
  proofRequired: boolean;
  proofId?: string | null;
  completedAt?: string | null;
}

export interface UpdateTaskPayload {
  status?: "Pending" | "InProgress" | "Completed";
  assignedTo?: string;
}

export interface TasksResponse {
  success: boolean;
  data: Task[];
}

export interface TaskResponse {
  success: boolean;
  data: Task;
}