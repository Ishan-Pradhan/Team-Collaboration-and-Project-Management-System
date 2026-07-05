import { Op } from 'sequelize';
import { Task, KanbanColumn, Project, User, PersonalEvent } from '../models/index.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { isDoneColumnName } from '../utils/doneColumn.utils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000; // hourly — dueDate is day-granularity, no need to run more often

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromToday(dueDate: string | Date): number {
  const due = new Date(typeof dueDate === 'string' ? `${dueDate}T00:00:00` : dueDate);
  return Math.round((due.getTime() - startOfToday().getTime()) / DAY_MS);
}

async function runTaskReminders(): Promise<void> {
  const today = startOfToday();
  const in2Days = new Date(today);
  in2Days.setDate(today.getDate() + 2);

  const include = [
    { model: KanbanColumn, as: 'column', attributes: ['name'] },
    { model: Project, as: 'project', attributes: ['id', 'name', 'organizationId'] },
    { model: User, as: 'assignees', attributes: ['id'], through: { attributes: [] } },
  ];

  const dueSoonTasks = await Task.findAll({
    where: { dueDate: { [Op.between]: [today, in2Days] }, dueSoonNotificationSent: false },
    include,
  });

  for (const task of dueSoonTasks) {
    const t = task as any;
    if (isDoneColumnName(t.column?.name)) continue;
    const days = daysFromToday(t.dueDate);
    const body = days <= 0
      ? `${t.title} in ${t.project?.name ?? 'a project'} is due today`
      : `${t.title} in ${t.project?.name ?? 'a project'} is due in ${days}d`;
    for (const assignee of t.assignees ?? []) {
      await notificationRepository.create({
        userId: assignee.id,
        organizationId: t.project.organizationId,
        projectId: t.projectId,
        type: 'task_due_soon',
        title: 'Task due soon',
        body,
        entityType: 'task',
        entityId: t.id,
      });
    }
    await task.update({ dueSoonNotificationSent: true });
  }

  const overdueTasks = await Task.findAll({
    where: { dueDate: { [Op.lt]: today }, overdueNotificationSent: false },
    include,
  });

  for (const task of overdueTasks) {
    const t = task as any;
    if (isDoneColumnName(t.column?.name)) continue;
    const days = Math.abs(daysFromToday(t.dueDate));
    const body = `${t.title} in ${t.project?.name ?? 'a project'} was due ${days}d ago`;
    for (const assignee of t.assignees ?? []) {
      await notificationRepository.create({
        userId: assignee.id,
        organizationId: t.project.organizationId,
        projectId: t.projectId,
        type: 'task_overdue',
        title: 'Task overdue',
        body,
        entityType: 'task',
        entityId: t.id,
      });
    }
    await task.update({ overdueNotificationSent: true });
  }
}

async function runPersonalEventReminders(): Promise<void> {
  const today = startOfToday();
  const in2Days = new Date(today);
  in2Days.setDate(today.getDate() + 2);

  const dueSoonEvents = await PersonalEvent.findAll({
    where: { dueDate: { [Op.between]: [today, in2Days] }, dueSoonNotificationSent: false },
  });

  for (const event of dueSoonEvents) {
    const e = event as any;
    const days = daysFromToday(e.dueDate);
    const body = days <= 0 ? `${e.title} is due today` : `${e.title} is due in ${days}d`;
    await notificationRepository.create({
      userId: e.userId,
      organizationId: e.organizationId,
      type: 'event_due_soon',
      title: 'Personal event due soon',
      body,
      entityType: 'personal_event',
      entityId: e.id,
    });
    await event.update({ dueSoonNotificationSent: true });
  }

  const overdueEvents = await PersonalEvent.findAll({
    where: { dueDate: { [Op.lt]: today }, overdueNotificationSent: false },
  });

  for (const event of overdueEvents) {
    const e = event as any;
    const days = Math.abs(daysFromToday(e.dueDate));
    await notificationRepository.create({
      userId: e.userId,
      organizationId: e.organizationId,
      type: 'event_overdue',
      title: 'Personal event overdue',
      body: `${e.title} was due ${days}d ago`,
      entityType: 'personal_event',
      entityId: e.id,
    });
    await event.update({ overdueNotificationSent: true });
  }
}

export function startDueDateReminderJob(): void {
  const run = async () => {
    try {
      await runTaskReminders();
      await runPersonalEventReminders();
    } catch (err) {
      console.error('Due-date reminder job failed:', err);
    }
  };

  run();
  setInterval(run, INTERVAL_MS);
}
