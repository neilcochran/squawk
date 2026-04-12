/**
 * Pivotal altitude calculation for ground reference maneuvers.
 */

/**
 * Computes the pivotal altitude - the altitude above the ground at which a
 * ground reference point appears to remain stationary on the wingtip during
 * a turn. This altitude is used for eights-on-pylons and other ground
 * reference maneuvers.
 *
 * Pivotal altitude depends only on groundspeed and is independent of bank
 * angle or wind direction. It changes as groundspeed changes (e.g. with
 * headwind/tailwind components during the maneuver).
 *
 * Formula: pivotal altitude = GS^2 / (11.3 * g), where GS is in knots
 * and g = 32.174 ft/s^2. Simplified: PA_ft = GS_kt^2 / 11.3.
 *
 * The constant 11.3 arises from converting knots to ft/s and dividing by g:
 * (1 kt = 1.6878 ft/s), so (1.6878)^2 / 32.174 = 0.08852, and 1/0.08852 = 11.3.
 *
 * @param groundSpeedKt - Groundspeed in knots.
 * @returns Pivotal altitude in feet AGL.
 */
export function pivotalAltitude(groundSpeedKt: number): number {
  return (groundSpeedKt * groundSpeedKt) / 11.3;
}
