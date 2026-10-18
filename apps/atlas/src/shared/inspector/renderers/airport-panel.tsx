import type { ReactElement } from 'react';

import type { Airport } from '@squawk/types';

import {
  airportApproachCallSign,
  airportTowerCallSign,
  formatAirportFacilityType,
  formatAirportFrequency,
  formatAirportRunway,
  formatAirportStatus,
  formatFrequencyProvider,
  formatPavementClassification,
  formatRunwayRvr,
} from '../formatters.ts';

import { InspectorDetailLine } from './inspector-detail-line.tsx';
import { InspectorRow, InspectorSection } from './inspector-row.tsx';

/**
 * Props for {@link AirportPanel}.
 */
export interface AirportPanelProps {
  /** The airport record to render. */
  record: Airport;
}

/**
 * Per-type renderer for an `airport` entity. Shows location, identification,
 * physical characteristics, runways, and frequencies. The runway and
 * frequency sections render only when the record actually has entries so
 * the panel stays compact for small private fields.
 *
 * Each runway row adds its published pavement strength rating and the RVR
 * sites at each end under the dimensions. Each frequency row gives the
 * frequency with the FAA's receive-only / on-request qualifiers, then its
 * sectorization, the facility that answers when it is not the airport's own
 * (a TRACON, an RCAG, a flight service station), and the FAA's remark. The
 * tower and approach call signs, which the FAA repeats on every frequency,
 * appear once in the facility section instead.
 */
export function AirportPanel({ record }: AirportPanelProps): ReactElement {
  return (
    <>
      <InspectorSection title="Location">
        <InspectorRow label="City">{record.city}</InspectorRow>
        <InspectorRow label="State">{record.state}</InspectorRow>
        <InspectorRow label="Country">{record.country}</InspectorRow>
        <InspectorRow label="Elevation">
          {record.elevationFt !== undefined ? `${record.elevationFt} ft MSL` : null}
        </InspectorRow>
        <InspectorRow label="Time zone">{record.timezone}</InspectorRow>
      </InspectorSection>
      <InspectorSection title="Facility">
        <InspectorRow label="Type">{formatAirportFacilityType(record.facilityType)}</InspectorRow>
        <InspectorRow label="Status">{formatAirportStatus(record.status)}</InspectorRow>
        <InspectorRow label="Use">
          {record.useType === 'PUBLIC' ? 'Public' : 'Private'}
        </InspectorRow>
        <InspectorRow label="Tower">{record.towerType ?? null}</InspectorRow>
        <InspectorRow label="Tower call sign">{airportTowerCallSign(record)}</InspectorRow>
        <InspectorRow label="Approach">{airportApproachCallSign(record)}</InspectorRow>
        <InspectorRow label="Pattern altitude">
          {record.trafficPatternAltitudeFtAgl !== undefined
            ? `${record.trafficPatternAltitudeFtAgl} ft AGL`
            : null}
        </InspectorRow>
        <InspectorRow label="ARTCC">{record.artccId ?? null}</InspectorRow>
        <InspectorRow label="Sectional">{record.sectionChart ?? null}</InspectorRow>
      </InspectorSection>
      {record.runways.length > 0 ? (
        <InspectorSection title={`Runways (${record.runways.length})`}>
          {record.runways.map((runway) => {
            const rvr = formatRunwayRvr(runway);
            return (
              <InspectorRow key={runway.id} label={runway.id}>
                <span className="block">
                  {formatAirportRunway(runway.lengthFt, runway.widthFt, runway.surfaceType)}
                </span>
                {runway.pavementClassification !== undefined ? (
                  <InspectorDetailLine>
                    {formatPavementClassification(runway.pavementClassification)}
                  </InspectorDetailLine>
                ) : null}
                {rvr !== null ? <InspectorDetailLine>{rvr}</InspectorDetailLine> : null}
              </InspectorRow>
            );
          })}
        </InspectorSection>
      ) : null}
      {record.frequencies.length > 0 ? (
        <InspectorSection title={`Frequencies (${record.frequencies.length})`}>
          {record.frequencies.map((frequency, idx) => {
            const provider =
              frequency.provider !== record.faaId ? formatFrequencyProvider(frequency) : null;
            return (
              <InspectorRow key={`${frequency.use}-${idx}`} label={frequency.use}>
                <span className="block tabular-nums">{formatAirportFrequency(frequency)}</span>
                {frequency.sectorization !== undefined ? (
                  <InspectorDetailLine>{frequency.sectorization}</InspectorDetailLine>
                ) : null}
                {provider !== null ? (
                  <InspectorDetailLine>{`via ${provider}`}</InspectorDetailLine>
                ) : null}
                {frequency.remark !== undefined ? (
                  <InspectorDetailLine>{frequency.remark}</InspectorDetailLine>
                ) : null}
              </InspectorRow>
            );
          })}
        </InspectorSection>
      ) : null}
    </>
  );
}
