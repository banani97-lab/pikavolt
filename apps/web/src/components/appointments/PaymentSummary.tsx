import { cn } from '@/lib/utils';
import { formatCents } from '@/components/booking/format';

export interface PaymentRow {
  id: string;
  kind: string | null;
  amount_cents: number;
  status: string;
  paid_at: string | null;
}

const KIND_LABEL: Record<string, string> = {
  deposit: 'Deposit',
  final: 'Final payment',
  extra: 'Additional charge',
};

const STATUS_STYLE: Record<string, string> = {
  succeeded: 'text-volt',
  pending: 'text-zinc-400',
  processing: 'text-zinc-400',
  failed: 'text-emergency',
  refunded: 'text-arc-end',
};

interface PaymentSummaryProps {
  payments: PaymentRow[];
  serviceCallFeeCents: number;
  discountCents: number;
  jobTotalCents: number | null;
}

export function PaymentSummary({
  payments,
  serviceCallFeeCents,
  discountCents,
  jobTotalCents,
}: PaymentSummaryProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-zinc-400">
        <span>Service call fee</span>
        <span>{formatCents(serviceCallFeeCents)}</span>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between text-volt">
          <span>Promo discount</span>
          <span>−{formatCents(discountCents)}</span>
        </div>
      )}
      {jobTotalCents != null && (
        <div className="flex justify-between text-zinc-400">
          <span>Job total (incl. fee)</span>
          <span>{formatCents(jobTotalCents)}</span>
        </div>
      )}

      <div className="my-2 border-t border-white/10" />

      {payments.length === 0 && <p className="text-zinc-500">No payments yet.</p>}
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between">
          <span className="text-white">{KIND_LABEL[p.kind ?? ''] ?? 'Payment'}</span>
          <span className="flex items-center gap-2">
            <span className={cn('text-xs uppercase tracking-wide', STATUS_STYLE[p.status] ?? 'text-zinc-400')}>
              {p.status}
            </span>
            <span className="font-medium text-white">{formatCents(p.amount_cents)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
