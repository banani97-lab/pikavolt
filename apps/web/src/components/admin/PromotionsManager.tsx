'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgePercent, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Msg = { kind: 'error' | 'info'; text: string } | null;

export function PromotionCreateForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [percent, setPercent] = useState('');
  const [amount, setAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code,
          percentOff: mode === 'percent' && percent !== '' ? Number(percent) : null,
          amountOffCents:
            mode === 'amount' && amount !== '' ? Math.round(Number(amount) * 100) : null,
          expiresAt: expiresAt || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ kind: 'error', text: json.error ?? `Failed (HTTP ${res.status}).` });
        return;
      }
      setMessage({ kind: 'info', text: `Promo code ${code.toUpperCase()} created.` });
      setCode('');
      setPercent('');
      setAmount('');
      setExpiresAt('');
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Network error creating promotion.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg uppercase tracking-wide text-white">
        <BadgePercent className="h-4 w-4 text-volt" /> New promo code
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="promo-code" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Code
          </label>
          <input
            id="promo-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SPRING25"
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 font-mono text-sm uppercase text-white placeholder:text-zinc-600"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-zinc-300">Discount type</span>
          <div className="flex gap-2">
            {(['percent', 'amount'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors',
                  mode === m
                    ? 'border-volt bg-volt/15 text-volt'
                    : 'border-white/15 text-zinc-400 hover:text-white',
                )}
              >
                {m === 'percent' ? '% off' : '$ off'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'percent' ? (
          <div>
            <label htmlFor="promo-pct" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Percent off
            </label>
            <input
              id="promo-pct"
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="25"
              className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="promo-amt" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Amount off (USD)
            </label>
            <input
              id="promo-amt"
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="25.00"
              className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white placeholder:text-zinc-600"
            />
          </div>
        )}

        <div>
          <label htmlFor="promo-exp" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Expires (optional)
          </label>
          <input
            id="promo-exp"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="h-10 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !code || (mode === 'percent' ? !percent : !amount)}
          className="inline-flex items-center gap-2 rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-storm hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create in Stripe
        </button>
      </div>

      {message && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-lg border px-3 py-2 text-sm',
            message.kind === 'error'
              ? 'border-emergency/40 bg-emergency/10 text-emergency'
              : 'border-volt/40 bg-volt/10 text-volt',
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export function DeactivatePromotionButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deactivate = async () => {
    if (!window.confirm('Deactivate this promo code? Customers will no longer be able to use it.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, active: false }),
      });
      const json = (await res.json()) as { error?: string; note?: string };
      if (!res.ok) {
        setError(json.error ?? `Failed (HTTP ${res.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-right">
      <button
        onClick={deactivate}
        disabled={busy}
        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-emergency/50 hover:text-emergency disabled:opacity-50"
      >
        {busy ? 'Deactivating…' : 'Deactivate'}
      </button>
      {error && <p className="mt-1 text-xs text-emergency">{error}</p>}
    </div>
  );
}
