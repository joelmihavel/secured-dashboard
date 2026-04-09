/**
 * Property address geocoding via Google Maps Geocoding API.
 * Non-blocking -- errors are logged but do not fail the extraction pipeline.
 *
 * Ported from: supabase/functions/process-document/index.ts geocodePropertyAddress()
 *
 * Changes from Deno version:
 * - Uses `process.env` instead of `Deno.env.get()`
 * - Uses Node.js native fetch
 * - Accepts Supabase client as parameter
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface GeocodableData {
  property_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_pincode?: string;
}

/**
 * Geocode the property address and store coordinates in the extraction record.
 * Uses Google Maps Geocoding API.
 *
 * @param supabase - Supabase service client
 * @param extractedRentalInfoId - extraction record ID
 * @param extractedData - extracted address fields
 */
export async function geocodePropertyAddress(
  supabase: SupabaseClient,
  extractedRentalInfoId: string,
  extractedData: GeocodableData
): Promise<void> {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    console.log('[geocoding] GOOGLE_MAPS_API_KEY not configured, skipping');
    return;
  }

  if (!extractedData.property_address) {
    console.log('[geocoding] No property address to geocode, skipping');
    return;
  }

  // Construct full address from extracted components
  const addressParts: string[] = [];

  if (extractedData.property_name) {
    addressParts.push(extractedData.property_name);
  }
  if (extractedData.property_address) {
    addressParts.push(extractedData.property_address);
  }
  if (extractedData.property_city) {
    addressParts.push(extractedData.property_city);
  }
  if (extractedData.property_state) {
    addressParts.push(extractedData.property_state);
  }
  if (extractedData.property_pincode) {
    addressParts.push(extractedData.property_pincode);
  }

  if (addressParts.length < 2) {
    console.log('[geocoding] Skipping geocoding - insufficient address components');
    return;
  }

  // Add India to improve geocoding accuracy
  const fullAddress = addressParts.join(', ') + ', India';
  const encodedAddress = encodeURIComponent(fullAddress);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`;

  console.log(`[geocoding] Geocoding address: ${fullAddress}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding API HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    console.log(`[geocoding] Geocoding returned no results: ${data.status}`);
    return;
  }

  const bestResult = data.results[0];
  const location = bestResult.geometry?.location;

  if (!location || !location.lat || !location.lng) {
    console.log('[geocoding] Geocoding result missing coordinates');
    return;
  }

  console.log(`[geocoding] Geocoded to: (${location.lat}, ${location.lng}) - ${bestResult.formatted_address}`);

  // Update the extracted_rental_info record with geocoding results
  const { error: updateError } = await supabase
    .from('extracted_rental_info')
    .update({
      latitude: location.lat,
      longitude: location.lng,
      geocode_formatted_address: bestResult.formatted_address,
      geocode_place_id: bestResult.place_id,
      geocoded_at: new Date().toISOString(),
    })
    .eq('id', extractedRentalInfoId);

  if (updateError) {
    console.error('[geocoding] Failed to store geocoding result:', updateError);
    throw updateError;
  }

  console.log(`[geocoding] Successfully geocoded property for rental info ${extractedRentalInfoId}`);
}
