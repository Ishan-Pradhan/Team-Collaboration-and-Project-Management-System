export interface TrendPoint {
  date: string;
  count: number;
}

export interface StatusBreakdownEntry {
  name: string;
  count: number;
}

export interface MemberWorkloadEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  count: number;
}

export interface ProjectHealthEntry {
  id: string;
  name: string;
  taskCount: number;
  overdueCount: number;
  dueSoonCount: number;
  lastActivityAt: string | null;
}

export interface OrgAnalytics {
  completionTrend: {
    created: TrendPoint[];
    completed: TrendPoint[];
  };
  statusBreakdown: StatusBreakdownEntry[];
  memberWorkload: MemberWorkloadEntry[];
  projectHealth: ProjectHealthEntry[];
}
