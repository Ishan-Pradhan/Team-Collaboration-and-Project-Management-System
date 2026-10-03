'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/shared/Logo';
import { useAuthStore } from '@/store/auth.store';
import './landing.css';

const MODULES = [
  'Kanban boards',
  'Channels & DMs',
  'Personal calendar',
  'Notifications',
  'Org analytics',
  'Roles & invites',
  'Admin console',
];

const TABS = [
  {
    id: 'board',
    label: 'Board',
    mono: '01',
    src: '/landing/board.png',
    alt: 'Project board with To Do, In Progress, In Review and Done columns in capms',
    caption: 'Drag-and-drop Kanban boards with priorities, due dates, and assignees.',
  },
  {
    id: 'chat',
    label: 'Chat',
    mono: '02',
    src: '/landing/chat.png',
    alt: 'Team chat channel with message threads in capms',
    caption: 'Public channels and direct messages, with replies, reactions, and mentions.',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    mono: '03',
    src: '/landing/calendar.png',
    alt: 'Personal calendar month view in capms',
    caption: 'A personal calendar for events and deadlines, per user and per project.',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    mono: '04',
    src: '/landing/analytics.png',
    alt: 'Organization analytics dashboard in capms',
    caption: 'Completion trends, status breakdowns, workload, and project health.',
  },
] as const;

const FEATURES = [
  {
    no: '01',
    title: 'A board that runs on the week, not on meetings',
    body: 'Every project is a Kanban board your team can scan in seconds. Drag tasks across To Do, In Progress, In Review, and Done; sort by priority, due date, or assignee; and open any card for subtasks, comments, and files.',
    src: '/landing/task.png',
    alt: 'Task drawer showing priority, due date, assignees, and file tabs in capms',
    flip: false,
  },
  {
    no: '02',
    title: 'Conversations live next to the work',
    body: 'Channels and direct messages are built in, so updates happen beside the board instead of across three other tools. Reply in threads, react with an emoji, and get notified the moment something needs you.',
    src: '/landing/chat-thread.png',
    alt: 'Channel conversation in capms chat',
    flip: true,
  },
  {
    no: '03',
    title: 'Know what is due before it is late',
    body: 'A personal calendar per user, a notification feed per account, and background reminders for upcoming and overdue tasks. Your Monday standup starts with a list, not a hunt.',
    src: '/landing/calendar.png',
    alt: 'Calendar month view in capms',
    flip: false,
  },
  {
    no: '04',
    title: 'Signals, not status meetings',
    body: 'Org-wide analytics surface task completion over time, status distribution, who carries the most open work, and per-project health — so you find problems before the retro does.',
    src: '/landing/analytics.png',
    alt: 'Analytics charts in capms',
    flip: true,
  },
];

const STEPS = [
  {
    no: '1',
    title: 'Create your workspace',
    body: 'One organization with projects, members, and settings scoped together.',
  },
  {
    no: '2',
    title: 'Invite your team',
    body: 'Owners, org admins, project managers, and members — each with the access they need.',
  },
  {
    no: '3',
    title: 'Plan, chat, execute',
    body: 'Run the work on the board and keep the conversation in the same tool.',
  },
  {
    no: '4',
    title: 'Review the numbers',
    body: 'Close the loop with analytics on progress, load, and health.',
  },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.landing-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function LandingPage() {
  const [tab, setTab] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useReveal();

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isAuth = mounted && isAuthenticated;

  return (
    <div className="landing flex min-h-screen flex-col bg-background text-text-primary">
      {/* ── Navigation ─────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? 'border-b border-border-subtle bg-background/85 backdrop-blur-md'
            : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Product">
            <a href="#product" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              Product
            </a>
            <a href="#features" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              Features
            </a>
            <a href="#workflow" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuth ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-14 md:pt-20 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="landing-mono landing-hero-fade mb-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                <span className="h-px w-8 bg-brand" aria-hidden />
                Team collaboration &amp; project management
              </p>
              <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[3.4rem] lg:text-[3.9rem]">
                <span className="landing-hero-line">
                  <span style={{ animationDelay: '0.05s' }}>Plan the work.</span>
                </span>
                <span className="landing-hero-line">
                  <span style={{ animationDelay: '0.16s' }}>Talk through it.</span>
                </span>
                <span className="landing-hero-line">
                  <span style={{ animationDelay: '0.27s' }}>
                    Ship it<span className="text-brand">.</span>
                  </span>
                </span>
              </h1>
              <p className="landing-hero-fade mt-6 max-w-md text-base leading-relaxed text-text-secondary md:text-lg">
                capms puts Kanban boards, team chat, calendars, notifications, and org
                analytics in one workspace — so projects move forward without the busywork.
              </p>
              <div className="landing-hero-fade mt-8 flex flex-wrap items-center gap-4">
                {isAuth ? (
                  <Link
                    href="/dashboard"
                    className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    Go to Dashboard →
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/auth/register"
                      className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                    >
                      Get started
                    </Link>
                    <Link
                      href="/auth/login"
                      className="group text-sm font-medium text-text-primary"
                    >
                      Already a member? Sign in{' '}
                      <span className="landing-link-arrow" aria-hidden>
                        →
                      </span>
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-7">
              <figure className="landing-hero-shot">
                <div className="overflow-hidden rounded-lg border border-border-muted bg-surface shadow-[0_24px_60px_-24px_rgba(22,22,22,0.25)]">
                  <div className="flex items-center gap-1.5 border-b border-border-subtle px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#d98c8c]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#e0c07a]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#9dc49a]" />
                    <span className="landing-mono ml-3 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                      capms · board
                    </span>
                  </div>
                  <Image
                    src="/landing/board.png"
                    alt="capms project board with columns and tasks"
                    width={1600}
                    height={920}
                    priority
                    className="h-auto w-full object-cover object-left-top"
                  />
                </div>
                <figcaption className="landing-mono mt-3 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  Real product UI — Website Redesign board
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── Modules strip ────────────────────────────────────── */}
        <section className="border-y border-border-subtle">
          <ul className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
            {MODULES.map((m) => (
              <li
                key={m}
                className="landing-mono flex items-center gap-8 text-[11px] font-medium uppercase tracking-[0.18em] text-text-secondary"
              >
                {m}
                <span className="h-1 w-1 rounded-full bg-brand" aria-hidden />
              </li>
            ))}
          </ul>
        </section>

        {/* ── Product showcase ─────────────────────────────────── */}
        <section id="product" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="landing-reveal mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="landing-mono mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Inside capms
              </p>
              <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
                One workspace, four daily habits.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
              Switch between the board, the conversation, the calendar, and the numbers —
              all in the same place you already signed in to.
            </p>
          </div>

          <div className="landing-reveal">
            <div
              className="mb-6 flex flex-wrap items-center gap-2 border-b border-border-subtle"
              role="tablist"
              aria-label="Product views"
            >
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === i}
                  onClick={() => setTab(i)}
                  className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    tab === i
                      ? 'border-brand text-text-primary'
                      : 'border-transparent text-text-muted hover:text-text-primary'
                  }`}
                >
                  <span className="landing-mono mr-2 text-[10px] text-text-muted">{t.mono}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative overflow-hidden rounded-lg border border-border-muted bg-surface shadow-[0_24px_60px_-24px_rgba(22,22,22,0.18)]">
              <div className="relative aspect-[1600/920]">
                {TABS.map((t, i) => (
                  <Image
                    key={t.id}
                    src={t.src}
                    alt={t.alt}
                    width={1600}
                    height={920}
                    className={`landing-shot absolute inset-0 h-full w-full object-cover object-left-top ${
                      tab === i ? 'is-active' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="mt-4 text-sm text-text-secondary" role="status">
              {TABS[tab].caption}
            </p>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section id="features" className="border-t border-border-subtle bg-surface-muted/60">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <p className="landing-mono landing-reveal mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
              What you get
            </p>
            <h2 className="landing-reveal mb-16 max-w-2xl text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Built from the actual workflow your team already has.
            </h2>

            <div className="space-y-24 lg:space-y-32">
              {FEATURES.map((f) => (
                <div
                  key={f.no}
                  className={`landing-reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                    f.flip ? 'lg:[direction:rtl]' : ''
                  }`}
                >
                  <div className={f.flip ? 'lg:[direction:ltr]' : ''}>
                    <span className="landing-mono text-xs tracking-[0.2em] text-brand">{f.no}</span>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] md:text-[1.75rem]">
                      {f.title}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-text-secondary">
                      {f.body}
                    </p>
                  </div>
                  <figure className={f.flip ? 'lg:[direction:ltr]' : ''}>
                    <div className="overflow-hidden rounded-lg border border-border-muted bg-surface shadow-[0_20px_50px_-24px_rgba(22,22,22,0.2)]">
                      <Image
                        src={f.src}
                        alt={f.alt}
                        width={1600}
                        height={920}
                        className="h-auto w-full object-cover object-left-top"
                      />
                    </div>
                  </figure>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Workflow ─────────────────────────────────────────── */}
        <section id="workflow" className="bg-primary text-primary-text">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <p className="landing-mono mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
              How it works
            </p>
            <h2 className="landing-reveal max-w-2xl text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              From empty workspace to shipped week in four steps.
            </h2>

            <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((s) => (
                <li key={s.no} className="landing-reveal border-t border-white/15 pt-6">
                  <span className="landing-mono text-sm text-brand">{s.no}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-primary-text/70">{s.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-16 flex flex-wrap items-center gap-4">
              <Link
                href="/auth/register"
                className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-[#161616] transition-colors hover:bg-brand-hover"
              >
                Create your workspace
              </Link>
              <Link
                href="/auth/login"
                className="rounded-md border border-white/20 px-6 py-3 text-sm font-medium text-primary-text transition-colors hover:bg-white/5"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 md:flex-row md:items-center">
          <Logo className="opacity-90" />
          <p className="landing-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Team Collaboration &amp; Project Management System
          </p>
          <nav className="flex items-center gap-6" aria-label="Footer">
            <Link href="/auth/login" className="text-sm text-text-secondary hover:text-text-primary">
              Sign in
            </Link>
            <Link href="/auth/register" className="text-sm text-text-secondary hover:text-text-primary">
              Get started
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
