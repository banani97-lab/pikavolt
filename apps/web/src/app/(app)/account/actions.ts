'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const ProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+()\-.\s]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  marketing_opt_in: z.boolean(),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export type ProfileActionResult = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: ProfileInput): Promise<ProfileActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in first' };

  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid profile' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      marketing_opt_in: parsed.data.marketing_opt_in,
    })
    .eq('id', user.id);
  if (error) return { ok: false, error: 'Could not save profile' };

  revalidatePath('/account');
  return { ok: true };
}
