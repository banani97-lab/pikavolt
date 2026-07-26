'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { createInvoice } from './actions';

type Channel = 'email' | 'sms' | 'both';

function toCents(dollars: string): number {
  const n = parseFloat(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function InvoiceForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [total, setTotal] = useState('');
  const [upfront, setUpfront] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [autoCharge, setAutoCharge] = useState(false);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const totalCents = toCents(total);
  const upfrontCents = toCents(upfront);
  const remainderCents = Math.max(totalCents - upfrontCents, 0);

  const remainderNote = useMemo(() => {
    if (!totalCents) return null;
    return `Upfront ${money(upfrontCents)} · Remaining on completion ${money(remainderCents)}`;
  }, [totalCents, upfrontCents, remainderCents]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createInvoice({
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim() || undefined,
        description: description.trim(),
        totalCents,
        upfrontCents,
        channel,
        autoChargeRemainder: autoCharge,
      });
      if (!res.ok || !res.token) {
        setError(res.error ?? 'Could not create the invoice.');
        return;
      }
      setResult({ link: `${window.location.origin}/invoice/${res.token}` });
    });
  };

  if (result) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="rounded-xl border border-volt/40 bg-volt/10 p-5">
          <p className="font-semibold text-volt">Invoice created & sent ⚡</p>
          <p className="mt-1 text-sm text-zinc-300">
            The customer was notified via {channel === 'both' ? 'email and text' : channel}. You can
            also share this secure pay link directly:
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input readOnly value={result.link} className="text-xs" />
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(result.link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-400">
          When the job is done, open this invoice under Appointments and mark it complete to collect
          the remaining balance.
        </p>
        <Button
          onClick={() => {
            setResult(null);
            setName('');
            setEmail('');
            setPhone('');
            setDescription('');
            setTotal('');
            setUpfront('');
            setAutoCharge(false);
          }}
        >
          Create another invoice
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="inv-name">Customer name</Label>
          <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Warehouse LLC" />
        </div>
        <div>
          <Label htmlFor="inv-email">Customer email</Label>
          <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ap@acme.com" />
        </div>
      </div>

      <div>
        <Label htmlFor="inv-phone">Customer phone {channel !== 'email' && <span className="text-emergency">(required for text)</span>}</Label>
        <Input id="inv-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(614) 555-0123" />
      </div>

      <div>
        <Label htmlFor="inv-desc">Job description</Label>
        <Input id="inv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="200A service upgrade + subpanel, Acme warehouse" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="inv-total">Total ($)</Label>
          <Input id="inv-total" type="number" min="150" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="20000" />
        </div>
        <div>
          <Label htmlFor="inv-upfront">Upfront now ($)</Label>
          <Input id="inv-upfront" type="number" min="0" step="0.01" value={upfront} onChange={(e) => setUpfront(e.target.value)} placeholder="10000" />
        </div>
      </div>
      {remainderNote && <p className="text-sm text-volt">{remainderNote}</p>}

      <div>
        <Label htmlFor="inv-channel">Send invoice via</Label>
        <select
          id="inv-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-snow"
        >
          <option value="email">Email</option>
          <option value="sms">Text message</option>
          <option value="both">Email + Text</option>
        </select>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#ffe600]"
          checked={autoCharge}
          onChange={(e) => setAutoCharge(e.target.checked)}
        />
        <span>
          Auto-charge the remaining balance to the customer&apos;s card when I mark the job complete
          (saves their card from the upfront payment). If unchecked, they get a pay link for the
          balance.
        </span>
      </label>

      {error && <p className="text-sm text-emergency">{error}</p>}

      <Button onClick={submit} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating…
          </>
        ) : (
          'Create & send invoice'
        )}
      </Button>
    </div>
  );
}
