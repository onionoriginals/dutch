import React from 'react';
import DutchPriceScheduleEditor from './DutchPriceScheduleEditor';
import type { computeSchedule } from '@originals/dutch/browser';

export default function DemoDutchEditor() {
  const [schedule, setSchedule] = React.useState<ReturnType<typeof computeSchedule> | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = () => {
    if (schedule && schedule.errors.length === 0) {
      console.log('Submitting Dutch auction schedule:', schedule);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  const canSubmit = schedule && schedule.errors.length === 0;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-emerald-400/40 bg-emerald-50/70 p-10 text-center text-emerald-700 shadow-inner shadow-emerald-200/40 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-emerald-700 dark:text-emerald-100">Schedule created</h3>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
            Your Dutch auction timeline is validated and ready to publish across the marketplace surfaces.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-secondary/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Dutch schedule</p>
            <h3 className="text-lg font-semibold text-foreground">Price decay preview</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/70 px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live validation
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Adjust any value to see updated revenue projections, collector messaging, and guardrails. Changes autosave to your draft.
        </p>
      </div>

      <DutchPriceScheduleEditor
        startPrice={1000}
        floorPrice={100}
        durationSeconds={60}
        intervalSeconds={5}
        decayType="linear"
        onChange={setSchedule}
        className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm shadow-black/5 dark:bg-slate-900/60"
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-secondary/60 p-5 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          {canSubmit ? (
            <span className="font-semibold text-emerald-600 dark:text-emerald-300">Schedule is valid and ready to publish.</span>
          ) : (
            <span>Please resolve the highlighted fields before publishing the schedule.</span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`btn ${canSubmit ? 'btn-primary' : 'btn-secondary opacity-60'} md:w-auto`}
        >
          Create schedule
        </button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-secondary/50 p-5">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Need a full auction form?</strong> This is only the price schedule. Open the studio to craft the narrative, metadata, and collector-facing details.
        </p>
        <a
          href="/auctions/new"
          className="btn btn-ghost mt-4 inline-flex justify-center border-border/40 bg-white/60 text-foreground hover:bg-white/80"
        >
          Launch complete auction flow
        </a>
      </div>
    </div>
  );
}
