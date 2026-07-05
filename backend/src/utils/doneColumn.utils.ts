// Mirrors the frontend's `isDoneColumn` (task.constants.ts) — a task or event
// sitting in/associated with a column whose name matches this is treated as
// completed, so it should never count toward overdue/due-soon stats or
// reminders regardless of its dueDate.
const DONE_COLUMN_RE = /\b(done|complet\w*|finish\w*|clos\w*|shipped?|deployed?|released?|delivered?)\b/i;

export const isDoneColumnName = (name: string | null | undefined): boolean =>
  !!name && DONE_COLUMN_RE.test(name);
