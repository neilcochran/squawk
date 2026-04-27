/**
 * Glide planning calculations: glide distance from altitude and glide ratio,
 * with optional wind correction.
 */

/**
 * Computes the maximum glide distance in nautical miles from a given altitude
 * AGL and a consumer-supplied glide ratio.
 *
 * The glide ratio is the horizontal distance traveled per unit of altitude
 * lost (e.g. a glide ratio of 10 means the aircraft travels 10 units
 * horizontally for every 1 unit of altitude lost). This value is
 * aircraft-specific and should be obtained from the aircraft's POH.
 *
 * @param altitudeAglFt - Altitude above ground level in feet.
 * @param glideRatio - Glide ratio (dimensionless, e.g. 10:1 = 10).
 * @returns Maximum glide distance in nautical miles (no wind).
 */
export function glideDistance(altitudeAglFt: number, glideRatio: number): number {
  const distanceFt = altitudeAglFt * glideRatio;
  return distanceFt / 6076.11549;
}

/**
 * Computes the glide distance adjusted for a headwind or tailwind component.
 *
 * Wind affects glide distance by changing the aircraft's groundspeed while the
 * vertical descent rate remains the same. A headwind reduces glide distance; a
 * tailwind extends it.
 *
 * The wind correction scales the no-wind glide distance by the ratio of
 * groundspeed to true airspeed during the glide. The consumer provides the
 * best-glide TAS and the headwind/tailwind component (positive = headwind,
 * negative = tailwind).
 *
 * @param altitudeAglFt - Altitude above ground level in feet.
 * @param glideRatio - Glide ratio (dimensionless, e.g. 10:1 = 10).
 * @param bestGlideTasKt - True airspeed at best glide speed in knots.
 * @param headwindKt - Headwind component in knots (positive = headwind, negative = tailwind).
 * @returns Adjusted glide distance in nautical miles.
 */
export function glideDistanceWithWind(
  altitudeAglFt: number,
  glideRatio: number,
  bestGlideTasKt: number,
  headwindKt: number,
): number {
  const noWindDistance = glideDistance(altitudeAglFt, glideRatio);
  const groundspeed = bestGlideTasKt - headwindKt;
  return noWindDistance * (groundspeed / bestGlideTasKt);
}
