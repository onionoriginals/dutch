import React from 'react';
import DutchPriceScheduleEditor from './DutchPriceScheduleEditor';
import type { DecayType } from '@originals/dutch/browser';
import type { computeSchedule } from '@originals/dutch/browser';

export default function DemoDutchEditor() {
  const [schedule, setSchedule] = React.useState<ReturnType<typeof computeSchedule> | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = () => {
    if (schedule && schedule.errors.length === 0) {
      console.log('Submitting Dutch auction schedule:', schedule);
      setSubmitted(true);
      // Reset after 3 seconds
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  const canSubmit = schedule && schedule.errors.length === 0;

  if (submitted) {
    return (
      <div className="rounded-lg bg-green-50 p-6 text-center dark:bg-green-900/20">
        <div className="text-green-600 dark:text-green-400">
          <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Schedule Created Successfully!</h3>
          <p className="text-sm">Your Dutch auction price schedule has been configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Dutch Auction Price Schedule</h2>
        <DutchPriceScheduleEditor
          startPrice={1000}
          floorPrice={100}
          durationSeconds={60}
          intervalSeconds={5}
          decayType="linear"
          onChange={setSchedule}
          className="mb-6"
        />
      </div>
      
      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {canSubmit ? (
            <span className="text-green-600 dark:text-green-400">✓ Schedule is valid and ready to submit</span>
          ) : (
            <span className="text-red-600 dark:text-red-400">⚠ Please fix the errors above before submitting</span>
          )}
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            canSubmit
              ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          Create Schedule
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          <strong>Need a full auction form?</strong> This is just a price schedule demo.
        </p>
        <a 
          href="/auctions/new" 
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm underline"
        >
          Create a complete auction with title, description, and timing →
        </a>
      </div>
    </div>
  );
}

