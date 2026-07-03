import { activityLogRepository } from '../repositories/activityLog.repository.js';
import { getIO } from '../socket/index.js';
import type { ActivityLogType } from '../models/activityLog.model.js';

interface LogActivityParams {
  projectId: string;
  actorId: string;
  type: ActivityLogType;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

// Wraps the write + the real-time push in one place instead of duplicating
// "log, then emit" at every call site. The socket payload is intentionally
// minimal (just enough to know which project changed) — listeners refetch
// through the existing read endpoints rather than trusting an inline copy.
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await activityLogRepository.log({
      projectId: params.projectId,
      actorId: params.actorId,
      type: params.type,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? null,
    });

    getIO().to(`project:${params.projectId}`).emit('activity:new', { projectId: params.projectId });
  } catch (err) {
    console.error('[logActivity] failed to log/broadcast activity:', err);
  }
}
