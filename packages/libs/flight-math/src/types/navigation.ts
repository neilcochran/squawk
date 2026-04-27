/**
 * Navigation-related type definitions.
 */

/**
 * Type of holding pattern entry procedure based on the angle between the
 * aircraft's heading to the fix and the holding pattern's inbound course.
 *
 * - `direct` - Fly directly to the fix and enter the hold (largest sector, ~180 degrees).
 * - `teardrop` - Fly to the fix, turn outbound on a 30-degree offset, then turn back inbound.
 * - `parallel` - Fly to the fix, turn to fly parallel to the inbound course outbound, then turn back.
 */
export type HoldingPatternEntryType = 'direct' | 'teardrop' | 'parallel';
