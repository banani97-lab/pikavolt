'use client';

import { Label } from '@/components/ui/Label';

interface StepDescribeProps {
  description: string;
  onChange: (value: string) => void;
}

export function StepDescribe({ description, onChange }: StepDescribeProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="job-description">What&apos;s going on?</Label>
        <textarea
          id="job-description"
          rows={6}
          value={description}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tell us about the job — symptoms, what you'd like installed, panel location, access notes, anything that helps us show up ready."
          className="w-full rounded-lg border border-white/15 bg-storm px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-volt/60 focus:outline-none focus:ring-2 focus:ring-volt/30"
        />
      </div>
      <p className="text-xs text-zinc-500">
        The more detail, the better — photos can be shared with your electrician on the day.
      </p>
    </div>
  );
}
