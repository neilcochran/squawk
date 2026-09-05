/**
 * Decoded ADS-B Target State and Status (BDS 6,2, type code 29) - the
 * pilot's selected altitude/heading targets, altimeter setting, and
 * active autopilot/nav modes, per RTCA DO-260B section 2.2.3.2.7.1.
 */
export interface TargetStateAndStatus {
  /** Source of the selected altitude target - undefined when `selectedAltitudeFt` is unavailable. */
  selectedAltitudeSource: 'mcpFcu' | 'fms' | undefined;
  /** MCP/FCU or FMS selected altitude target, in feet. Undefined if not available. */
  selectedAltitudeFt: number | undefined;
  /** Barometric pressure (altimeter) setting, in millibars/hectopascals. Undefined if not available. */
  baroPressureSettingMb: number | undefined;
  /** Selected heading/track angle, in degrees. Undefined if not available. */
  selectedHeadingDeg: number | undefined;
  /** Navigation Accuracy Category for Position, 0-15 (higher is more accurate). */
  navAccuracyCategoryPosition: number;
  /** Whether the reported altitude source meets the Navigation Integrity Category barometric requirement. */
  nicBaro: boolean;
  /** Source Integrity Level, 0-3 (higher is more reliable). */
  sourceIntegrityLevel: number;
  /** Whether the autopilot is engaged. Undefined when mode status is not reported. */
  autopilotEngaged: boolean | undefined;
  /** Whether VNAV mode is active. Undefined when mode status is not reported. */
  vnavModeActive: boolean | undefined;
  /** Whether altitude-hold mode is active. Undefined when mode status is not reported. */
  altitudeHoldModeActive: boolean | undefined;
  /** Whether approach mode is active. Undefined when mode status is not reported. */
  approachModeActive: boolean | undefined;
  /** Whether LNAV mode is active. Undefined when mode status is not reported. */
  lnavModeActive: boolean | undefined;
  /** Whether ACAS/TCAS is operational (not inhibited or failed). Always reported, regardless of mode status. */
  tcasOperational: boolean;
}
