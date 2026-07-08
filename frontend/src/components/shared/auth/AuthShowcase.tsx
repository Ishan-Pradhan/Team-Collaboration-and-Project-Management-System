import { PRIORITY } from '@/constants/task.constants';
import { avatarColor } from '@/lib/avatarColor';

interface ShowcaseCard {
  title: string;
  priority: keyof typeof PRIORITY;
  assignee: string;
}

interface ShowcaseColumn {
  name: string;
  cards: ShowcaseCard[];
}

const COLUMNS: ShowcaseColumn[] = [
  {
    name: 'To Do',
    cards: [
      { title: 'Design onboarding flow', priority: 'HIGH', assignee: 'Priya' },
      { title: 'Fix payment webhook retry', priority: 'CRITICAL', assignee: 'Sam' },
    ],
  },
  {
    name: 'In Progress',
    cards: [{ title: 'Write launch announcement', priority: 'MEDIUM', assignee: 'Priya' }],
  },
  {
    name: 'Done',
    cards: [{ title: 'Migrate legacy accounts', priority: 'LOW', assignee: 'Sam' }],
  },
];

// The product itself, not a stock illustration: a static preview of a real
// board using the app's own kanban chrome, priority colors, and avatar hues.
export default function AuthShowcase() {
  return (
    <div className="w-full max-w-[400px] animate-auth-float rounded-xl bg-surface p-3 shadow-modal ring-1 ring-black/5">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {COLUMNS.map((col) => (
          <div key={col.name} className="rounded-lg bg-surface-muted p-1.5">
            <p className="mb-2 truncate px-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
              {col.name}
            </p>
            <div className="space-y-1.5">
              {col.cards.map((card) => (
                <div key={card.title} className="rounded-md bg-surface p-1.5 shadow-card">
                  <p className="text-[10px] font-medium leading-snug text-text-primary">{card.title}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className={`h-1 w-3.5 rounded-full ${PRIORITY[card.priority].bar}`} />
                    <span
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold text-white"
                      style={{ backgroundColor: avatarColor(card.assignee) }}
                    >
                      {card.assignee.charAt(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
