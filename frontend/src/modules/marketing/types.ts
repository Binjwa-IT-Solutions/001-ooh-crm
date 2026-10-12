export interface DailyLogItem {
  _id: string;
  userId: { _id: string; name: string; email: string; role: string };
  date: string;
  category: string;
  taskTitle: string;
  hoursSpent: number;
  description: string;
  outputLink?: string;
  statusAfterToday: 'Done' | 'In Progress' | 'Blocked';
  isBackdated: boolean;
  createdAt: string;
}

export interface MarketingTeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
}

export interface MarketingTaskItem {
  _id: string;
  title: string;
  description?: string;
  type: string;
  assignedTo: { _id: string; name: string; email: string; role?: string; designation?: string };
  assignedBy?: { _id: string; name: string; email?: string; role?: string; designation?: string };
  status: 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'Revision Needed' | 'Approved' | 'Done' | 'On Hold' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  isContent?: boolean;
  platform?: string;
  postUrl?: string;
  city?: string;
  isPastDue?: boolean;
  staleAlert?: boolean;
  carryForwardCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MarketingSpendItem {
  _id: string;
  date: string;
  campaignName: string;
  platform: string;
  city: string;
  amount: number;
  type: string;
  receiptUrl?: string;
  paymentStatus: 'Pending' | 'Paid';
  notes?: string;
  createdAt: string;
}

export interface MarketingLeadItem {
  _id: string;
  companyName: string;
  contactPerson: string;
  designation?: string;
  phone: string;
  email?: string;
  city: string;
  sourcePlatform: string;
  serviceInterested?: string;
  stage: 'New' | 'Contacted' | 'Meeting Done' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Lost';
  dealValue?: number;
  lostReason?: string;
  notes?: string;
  createdAt: string;
}

export interface MarketingDashboardData {
  month: string;
  budget: {
    planned: number;
    spent: number;
    remaining: number;
    utilizationPct: number;
    isAlert: boolean;
  };
  metrics: {
    totalLeads: number;
    wonDealsCount: number;
    totalRevenue: number;
    netRoiPct: number;
    roas: number;
    cpl: number;
  };
  tasksSummary: {
    total: number;
    completed: number;
    inProgress: number;
    stale: number;
  };
  platformMatrix: Array<{
    platform: string;
    spend: number;
    leadsCount: number;
    wonCount: number;
    revenue: number;
    roasMultiplier: number;
  }>;
  cityMatrix: Array<{
    city: string;
    spend: number;
    leadsCount: number;
    wonCount: number;
    revenue: number;
  }>;
}
