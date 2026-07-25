'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cancelAppointment } from '@/app/(app)/appointments/[id]/actions';
import { formatCents } from '@/components/booking/format';

interface CancelAppointmentButtonProps {
  appointmentId: string;
  scheduledStart: string;
  depositPaidCents: number;
  cancellationWindowHours: number;
}

/**
 * Policy-aware cancel button: shows whether the deposit will be refunded
 * (≥24h before the slot) or forfeited before the customer confirms. The
 * server action re-checks the same policy — this copy is informational.
 */
export function CancelAppointmentButton({
  appointmentId,
  scheduledStart,
  depositPaidCents,
  cancellationWindowHours,
}: CancelAppointmentButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const refundEligible =
    new Date(scheduledStart).getTime() - Date.now() >= cancellationWindowHours * 3_600_000;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelAppointment(appointmentId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Cancel appointment
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-emergency/40 bg-emergency/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-emergency" />
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">Cancel this appointment?</p>
          {depositPaidCents > 0 ? (
            refundEligible ? (
              <p className="text-zinc-300">
                You&apos;re more than {cancellationWindowHours} hours out, so your{' '}
                <strong className="text-volt">{formatCents(depositPaidCents)} deposit will be
                refunded in full</strong> to your original payment method.
              </p>
            ) : (
              <p className="text-zinc-300">
                Your slot starts in less than {cancellationWindowHours} hours, so per our
                cancellation policy your{' '}
                <strong className="text-emergency">
                  {formatCents(depositPaidCents)} deposit will not be refunded
                </strong>
                .
              </p>
            )
          ) : (
            <p className="text-zinc-300">No deposit has been collected yet — nothing to refund.</p>
          )}
          {error && <p className="text-emergency">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="danger" size="sm" onClick={confirm} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Cancelling…
                </>
              ) : (
                'Yes, cancel it'
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Keep appointment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
