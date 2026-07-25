'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { geocodeAddress } from '@/lib/geocode';

const AddressSchema = z.object({
  label: z.string().trim().max(60).optional(),
  line1: z.string().trim().min(1, 'Street address is required').max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z.string().trim().length(2, 'Use a 2-letter state code').toUpperCase(),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code'),
  property_type: z.enum(['residential', 'commercial', 'agricultural']),
  is_default: z.boolean().optional(),
});

export type AddressInput = z.infer<typeof AddressSchema>;

export type AddressActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid address';
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function clearOtherDefaults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  keepId?: string,
) {
  let query = supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);
  if (keepId) query = query.neq('id', keepId);
  await query;
}

export async function createAddress(input: AddressInput): Promise<AddressActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sign in first' };

  const parsed = AddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const a = parsed.data;

  const geo = await geocodeAddress(a);

  const { count } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  const makeDefault = a.is_default || (count ?? 0) === 0;

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: user.id,
      label: a.label || null,
      line1: a.line1,
      line2: a.line2 || null,
      city: a.city,
      state: a.state,
      zip: a.zip,
      property_type: a.property_type,
      is_default: makeDefault,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Could not save address' };

  if (makeDefault) await clearOtherDefaults(supabase, user.id, data.id);
  revalidatePath('/account/addresses');
  revalidatePath('/book');
  return { ok: true, id: data.id };
}

export async function updateAddress(
  id: string,
  input: AddressInput,
): Promise<AddressActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sign in first' };

  const parsed = AddressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const a = parsed.data;

  const geo = await geocodeAddress(a);

  const { error } = await supabase
    .from('addresses')
    .update({
      label: a.label || null,
      line1: a.line1,
      line2: a.line2 || null,
      city: a.city,
      state: a.state,
      zip: a.zip,
      property_type: a.property_type,
      ...(a.is_default != null ? { is_default: a.is_default } : {}),
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: 'Could not update address' };

  if (a.is_default) await clearOtherDefaults(supabase, user.id, id);
  revalidatePath('/account/addresses');
  revalidatePath('/book');
  return { ok: true, id };
}

export async function deleteAddress(id: string): Promise<AddressActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sign in first' };

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    // FK from appointments blocks deleting an address that has history.
    return { ok: false, error: 'This address is attached to an appointment and cannot be deleted' };
  }
  revalidatePath('/account/addresses');
  revalidatePath('/book');
  return { ok: true, id };
}

export async function setDefaultAddress(id: string): Promise<AddressActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Sign in first' };

  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: 'Could not set default' };

  await clearOtherDefaults(supabase, user.id, id);
  revalidatePath('/account/addresses');
  revalidatePath('/book');
  return { ok: true, id };
}
