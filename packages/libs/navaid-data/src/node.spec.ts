import { describe, it, expect, assert } from 'vitest';

import { usBundledNavaids } from './node.js';

describe('usBundledNavaids', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledNavaids.records.length > 1_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert(usBundledNavaids.properties.generatedAt.length > 0);
    assert(usBundledNavaids.properties.nasrCycleDate.length > 0);
    expect(usBundledNavaids.properties.recordCount).toBe(usBundledNavaids.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledNavaids.records[0];
    assert(first !== undefined);
    expect(typeof first.identifier).toBe('string');
    assert(first.identifier.length > 0);
    expect(typeof first.name).toBe('string');
    expect(typeof first.type).toBe('string');
    expect(typeof first.status).toBe('string');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lon).toBe('number');
    expect(typeof first.country).toBe('string');
  });

  it('populates state for US navaids', () => {
    const us = usBundledNavaids.records.find((r) => r.country === 'US');
    assert(us !== undefined);
    expect(typeof us.state).toBe('string');
    assert(us.state && us.state.length > 0);
  });

  it('includes foreign navaids that the FAA publishes (e.g. Canadian navaids)', () => {
    const foreign = usBundledNavaids.records.filter((r) => r.country !== 'US');
    assert(foreign.length > 0, 'expected at least one foreign navaid');

    const canadian = usBundledNavaids.records.find((r) => r.country === 'CA');
    assert(canadian !== undefined, 'expected at least one Canadian navaid');
    expect(canadian.state, 'non-US navaids should have no state').toBe(undefined);
  });

  it('does not contain SHUTDOWN navaids', () => {
    const shutdown = usBundledNavaids.records.find((r) => r.status === 'SHUTDOWN');
    expect(shutdown, 'SHUTDOWN navaids should be excluded').toBe(undefined);
  });

  it('contains records with various navaid types', () => {
    const types = new Set(usBundledNavaids.records.map((r) => r.type));
    assert(types.has('VOR'), 'expected VOR type');
    assert(types.has('VORTAC'), 'expected VORTAC type');
    assert(types.has('NDB'), 'expected NDB type');
  });

  it('contains records with optional fields populated', () => {
    const withFreqMhz = usBundledNavaids.records.find((r) => r.frequencyMhz !== undefined);
    assert(withFreqMhz !== undefined, 'expected at least one navaid with frequencyMhz');

    const withFreqKhz = usBundledNavaids.records.find((r) => r.frequencyKhz !== undefined);
    assert(withFreqKhz !== undefined, 'expected at least one navaid with frequencyKhz');

    const withElev = usBundledNavaids.records.find((r) => r.elevationFt !== undefined);
    assert(withElev !== undefined, 'expected at least one navaid with elevationFt');

    const withArtcc = usBundledNavaids.records.find((r) => r.lowArtccId !== undefined);
    assert(withArtcc !== undefined, 'expected at least one navaid with lowArtccId');
  });

  it('publishes each frequency in the band of its navaid type', () => {
    const mhzTypes = new Set(['VOR', 'VORTAC', 'VOR/DME', 'TACAN', 'DME', 'VOT']);
    const khzTypes = new Set(['NDB', 'NDB/DME', 'MARINE_NDB']);
    for (const record of usBundledNavaids.records) {
      const label = `${record.identifier} ${record.type}`;
      if (record.frequencyMhz !== undefined) {
        assert(mhzTypes.has(record.type), `${label} carries a MHz frequency`);
        const vorBand = record.frequencyMhz >= 108 && record.frequencyMhz <= 117.95;
        const tacanPairing =
          record.type === 'TACAN' && record.frequencyMhz >= 133.3 && record.frequencyMhz <= 135.95;
        assert(vorBand || tacanPairing, `${label}: ${record.frequencyMhz} MHz`);
      }
      if (record.frequencyKhz !== undefined) {
        assert(khzTypes.has(record.type), `${label} carries a kHz frequency`);
        assert(
          record.frequencyKhz >= 190 && record.frequencyKhz <= 535,
          `${label}: ${record.frequencyKhz} kHz`,
        );
      }
      if (record.type === 'FAN_MARKER') {
        expect(record.frequencyMhz, label).toBe(undefined);
        expect(record.frequencyKhz, label).toBe(undefined);
      }
    }
  });

  it('includes TACANs whose channel pairs with a frequency above the VOR band', () => {
    const paired = usBundledNavaids.records.filter(
      (r) => r.frequencyMhz !== undefined && r.frequencyMhz > 117.95,
    );
    assert(paired.length > 0, 'expected TACANs on a channel with no VOR-band pairing');
    for (const record of paired) {
      expect(record.type, record.identifier).toBe('TACAN');
      assert(record.tacanChannel !== undefined, `${record.identifier} has no channel`);
    }
  });

  it('carries no magnetic variation on DME, VOT and fan marker records', () => {
    const withoutVariation = usBundledNavaids.records.filter(
      (r) => r.type === 'DME' || r.type === 'VOT' || r.type === 'FAN_MARKER',
    );
    assert(withoutVariation.length > 0);
    for (const record of withoutVariation) {
      const label = `${record.identifier} ${record.type}`;
      expect(record.magneticVariationDeg, label).toBe(undefined);
      expect(record.magneticVariationDirection, label).toBe(undefined);
      expect(record.magneticVariationYear, label).toBe(undefined);
    }
    const vortac = usBundledNavaids.records.find((r) => r.type === 'VORTAC');
    assert(vortac !== undefined);
    expect(typeof vortac.magneticVariationDeg).toBe('number');
  });

  it('carries a DME position only where it differs from the navaid position', () => {
    const withDme = usBundledNavaids.records.filter(
      (r) => r.dmeLat !== undefined || r.dmeLon !== undefined,
    );
    assert(withDme.length > 50, `navaids with a separate DME position: ${withDme.length}`);
    for (const record of withDme) {
      assert(record.dmeLat !== undefined && record.dmeLon !== undefined, record.identifier);
      assert(
        record.dmeLat !== record.lat || record.dmeLon !== record.lon,
        `${record.identifier} repeats its own position as the DME position`,
      );
    }
  });

  it('places the Thedford VOR/DME at its VOR site with the DME beside it', () => {
    const tdd = usBundledNavaids.records.find(
      (r) => r.identifier === 'TDD' && r.type === 'VOR/DME',
    );
    assert(tdd !== undefined, 'expected to find TDD navaid');
    expect(tdd.lat).toBeCloseTo(41.981677, 5);
    expect(tdd.lon).toBeCloseTo(-100.720301, 5);
    assert(tdd.dmeLat !== undefined && tdd.dmeLon !== undefined, 'expected a DME position');
    expect(tdd.dmeLat).toBeCloseTo(41.981664, 5);
    expect(tdd.dmeLon).toBeCloseTo(-100.719034, 5);
  });

  it('carries the FAA remarks, most of them unusable sectors', () => {
    const withRemarks = usBundledNavaids.records.filter((r) => r.remarks !== undefined);
    assert(
      withRemarks.length / usBundledNavaids.records.length > 0.5,
      `navaids with remarks: ${withRemarks.length}`,
    );
    let unusable = 0;
    for (const record of withRemarks) {
      assert(record.remarks !== undefined && record.remarks.length > 0, record.identifier);
      for (const remark of record.remarks) {
        assert(remark.length > 0 && remark === remark.trim(), `${record.identifier}: "${remark}"`);
        if (remark.includes('UNUSBL')) {
          unusable++;
        }
      }
    }
    assert(unusable > 1_000, `unusable-sector remarks: ${unusable}`);
    expect(
      withRemarks.find((r) => r.remarks?.some((remark) => /^(3RD|THIRD) PARTY/.test(remark))),
      'survey-source notes should not be carried',
    ).toBe(undefined);
  });

  it('carries the DME status where the FAA publishes one separately', () => {
    const withDmeStatus = usBundledNavaids.records.filter((r) => r.dmeStatus !== undefined);
    assert(withDmeStatus.length > 400, `navaids with a DME status: ${withDmeStatus.length}`);
    const dmeTypes = new Set(['DME', 'VOR/DME', 'NDB/DME']);
    for (const record of withDmeStatus) {
      assert(dmeTypes.has(record.type), `${record.identifier} ${record.type} has a DME status`);
      expect(record.dmeStatus, record.identifier).not.toBe('SHUTDOWN');
    }
    assert(
      withDmeStatus.some((r) => r.dmeStatus !== r.status),
      'expected a navaid whose DME status differs from its own',
    );
  });

  it('carries VOR receiver checkpoints on VOR-class navaids', () => {
    const withCheckpoints = usBundledNavaids.records.filter((r) => r.checkpoints !== undefined);
    assert(withCheckpoints.length > 100, `navaids with checkpoints: ${withCheckpoints.length}`);
    const vorTypes = new Set(['VOR', 'VOR/DME', 'VORTAC']);
    for (const record of withCheckpoints) {
      assert(vorTypes.has(record.type), `${record.identifier} ${record.type} has checkpoints`);
      assert(record.checkpoints !== undefined && record.checkpoints.length > 0);
      for (const checkpoint of record.checkpoints) {
        const label = `${record.identifier} checkpoint`;
        assert(checkpoint.type === 'GROUND' || checkpoint.type === 'AIRBORNE', label);
        assert(
          checkpoint.magneticBearingDeg >= 0 && checkpoint.magneticBearingDeg <= 360,
          `${label}: bearing ${checkpoint.magneticBearingDeg}`,
        );
        assert(checkpoint.description.length > 0, label);
      }
    }
    const ack = usBundledNavaids.records.find(
      (r) => r.identifier === 'ACK' && r.type === 'VOR/DME',
    );
    assert(ack?.checkpoints !== undefined, 'expected the Nantucket VOR/DME to have a checkpoint');
    expect(ack.checkpoints[0]?.airportId).toBe('ACK');
  });

  it('names the associated city on every record', () => {
    for (const record of usBundledNavaids.records) {
      assert(record.city !== undefined && record.city.length > 0, record.identifier);
    }
  });

  it('contains identifiers shared by several navaids', () => {
    const counts = new Map<string, number>();
    for (const record of usBundledNavaids.records) {
      counts.set(record.identifier, (counts.get(record.identifier) ?? 0) + 1);
    }
    assert(
      [...counts.values()].some((count) => count > 1),
      'expected at least one identifier shared by several navaids',
    );
  });

  it('can find a known navaid by scanning records', () => {
    const bos = usBundledNavaids.records.find((r) => r.identifier === 'BOS');
    assert(bos !== undefined, 'expected to find BOS navaid');
    expect(bos.country).toBe('US');
    assert(bos.type === 'VOR' || bos.type === 'VORTAC' || bos.type === 'VOR/DME');
  });
});
