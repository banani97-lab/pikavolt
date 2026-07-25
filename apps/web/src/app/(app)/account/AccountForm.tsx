'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { updateProfile } from './actions';

interface AccountFormProps {
  email: string;
  fullName: string;
  phone: string;
  marketingOptIn: boolean;
}

export function AccountForm(props: AccountFormProps) {
  const [fullName, setFullName] = useState(props.fullName);
  const [phone, setPhone] = useState(props.phone);
  const [marketingOptIn, setMarketingOptIn] = useState(props.marketingOptIn);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
        phone,
        marketing_opt_in: marketingOptIn,
      });
      setMessage(
        result.ok
          ? { kind: 'ok', text: 'Profile saved.' }
          : { kind: 'error', text: result.error },
      );
    });
  };

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="acct-email">Email</Label>
        <Input id="acct-email" value={props.email} disabled />
        <p className="mt-1 text-xs text-zinc-500">Your sign-in email can&apos;t be changed here.</p>
      </div>
      <div>
        <Label htmlFor="acct-name">Full name</Label>
        <Input
          id="acct-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <Label htmlFor="acct-phone">Phone</Label>
        <Input
          id="acct-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(614) 555-0123"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#ffe600]"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
        />
        <span>
          Send me occasional deals and updates from Pikavolt (promos, sweepstakes, seasonal
          safety tips).
        </span>
      </label>

      {message && (
        <p className={message.kind === 'ok' ? 'text-sm text-volt' : 'text-sm text-emergency'}>
          {message.text}
        </p>
      )}

      <Button onClick={save} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          'Save profile'
        )}
      </Button>
    </div>
  );
}
