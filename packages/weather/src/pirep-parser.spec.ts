import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePirep } from './pirep-parser.js';

describe('parsePirep', () => {
  describe('report type', () => {
    it('parses routine PIREP (UA)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/RM TEST');
      assert.equal(pirep.type, 'UA');
      assert.equal(pirep.raw, 'UA /OV OKC/TM 1530/FL085/TP C172/RM TEST');
    });

    it('parses urgent PIREP (UUA)', () => {
      const pirep = parsePirep('UUA /OV OKC/TM 1530/FL085/TP B738/TB SEV/RM SEVERE TURBULENCE');
      assert.equal(pirep.type, 'UUA');
    });
  });

  describe('/OV - location', () => {
    it('parses simple station identifier', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'station');
      if (pirep.location.locationType === 'station') {
        assert.equal(pirep.location.point.identifier, 'OKC');
        assert.equal(pirep.location.point.radialDeg, undefined);
        assert.equal(pirep.location.point.distanceNm, undefined);
      }
    });

    it('parses 4-letter ICAO identifier', () => {
      const pirep = parsePirep('UA /OV KOKC/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'station');
      if (pirep.location.locationType === 'station') {
        assert.equal(pirep.location.point.identifier, 'KOKC');
      }
    });

    it('parses station with radial and distance', () => {
      const pirep = parsePirep('UA /OV SAV180020/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'station');
      if (pirep.location.locationType === 'station') {
        assert.equal(pirep.location.point.identifier, 'SAV');
        assert.equal(pirep.location.point.radialDeg, 180);
        assert.equal(pirep.location.point.distanceNm, 20);
      }
    });

    it('parses station with radial/distance and space', () => {
      const pirep = parsePirep('UA /OV SAV 180020/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'station');
      if (pirep.location.locationType === 'station') {
        assert.equal(pirep.location.point.identifier, 'SAV');
        assert.equal(pirep.location.point.radialDeg, 180);
        assert.equal(pirep.location.point.distanceNm, 20);
      }
    });

    it('parses route between simple stations', () => {
      const pirep = parsePirep('UA /OV DHT-AMA/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'route');
      if (pirep.location.locationType === 'route') {
        assert.equal(pirep.location.points.length, 2);
        assert.equal(pirep.location.points[0]!.identifier, 'DHT');
        assert.equal(pirep.location.points[1]!.identifier, 'AMA');
      }
    });

    it('parses multi-segment route', () => {
      const pirep = parsePirep('UA /OV DHT-AMA-CDS/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'route');
      if (pirep.location.locationType === 'route') {
        assert.equal(pirep.location.points.length, 3);
        assert.equal(pirep.location.points[0]!.identifier, 'DHT');
        assert.equal(pirep.location.points[1]!.identifier, 'AMA');
        assert.equal(pirep.location.points[2]!.identifier, 'CDS');
      }
    });

    it('parses route with radial/distance points', () => {
      const pirep = parsePirep('UA /OV ABC090025-DEF180010/TM 1530/FL085/TP C172');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'route');
      if (pirep.location.locationType === 'route') {
        assert.equal(pirep.location.points.length, 2);
        assert.equal(pirep.location.points[0]!.identifier, 'ABC');
        assert.equal(pirep.location.points[0]!.radialDeg, 90);
        assert.equal(pirep.location.points[0]!.distanceNm, 25);
        assert.equal(pirep.location.points[1]!.identifier, 'DEF');
        assert.equal(pirep.location.points[1]!.radialDeg, 180);
        assert.equal(pirep.location.points[1]!.distanceNm, 10);
      }
    });

    it('parses latitude/longitude location', () => {
      const pirep = parsePirep('UA /OV 3412N11830W/TM 1530/FL350/TP B738');
      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'latlon');
      if (pirep.location.locationType === 'latlon') {
        assert.ok(pirep.location.coordinates.lat > 34.19 && pirep.location.coordinates.lat < 34.21);
        assert.ok(
          pirep.location.coordinates.lon > -118.51 && pirep.location.coordinates.lon < -118.49,
        );
      }
    });
  });

  describe('/TM - time', () => {
    it('parses 4-digit time', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      assert.ok(pirep.time);
      assert.equal(pirep.time.hour, 15);
      assert.equal(pirep.time.minute, 30);
    });

    it('parses time with Z suffix', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530Z/FL085/TP C172');
      assert.ok(pirep.time);
      assert.equal(pirep.time.hour, 15);
      assert.equal(pirep.time.minute, 30);
    });
  });

  describe('field splitting', () => {
    it('handles markers with no space before alpha values', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FLUNKN/TP C172/SKCLR/TB NEG');
      assert.equal(pirep.altitudeQualifier, 'UNKN');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition[0]!.coverage, 'CLR');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'NEG');
    });
  });

  describe('/FL - flight level', () => {
    it('parses numeric flight level', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      assert.equal(pirep.altitudeFtMsl, 8500);
    });

    it('parses high flight level', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B738');
      assert.equal(pirep.altitudeFtMsl, 35000);
    });

    it('parses UNKN flight level', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL UNKN/TP C172');
      assert.equal(pirep.altitudeFtMsl, undefined);
      assert.equal(pirep.altitudeQualifier, 'UNKN');
    });

    it('parses DURD (during descent)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL DURD/TP C172');
      assert.equal(pirep.altitudeQualifier, 'DURD');
    });

    it('parses DURC (during climb)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL DURC/TP C172');
      assert.equal(pirep.altitudeQualifier, 'DURC');
    });
  });

  describe('/TP - aircraft type', () => {
    it('parses aircraft type designator', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      assert.equal(pirep.aircraftType, 'C172');
    });

    it('parses long aircraft type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B737-800');
      assert.equal(pirep.aircraftType, 'B737-800');
    });
  });

  describe('/SK - sky condition', () => {
    it('parses single layer with base', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK OVC025');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'OVC');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, 2500);
    });

    it('parses layer with base and top', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKN065-TOP090');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'BKN');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, 6500);
      assert.equal(pirep.skyCondition[0]!.topFtMsl, 9000);
    });

    it('parses multiple layers', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKN040-TOP060 OVC100-TOP120');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 2);
      assert.equal(pirep.skyCondition[0]!.coverage, 'BKN');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, 4000);
      assert.equal(pirep.skyCondition[0]!.topFtMsl, 6000);
      assert.equal(pirep.skyCondition[1]!.coverage, 'OVC');
      assert.equal(pirep.skyCondition[1]!.baseFtMsl, 10000);
      assert.equal(pirep.skyCondition[1]!.topFtMsl, 12000);
    });

    it('parses CLR sky', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK CLR');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'CLR');
    });

    it('parses compact notation (base-coverage-top)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK 010BKN028');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'BKN');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, 1000);
      assert.equal(pirep.skyCondition[0]!.topFtMsl, 2800);
    });

    it('parses layer with unknown top', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKN040-TOPUNKN');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'BKN');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, 4000);
      assert.equal(pirep.skyCondition[0]!.topFtMsl, undefined);
    });

    it('parses layer with unknown base', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKNUNKN-TOP090');
      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'BKN');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, undefined);
      assert.equal(pirep.skyCondition[0]!.topFtMsl, 9000);
    });
  });

  describe('/WX - weather and visibility', () => {
    it('parses visibility in statute miles', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 5SM');
      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 5);
    });

    it('parses fractional visibility', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 1/2SM');
      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 0.5);
    });

    it('parses visibility with weather phenomena', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 3SM -RA BR');
      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 3);
      assert.ok(pirep.weatherPhenomena);
      assert.equal(pirep.weatherPhenomena.length, 2);
      assert.equal(pirep.weatherPhenomena[0]!.intensity, 'LIGHT');
      assert.deepEqual(pirep.weatherPhenomena[0]!.phenomena, ['RA']);
      assert.deepEqual(pirep.weatherPhenomena[1]!.phenomena, ['BR']);
    });

    it('parses P6SM (greater than 6 SM)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX P6SM');
      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 6);
      assert.equal(pirep.visibility.isMoreThan, true);
    });

    it('parses less-than visibility (M prefix)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX M1/4SM FG');
      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 0.25);
      assert.equal(pirep.visibility.isLessThan, true);
      assert.ok(pirep.weatherPhenomena);
      assert.equal(pirep.weatherPhenomena.length, 1);
      assert.deepEqual(pirep.weatherPhenomena[0]!.phenomena, ['FG']);
    });

    it('parses mixed number visibility', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 1 1/2SM');
      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 1.5);
    });

    it('parses weather phenomena without visibility', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX FZRA');
      assert.ok(pirep.weatherPhenomena);
      assert.equal(pirep.weatherPhenomena.length, 1);
      assert.equal(pirep.weatherPhenomena[0]!.descriptor, 'FZ');
      assert.deepEqual(pirep.weatherPhenomena[0]!.phenomena, ['RA']);
      assert.equal(pirep.visibility, undefined);
    });
  });

  describe('/TA - temperature', () => {
    it('parses positive temperature', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA 15');
      assert.equal(pirep.temperatureC, 15);
    });

    it('parses negative temperature with minus sign', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA -10');
      assert.equal(pirep.temperatureC, -10);
    });

    it('parses negative temperature with M prefix', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA M15');
      assert.equal(pirep.temperatureC, -15);
    });

    it('parses zero temperature', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA 0');
      assert.equal(pirep.temperatureC, 0);
    });
  });

  describe('/WV - wind', () => {
    it('parses wind direction and speed', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WV 27045');
      assert.ok(pirep.wind);
      assert.equal(pirep.wind.directionDegMagnetic, 270);
      assert.equal(pirep.wind.speedKt, 45);
    });

    it('parses wind with KT suffix', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WV 27045KT');
      assert.ok(pirep.wind);
      assert.equal(pirep.wind.directionDegMagnetic, 270);
      assert.equal(pirep.wind.speedKt, 45);
    });
  });

  describe('/TB - turbulence', () => {
    it('parses single intensity', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB LGT');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence.length, 1);
      assert.equal(pirep.turbulence[0]!.intensity, 'LGT');
    });

    it('parses negative turbulence', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB NEG');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence.length, 1);
      assert.equal(pirep.turbulence[0]!.intensity, 'NEG');
    });

    it('parses intensity range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD-SEV');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence.length, 1);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.intensityHigh, 'SEV');
    });

    it('parses turbulence with type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD CAT');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.type, 'CAT');
    });

    it('parses turbulence with frequency', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB LGT CHOP INT');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'LGT');
      assert.equal(pirep.turbulence[0]!.type, 'CHOP');
      assert.equal(pirep.turbulence[0]!.frequency, 'INT');
    });

    it('parses turbulence with altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD 060-090');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.baseFtMsl, 6000);
      assert.equal(pirep.turbulence[0]!.topFtMsl, 9000);
    });

    it('parses turbulence with BLO modifier', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD BLO 100');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.belowAltitude, 10000);
    });

    it('parses turbulence with ABV modifier', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B738/TB SEV ABV FL350');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'SEV');
      assert.equal(pirep.turbulence[0]!.aboveAltitude, 35000);
    });

    it('parses extreme turbulence', () => {
      const pirep = parsePirep('UUA /OV OKC/TM 1530/FL085/TP B738/TB EXTRM');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'EXTRM');
    });

    it('parses turbulence with LLWS type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL020/TP C172/TB MOD LLWS');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.type, 'LLWS');
    });

    it('parses turbulence with OCC frequency', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB LGT CAT OCC');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'LGT');
      assert.equal(pirep.turbulence[0]!.type, 'CAT');
      assert.equal(pirep.turbulence[0]!.frequency, 'OCC');
    });

    it('parses turbulence with CONT frequency', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD CHOP CONT');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.type, 'CHOP');
      assert.equal(pirep.turbulence[0]!.frequency, 'CONT');
    });

    it('parses turbulence with FL-prefixed altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B738/TB MOD CAT FL280-FL350');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[0]!.type, 'CAT');
      assert.equal(pirep.turbulence[0]!.baseFtMsl, 28000);
      assert.equal(pirep.turbulence[0]!.topFtMsl, 35000);
    });

    it('parses multiple turbulence layers separated by /', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL120/TP B738/TB LGT 060-080/MOD CAT 100-120');
      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence.length, 2);
      assert.equal(pirep.turbulence[0]!.intensity, 'LGT');
      assert.equal(pirep.turbulence[0]!.baseFtMsl, 6000);
      assert.equal(pirep.turbulence[0]!.topFtMsl, 8000);
      assert.equal(pirep.turbulence[1]!.intensity, 'MOD');
      assert.equal(pirep.turbulence[1]!.type, 'CAT');
      assert.equal(pirep.turbulence[1]!.baseFtMsl, 10000);
      assert.equal(pirep.turbulence[1]!.topFtMsl, 12000);
    });
  });

  describe('/IC - icing', () => {
    it('parses single intensity', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing.length, 1);
      assert.equal(pirep.icing[0]!.intensity, 'LGT');
    });

    it('parses negative icing', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC NEG');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'NEG');
    });

    it('parses icing with type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT RIME');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'LGT');
      assert.equal(pirep.icing[0]!.type, 'RIME');
    });

    it('parses icing intensity range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT-MOD RIME');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'LGT');
      assert.equal(pirep.icing[0]!.intensityHigh, 'MOD');
      assert.equal(pirep.icing[0]!.type, 'RIME');
    });

    it('parses trace icing', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC TR RIME');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'TR');
      assert.equal(pirep.icing[0]!.type, 'RIME');
    });

    it('parses icing with altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC MOD CLR 060-090');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'MOD');
      assert.equal(pirep.icing[0]!.type, 'CLR');
      assert.equal(pirep.icing[0]!.baseFtMsl, 6000);
      assert.equal(pirep.icing[0]!.topFtMsl, 9000);
    });

    it('parses mixed icing type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC MOD MXD');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.type, 'MXD');
    });

    it('parses SLD icing type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC MOD SLD');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'MOD');
      assert.equal(pirep.icing[0]!.type, 'SLD');
    });

    it('parses icing with FL-prefixed altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT RIME FL040-FL080');
      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'LGT');
      assert.equal(pirep.icing[0]!.type, 'RIME');
      assert.equal(pirep.icing[0]!.baseFtMsl, 4000);
      assert.equal(pirep.icing[0]!.topFtMsl, 8000);
    });

    it('parses multiple icing layers separated by /', () => {
      const pirep = parsePirep(
        'UA /OV OKC/TM 1530/FL120/TP B738/IC LGT RIME 040-060/MOD CLR 080-100',
      );
      assert.ok(pirep.icing);
      assert.equal(pirep.icing.length, 2);
      assert.equal(pirep.icing[0]!.intensity, 'LGT');
      assert.equal(pirep.icing[0]!.type, 'RIME');
      assert.equal(pirep.icing[0]!.baseFtMsl, 4000);
      assert.equal(pirep.icing[0]!.topFtMsl, 6000);
      assert.equal(pirep.icing[1]!.intensity, 'MOD');
      assert.equal(pirep.icing[1]!.type, 'CLR');
      assert.equal(pirep.icing[1]!.baseFtMsl, 8000);
      assert.equal(pirep.icing[1]!.topFtMsl, 10000);
    });
  });

  describe('/RM - remarks', () => {
    it('parses remarks as free text', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/RM SMOOTH RIDE');
      assert.equal(pirep.remarks, 'SMOOTH RIDE');
    });

    it('preserves full remarks text including slashes', () => {
      const pirep = parsePirep(
        'UA /OV OKC/TM 1530/FL085/TP C172/RM BUMPY BETWEEN 060-090 SMOOTH ABOVE',
      );
      assert.equal(pirep.remarks, 'BUMPY BETWEEN 060-090 SMOOTH ABOVE');
    });
  });

  describe('full PIREPs', () => {
    it('parses a fully populated routine PIREP', () => {
      const raw =
        'UA /OV OKC063015/TM 1522/FL085/TP C172/SK BKN065-TOP090/WX 5SM -RA/TA M05/WV 27045/TB LGT/IC LGT RIME/RM SMOOTH ABOVE 090';
      const pirep = parsePirep(raw);

      assert.equal(pirep.type, 'UA');
      assert.equal(pirep.raw, raw);

      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'station');
      if (pirep.location.locationType === 'station') {
        assert.equal(pirep.location.point.identifier, 'OKC');
        assert.equal(pirep.location.point.radialDeg, 63);
        assert.equal(pirep.location.point.distanceNm, 15);
      }

      assert.ok(pirep.time);
      assert.equal(pirep.time.hour, 15);
      assert.equal(pirep.time.minute, 22);

      assert.equal(pirep.altitudeFtMsl, 8500);
      assert.equal(pirep.aircraftType, 'C172');

      assert.ok(pirep.skyCondition);
      assert.equal(pirep.skyCondition.length, 1);
      assert.equal(pirep.skyCondition[0]!.coverage, 'BKN');
      assert.equal(pirep.skyCondition[0]!.baseFtMsl, 6500);
      assert.equal(pirep.skyCondition[0]!.topFtMsl, 9000);

      assert.ok(pirep.visibility);
      assert.equal(pirep.visibility.statuteMiles, 5);

      assert.ok(pirep.weatherPhenomena);
      assert.equal(pirep.weatherPhenomena.length, 1);
      assert.deepEqual(pirep.weatherPhenomena[0]!.phenomena, ['RA']);

      assert.equal(pirep.temperatureC, -5);

      assert.ok(pirep.wind);
      assert.equal(pirep.wind.directionDegMagnetic, 270);
      assert.equal(pirep.wind.speedKt, 45);

      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'LGT');

      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'LGT');
      assert.equal(pirep.icing[0]!.type, 'RIME');

      assert.equal(pirep.remarks, 'SMOOTH ABOVE 090');
    });

    it('parses a minimal PIREP (mandatory fields only)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');

      assert.equal(pirep.type, 'UA');
      assert.ok(pirep.location);
      assert.ok(pirep.time);
      assert.equal(pirep.altitudeFtMsl, 8500);
      assert.equal(pirep.aircraftType, 'C172');

      assert.equal(pirep.skyCondition, undefined);
      assert.equal(pirep.visibility, undefined);
      assert.equal(pirep.weatherPhenomena, undefined);
      assert.equal(pirep.temperatureC, undefined);
      assert.equal(pirep.wind, undefined);
      assert.equal(pirep.turbulence, undefined);
      assert.equal(pirep.icing, undefined);
      assert.equal(pirep.remarks, undefined);
    });

    it('parses an urgent PIREP with severe conditions', () => {
      const raw =
        'UUA /OV DHT360015-AMA/TM 1845/FL310/TP B738/TB SEV CAT/IC SEV MXD 280-340/RM SEVERE TURBULENCE AND ICING';
      const pirep = parsePirep(raw);

      assert.equal(pirep.type, 'UUA');

      assert.ok(pirep.location);
      assert.equal(pirep.location.locationType, 'route');
      if (pirep.location.locationType === 'route') {
        assert.equal(pirep.location.points.length, 2);
        assert.equal(pirep.location.points[0]!.identifier, 'DHT');
        assert.equal(pirep.location.points[0]!.radialDeg, 360);
        assert.equal(pirep.location.points[0]!.distanceNm, 15);
        assert.equal(pirep.location.points[1]!.identifier, 'AMA');
      }

      assert.equal(pirep.altitudeFtMsl, 31000);

      assert.ok(pirep.turbulence);
      assert.equal(pirep.turbulence[0]!.intensity, 'SEV');
      assert.equal(pirep.turbulence[0]!.type, 'CAT');

      assert.ok(pirep.icing);
      assert.equal(pirep.icing[0]!.intensity, 'SEV');
      assert.equal(pirep.icing[0]!.type, 'MXD');
      assert.equal(pirep.icing[0]!.baseFtMsl, 28000);
      assert.equal(pirep.icing[0]!.topFtMsl, 34000);

      assert.equal(pirep.remarks, 'SEVERE TURBULENCE AND ICING');
    });
  });
});
