export type EscalationLevel =
  | "L1"
  | "L2"
  | "L3";

export interface EscalationTaskSummary {
  _id: string;
  title?: string;
  type?: string;
  deadline?: string;
  status?: string;
}

export interface Escalation {
  _id: string;
  taskId: string | EscalationTaskSummary;
  level: EscalationLevel;
  triggeredAt: string;
  notifiedUserIds: string[];
  createdAt?: string;
  updatedAt?: string;
}