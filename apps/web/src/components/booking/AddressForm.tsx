'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  createAddress,
  updateAddress,
  type AddressInput,
} from '@/app/(app)/account/addresses/actions';
import type { AddressOption } from './types';

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'agricultural', label: 'Agricultural / Farm' },
] as const;

interface AddressFormProps {
  /** When set, the form edits this address instead of creating one. */
  address?: AddressOption;
  onSaved: (id: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function AddressForm({ address, onSaved, onCancel, submitLabel }: AddressFormProps) {
  const [form, setForm] = useState<AddressInput>({
    label: address?.label ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? 'OH',
    zip: address?.zip ?? '',
    property_type:
      (address?.property_type as AddressInput['property_type']) ?? 'residential',
    is_default: address?.is_default ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = address
        ? await updateAddress(address.id, form)
        : await createAddress(form);
      if (result.ok) onSaved(result.id);
      else setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="addr-label">Label (optional)</Label>
          <Input
            id="addr-label"
            placeholder="Home, Shop, Barn…"
            value={form.label ?? ''}
            onChange={(e) => set('label', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="addr-type">Property type</Label>
          <select
            id="addr-type"
            className="h-11 w-full rounded-lg border border-white/15 bg-storm px-3 text-sm text-white focus:border-volt/60 focus:outline-none focus:ring-2 focus:ring-volt/30"
            value={form.property_type}
            onChange={(e) =>
              set('property_type', e.target.value as AddressInput['property_type'])
            }
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="addr-line1">Street address</Label>
        <Input
          id="addr-line1"
          placeholder="123 Main St"
          value={form.line1}
          onChange={(e) => set('line1', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="addr-line2">Apt / suite / unit (optional)</Label>
        <Input
          id="addr-line2"
          value={form.line2 ?? ''}
          onChange={(e) => set('line2', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="addr-city">City</Label>
          <Input
            id="addr-city"
            placeholder="Dublin"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="addr-state">State</Label>
          <Input
            id="addr-state"
            maxLength={2}
            value={form.state}
            onChange={(e) => set('state', e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <Label htmlFor="addr-zip">ZIP</Label>
          <Input
            id="addr-zip"
            placeholder="43016"
            value={form.zip}
            onChange={(e) => set('zip', e.target.value)}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#ffe600]"
          checked={!!form.is_default}
          onChange={(e) => set('is_default', e.target.checked)}
        />
        Set as my default address
      </label>

      {error && <p className="text-sm text-emergency">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Saving…' : (submitLabel ?? (address ? 'Save changes' : 'Save address'))}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
