'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Truck,
  Hammer,
  Ban,
  UserX,
  CircleCheck,
  Loader2,
} from 'lucide-react';
import { allowedTransitions, type AppointmentStatus } from '@pikavolt/core';
import {
  approveAppointment,
  cancelAppointment,
  markEnRoute,
  markArrived,
  markNoShow,
  completeJob,
  type ActionResult,
} from '@/app/admin/appointments/actions';
import { cn } from '@/lib/utils';

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [panel, setPanel] = useState<'cancel' | 'complete' | null>(null);

  const [cancelReason, setCancelReason] = useState('');
  const [jobTotal, setJobTotal] = useState('');
  const [jobNotes, setJobNotes] = useState('');

  const allowed = allowedTransitions(status, 'owner');

  const run = (fn: () => Promise<ActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error ?? 'Something went wrong.' });
        return;
      }
      if (result.info) setMessage({ kind: 'info', text: result.info });
      setPanel(null);
      setCancelReason('');
      router.refresh();
    });
  };

  const btn =
    'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {allowed.includes('confirmed') && (
          <button
            className={cn(btn, 'bg-volt text-storm hover:brightness-105')}
            disabled={pending}
            onClick={() => run(() => approveAppointment(appointmentId))}
          >
            <Check className="h-4 w-4" /> Approve
          </button>
        )}

        {allowed.includes('en_route') && (
          <button
            className={cn(btn, 'border border-arc-end/40 bg-arc-end/10 text-arc-end hover:bg-arc-end/20')}
            disabled={pending}
            onClick={() => run(() => markEnRoute(appointmentId))}
          >
            <Truck className="h-4 w-4" /> Mark en route
          </button>
        )}

        {allowed.includes('in_progress') && (
          <button
            className={cn(btn, 'border border-orange-400/40 bg-orange-400/10 text-orange-300 hover:bg-orange-400/20')}
            disabled={pending}
            onClick={() => run(() => markArrived(appointmentId))}
          >
            <Hammer className="h-4 w-4" /> Arrived — start job
          </button>
        )}

        {allowed.includes('completed') && (
          <button
            className={cn(btn, 'bg-emerald-500 text-storm hover:brightness-105')}
            disabled={pending}
            onClick={() => setPanel(panel === 'complete' ? null : 'complete')}
          >
            <CircleCheck className="h-4 w-4" /> Job complete
          </button>
        )}

        {allowed.includes('no_show') && (
          <button
            className={cn(btn, 'border border-rose-400/40 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20')}
            disabled={pending}
            onClick={() => {
              if (window.confirm('Mark this appointment as a no-show?')) {
                run(() => markNoShow(appointmentId));
              }
            }}
          >
            <UserX className="h-4 w-4" /> No-show
          </button>
        )}

        {allowed.includes('cancelled') && (
          <button
            className={cn(btn, 'border border-emergency/40 bg-emergency/10 text-emergency hover:bg-emergency/20')}
            disabled={pending}
            onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}
          >
            <Ban className="h-4 w-4" /> Cancel
          </button>
        )}

        {pending && <Loader2 className="h-5 w-5 animate-spin self-center text-zinc-500" />}
      </div>

      {panel === 'cancel' && (
        <div className="rounded-xl border border-emergency/30 bg-emergency/5 p-4">
          <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Cancellation reason
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
            placeholder="Why is this being cancelled?"
            className="w-full rounded-lg border border-white/15 bg-storm p-3 text-sm text-white placeholder:text-zinc-600 focus:border-emergency/60 focus:outline-none"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Deposit refund policy: full refund if cancelled ≥24h before the slot; otherwise the
            deposit is kept. The refund itself is handled by the payments module.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className={cn(btn, 'bg-emergency text-white hover:brightness-105')}
              disabled={pending || !cancelReason.trim()}
              onClick={() => run(() => cancelAppointment(appointmentId, cancelReason))}
            >
              Confirm cancellation
            </button>
            <button
              className={cn(btn, 'border border-white/15 text-zinc-300 hover:text-white')}
              onClick={() => setPanel(null)}
            >
              Keep appointment
            </button>
          </div>
        </div>
      )}

      {panel === 'complete' && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="job-total" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Job total (USD, includes the $150 service call fee)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
                  $
                </span>
                <input
                  id="job-total"
                  type="number"
                  min={150}
                  step="0.01"
                  value={jobTotal}
                  onChange={(e) => setJobTotal(e.target.value)}
                  placeholder="150.00"
                  className="h-11 w-full rounded-lg border border-white/15 bg-storm pl-7 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-400/60 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Minimum $150.</p>
            </div>
            <div>
              <label htmlFor="job-notes" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Job notes
              </label>
              <textarea
                id="job-notes"
                value={jobNotes}
                onChange={(e) => setJobNotes(e.target.value)}
                rows={3}
                placeholder="Work performed, materials, follow-ups…"
                className="w-full rounded-lg border border-white/15 bg-storm p-3 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-400/60 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className={cn(btn, 'bg-emerald-500 text-storm hover:brightness-105')}
              disabled={pending || jobTotal === ''}
              onClick={() => run(() => completeJob(appointmentId, Number(jobTotal), jobNotes))}
            >
              Save &amp; charge final payment
            </button>
            <button
              className={cn(btn, 'border border-white/15 text-zinc-300 hover:text-white')}
              onClick={() => setPanel(null)}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            message.kind === 'error'
              ? 'border-emergency/40 bg-emergency/10 text-emergency'
              : 'border-volt/40 bg-volt/10 text-volt',
          )}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
