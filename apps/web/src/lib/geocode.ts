import 'server-only';

export interface GeocodeInput {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

/**
 * Geocode a street address via the Google Geocoding API.
 *
 * Returns null (never throws) when GOOGLE_MAPS_SERVER_KEY is unset, the
 * request fails, or no result is found — addresses simply save without
 * coordinates in that case.
 */
export async function geocodeAddress(input: GeocodeInput): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return null;

  const address = [input.line1, input.line2, `${input.city}, ${input.state} ${input.zip}`]
    .filter(Boolean)
    .join(', ');

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', key);

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      status?: string;
      results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
    };
    const loc = body.results?.[0]?.geometry?.location;
    if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
}
