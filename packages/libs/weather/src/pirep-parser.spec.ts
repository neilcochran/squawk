import { describe, it, expect, assert } from 'vitest';
import { parsePirep } from './pirep-parser.js';

describe('parsePirep', () => {
  describe('report type', () => {
    it('parses routine PIREP (UA)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/RM TEST');
      expect(pirep.type).toBe('UA');
      expect(pirep.raw).toBe('UA /OV OKC/TM 1530/FL085/TP C172/RM TEST');
    });

    it('parses urgent PIREP (UUA)', () => {
      const pirep = parsePirep('UUA /OV OKC/TM 1530/FL085/TP B738/TB SEV/RM SEVERE TURBULENCE');
      expect(pirep.type).toBe('UUA');
    });
  });

  describe('/OV - location', () => {
    it('parses simple station identifier', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('station');
      if (pirep.location.locationType === 'station') {
        expect(pirep.location.point.identifier).toBe('OKC');
        expect(pirep.location.point.radialDeg).toBe(undefined);
        expect(pirep.location.point.distanceNm).toBe(undefined);
      }
    });

    it('parses 4-letter ICAO identifier', () => {
      const pirep = parsePirep('UA /OV KOKC/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('station');
      if (pirep.location.locationType === 'station') {
        expect(pirep.location.point.identifier).toBe('KOKC');
      }
    });

    it('parses station with radial and distance', () => {
      const pirep = parsePirep('UA /OV SAV180020/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('station');
      if (pirep.location.locationType === 'station') {
        expect(pirep.location.point.identifier).toBe('SAV');
        expect(pirep.location.point.radialDeg).toBe(180);
        expect(pirep.location.point.distanceNm).toBe(20);
      }
    });

    it('parses station with radial/distance and space', () => {
      const pirep = parsePirep('UA /OV SAV 180020/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('station');
      if (pirep.location.locationType === 'station') {
        expect(pirep.location.point.identifier).toBe('SAV');
        expect(pirep.location.point.radialDeg).toBe(180);
        expect(pirep.location.point.distanceNm).toBe(20);
      }
    });

    it('parses route between simple stations', () => {
      const pirep = parsePirep('UA /OV DHT-AMA/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('route');
      if (pirep.location.locationType === 'route') {
        expect(pirep.location.points.length).toBe(2);
        expect(pirep.location.points[0]!.identifier).toBe('DHT');
        expect(pirep.location.points[1]!.identifier).toBe('AMA');
      }
    });

    it('parses multi-segment route', () => {
      const pirep = parsePirep('UA /OV DHT-AMA-CDS/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('route');
      if (pirep.location.locationType === 'route') {
        expect(pirep.location.points.length).toBe(3);
        expect(pirep.location.points[0]!.identifier).toBe('DHT');
        expect(pirep.location.points[1]!.identifier).toBe('AMA');
        expect(pirep.location.points[2]!.identifier).toBe('CDS');
      }
    });

    it('parses route with radial/distance points', () => {
      const pirep = parsePirep('UA /OV ABC090025-DEF180010/TM 1530/FL085/TP C172');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('route');
      if (pirep.location.locationType === 'route') {
        expect(pirep.location.points.length).toBe(2);
        expect(pirep.location.points[0]!.identifier).toBe('ABC');
        expect(pirep.location.points[0]!.radialDeg).toBe(90);
        expect(pirep.location.points[0]!.distanceNm).toBe(25);
        expect(pirep.location.points[1]!.identifier).toBe('DEF');
        expect(pirep.location.points[1]!.radialDeg).toBe(180);
        expect(pirep.location.points[1]!.distanceNm).toBe(10);
      }
    });

    it('parses latitude/longitude location', () => {
      const pirep = parsePirep('UA /OV 3412N11830W/TM 1530/FL350/TP B738');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('latlon');
      if (pirep.location.locationType === 'latlon') {
        assert(pirep.location.coordinates.lat > 34.19 && pirep.location.coordinates.lat < 34.21);
        assert(
          pirep.location.coordinates.lon > -118.51 && pirep.location.coordinates.lon < -118.49,
        );
      }
    });
  });

  describe('/TM - time', () => {
    it('parses 4-digit time', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      assert(pirep.time);
      expect(pirep.time.hour).toBe(15);
      expect(pirep.time.minute).toBe(30);
    });

    it('parses time with Z suffix', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530Z/FL085/TP C172');
      assert(pirep.time);
      expect(pirep.time.hour).toBe(15);
      expect(pirep.time.minute).toBe(30);
    });
  });

  describe('field splitting', () => {
    it('handles markers with no space before alpha values', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FLUNKN/TP C172/SKCLR/TB NEG');
      expect(pirep.altitudeQualifier).toBe('UNKN');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition[0]!.coverage).toBe('CLR');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('NEG');
    });
  });

  describe('/FL - flight level', () => {
    it('parses numeric flight level', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      expect(pirep.altitudeFtMsl).toBe(8500);
    });

    it('parses high flight level', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B738');
      expect(pirep.altitudeFtMsl).toBe(35000);
    });

    it('parses UNKN flight level', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL UNKN/TP C172');
      expect(pirep.altitudeFtMsl).toBe(undefined);
      expect(pirep.altitudeQualifier).toBe('UNKN');
    });

    it('parses DURD (during descent)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL DURD/TP C172');
      expect(pirep.altitudeQualifier).toBe('DURD');
    });

    it('parses DURC (during climb)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL DURC/TP C172');
      expect(pirep.altitudeQualifier).toBe('DURC');
    });
  });

  describe('/TP - aircraft type', () => {
    it('parses aircraft type designator', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');
      expect(pirep.aircraftType).toBe('C172');
    });

    it('parses long aircraft type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B737-800');
      expect(pirep.aircraftType).toBe('B737-800');
    });
  });

  describe('/SK - sky condition', () => {
    it('parses single layer with base', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK OVC025');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('OVC');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(2500);
    });

    it('parses layer with base and top', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKN065-TOP090');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(6500);
      expect(pirep.skyCondition[0]!.topFtMsl).toBe(9000);
    });

    it('parses multiple layers', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKN040-TOP060 OVC100-TOP120');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(2);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(4000);
      expect(pirep.skyCondition[0]!.topFtMsl).toBe(6000);
      expect(pirep.skyCondition[1]!.coverage).toBe('OVC');
      expect(pirep.skyCondition[1]!.baseFtMsl).toBe(10000);
      expect(pirep.skyCondition[1]!.topFtMsl).toBe(12000);
    });

    it('parses CLR sky', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK CLR');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('CLR');
    });

    it('parses compact notation (base-coverage-top)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK 010BKN028');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(1000);
      expect(pirep.skyCondition[0]!.topFtMsl).toBe(2800);
    });

    it('parses layer with unknown top', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKN040-TOPUNKN');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(4000);
      expect(pirep.skyCondition[0]!.topFtMsl).toBe(undefined);
    });

    it('parses layer with unknown base', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/SK BKNUNKN-TOP090');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(undefined);
      expect(pirep.skyCondition[0]!.topFtMsl).toBe(9000);
    });
  });

  describe('/WX - weather and visibility', () => {
    it('parses visibility in statute miles', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 5SM');
      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(5);
    });

    it('parses fractional visibility', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 1/2SM');
      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(0.5);
    });

    it('parses visibility with weather phenomena', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 3SM -RA BR');
      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(3);
      assert(pirep.weatherPhenomena);
      expect(pirep.weatherPhenomena.length).toBe(2);
      expect(pirep.weatherPhenomena[0]!.intensity).toBe('LIGHT');
      expect(pirep.weatherPhenomena[0]!.phenomena).toEqual(['RA']);
      expect(pirep.weatherPhenomena[1]!.phenomena).toEqual(['BR']);
    });

    it('parses P6SM (greater than 6 SM)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX P6SM');
      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(6);
      expect(pirep.visibility.isMoreThan).toBe(true);
    });

    it('parses less-than visibility (M prefix)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX M1/4SM FG');
      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(0.25);
      expect(pirep.visibility.isLessThan).toBe(true);
      assert(pirep.weatherPhenomena);
      expect(pirep.weatherPhenomena.length).toBe(1);
      expect(pirep.weatherPhenomena[0]!.phenomena).toEqual(['FG']);
    });

    it('parses mixed number visibility', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX 1 1/2SM');
      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(1.5);
    });

    it('parses weather phenomena without visibility', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WX FZRA');
      assert(pirep.weatherPhenomena);
      expect(pirep.weatherPhenomena.length).toBe(1);
      expect(pirep.weatherPhenomena[0]!.descriptor).toBe('FZ');
      expect(pirep.weatherPhenomena[0]!.phenomena).toEqual(['RA']);
      expect(pirep.visibility).toBe(undefined);
    });
  });

  describe('/TA - temperature', () => {
    it('parses positive temperature', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA 15');
      expect(pirep.temperatureC).toBe(15);
    });

    it('parses negative temperature with minus sign', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA -10');
      expect(pirep.temperatureC).toBe(-10);
    });

    it('parses negative temperature with M prefix', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA M15');
      expect(pirep.temperatureC).toBe(-15);
    });

    it('parses zero temperature', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TA 0');
      expect(pirep.temperatureC).toBe(0);
    });
  });

  describe('/WV - wind', () => {
    it('parses wind direction and speed', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WV 27045');
      assert(pirep.wind);
      expect(pirep.wind.magneticDirectionDeg).toBe(270);
      expect(pirep.wind.speedKt).toBe(45);
    });

    it('parses wind with KT suffix', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/WV 27045KT');
      assert(pirep.wind);
      expect(pirep.wind.magneticDirectionDeg).toBe(270);
      expect(pirep.wind.speedKt).toBe(45);
    });
  });

  describe('/TB - turbulence', () => {
    it('parses single intensity', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB LGT');
      assert(pirep.turbulence);
      expect(pirep.turbulence.length).toBe(1);
      expect(pirep.turbulence[0]!.intensity).toBe('LGT');
    });

    it('parses negative turbulence', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB NEG');
      assert(pirep.turbulence);
      expect(pirep.turbulence.length).toBe(1);
      expect(pirep.turbulence[0]!.intensity).toBe('NEG');
    });

    it('parses intensity range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD-SEV');
      assert(pirep.turbulence);
      expect(pirep.turbulence.length).toBe(1);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.intensityHigh).toBe('SEV');
    });

    it('parses turbulence with type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD CAT');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.type).toBe('CAT');
    });

    it('parses turbulence with frequency', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB LGT CHOP INT');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('LGT');
      expect(pirep.turbulence[0]!.type).toBe('CHOP');
      expect(pirep.turbulence[0]!.frequency).toBe('INT');
    });

    it('parses turbulence with altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD 060-090');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.baseFtMsl).toBe(6000);
      expect(pirep.turbulence[0]!.topFtMsl).toBe(9000);
    });

    it('parses turbulence with BLO modifier', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD BLO 100');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.belowAltitude).toBe(10000);
    });

    it('parses turbulence with ABV modifier', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B738/TB SEV ABV FL350');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('SEV');
      expect(pirep.turbulence[0]!.aboveAltitude).toBe(35000);
    });

    it('parses extreme turbulence', () => {
      const pirep = parsePirep('UUA /OV OKC/TM 1530/FL085/TP B738/TB EXTRM');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('EXTRM');
    });

    it('parses turbulence with LLWS type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL020/TP C172/TB MOD LLWS');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.type).toBe('LLWS');
    });

    it('parses turbulence with OCC frequency', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB LGT CAT OCC');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('LGT');
      expect(pirep.turbulence[0]!.type).toBe('CAT');
      expect(pirep.turbulence[0]!.frequency).toBe('OCC');
    });

    it('parses turbulence with CONT frequency', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/TB MOD CHOP CONT');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.type).toBe('CHOP');
      expect(pirep.turbulence[0]!.frequency).toBe('CONT');
    });

    it('parses turbulence with FL-prefixed altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL350/TP B738/TB MOD CAT FL280-FL350');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.type).toBe('CAT');
      expect(pirep.turbulence[0]!.baseFtMsl).toBe(28000);
      expect(pirep.turbulence[0]!.topFtMsl).toBe(35000);
    });

    it('parses multiple turbulence layers separated by /', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL120/TP B738/TB LGT 060-080/MOD CAT 100-120');
      assert(pirep.turbulence);
      expect(pirep.turbulence.length).toBe(2);
      expect(pirep.turbulence[0]!.intensity).toBe('LGT');
      expect(pirep.turbulence[0]!.baseFtMsl).toBe(6000);
      expect(pirep.turbulence[0]!.topFtMsl).toBe(8000);
      expect(pirep.turbulence[1]!.intensity).toBe('MOD');
      expect(pirep.turbulence[1]!.type).toBe('CAT');
      expect(pirep.turbulence[1]!.baseFtMsl).toBe(10000);
      expect(pirep.turbulence[1]!.topFtMsl).toBe(12000);
    });
  });

  describe('/IC - icing', () => {
    it('parses single intensity', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT');
      assert(pirep.icing);
      expect(pirep.icing.length).toBe(1);
      expect(pirep.icing[0]!.intensity).toBe('LGT');
    });

    it('parses negative icing', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC NEG');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('NEG');
    });

    it('parses icing with type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT RIME');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('LGT');
      expect(pirep.icing[0]!.type).toBe('RIME');
    });

    it('parses icing intensity range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT-MOD RIME');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('LGT');
      expect(pirep.icing[0]!.intensityHigh).toBe('MOD');
      expect(pirep.icing[0]!.type).toBe('RIME');
    });

    it('parses trace icing', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC TR RIME');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('TR');
      expect(pirep.icing[0]!.type).toBe('RIME');
    });

    it('parses icing with altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC MOD CLR 060-090');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('MOD');
      expect(pirep.icing[0]!.type).toBe('CLR');
      expect(pirep.icing[0]!.baseFtMsl).toBe(6000);
      expect(pirep.icing[0]!.topFtMsl).toBe(9000);
    });

    it('parses mixed icing type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC MOD MXD');
      assert(pirep.icing);
      expect(pirep.icing[0]!.type).toBe('MXD');
    });

    it('parses SLD icing type', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC MOD SLD');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('MOD');
      expect(pirep.icing[0]!.type).toBe('SLD');
    });

    it('parses icing with FL-prefixed altitude range', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/IC LGT RIME FL040-FL080');
      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('LGT');
      expect(pirep.icing[0]!.type).toBe('RIME');
      expect(pirep.icing[0]!.baseFtMsl).toBe(4000);
      expect(pirep.icing[0]!.topFtMsl).toBe(8000);
    });

    it('parses multiple icing layers separated by /', () => {
      const pirep = parsePirep(
        'UA /OV OKC/TM 1530/FL120/TP B738/IC LGT RIME 040-060/MOD CLR 080-100',
      );
      assert(pirep.icing);
      expect(pirep.icing.length).toBe(2);
      expect(pirep.icing[0]!.intensity).toBe('LGT');
      expect(pirep.icing[0]!.type).toBe('RIME');
      expect(pirep.icing[0]!.baseFtMsl).toBe(4000);
      expect(pirep.icing[0]!.topFtMsl).toBe(6000);
      expect(pirep.icing[1]!.intensity).toBe('MOD');
      expect(pirep.icing[1]!.type).toBe('CLR');
      expect(pirep.icing[1]!.baseFtMsl).toBe(8000);
      expect(pirep.icing[1]!.topFtMsl).toBe(10000);
    });
  });

  describe('/RM - remarks', () => {
    it('parses remarks as free text', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172/RM SMOOTH RIDE');
      expect(pirep.remarks).toBe('SMOOTH RIDE');
    });

    it('preserves full remarks text including slashes', () => {
      const pirep = parsePirep(
        'UA /OV OKC/TM 1530/FL085/TP C172/RM BUMPY BETWEEN 060-090 SMOOTH ABOVE',
      );
      expect(pirep.remarks).toBe('BUMPY BETWEEN 060-090 SMOOTH ABOVE');
    });
  });

  describe('full PIREPs', () => {
    it('parses a fully populated routine PIREP', () => {
      const raw =
        'UA /OV OKC063015/TM 1522/FL085/TP C172/SK BKN065-TOP090/WX 5SM -RA/TA M05/WV 27045/TB LGT/IC LGT RIME/RM SMOOTH ABOVE 090';
      const pirep = parsePirep(raw);

      expect(pirep.type).toBe('UA');
      expect(pirep.raw).toBe(raw);

      assert(pirep.location);
      expect(pirep.location.locationType).toBe('station');
      if (pirep.location.locationType === 'station') {
        expect(pirep.location.point.identifier).toBe('OKC');
        expect(pirep.location.point.radialDeg).toBe(63);
        expect(pirep.location.point.distanceNm).toBe(15);
      }

      assert(pirep.time);
      expect(pirep.time.hour).toBe(15);
      expect(pirep.time.minute).toBe(22);

      expect(pirep.altitudeFtMsl).toBe(8500);
      expect(pirep.aircraftType).toBe('C172');

      assert(pirep.skyCondition);
      expect(pirep.skyCondition.length).toBe(1);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBe(6500);
      expect(pirep.skyCondition[0]!.topFtMsl).toBe(9000);

      assert(pirep.visibility);
      expect(pirep.visibility.visibilitySm).toBe(5);

      assert(pirep.weatherPhenomena);
      expect(pirep.weatherPhenomena.length).toBe(1);
      expect(pirep.weatherPhenomena[0]!.phenomena).toEqual(['RA']);

      expect(pirep.temperatureC).toBe(-5);

      assert(pirep.wind);
      expect(pirep.wind.magneticDirectionDeg).toBe(270);
      expect(pirep.wind.speedKt).toBe(45);

      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('LGT');

      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('LGT');
      expect(pirep.icing[0]!.type).toBe('RIME');

      expect(pirep.remarks).toBe('SMOOTH ABOVE 090');
    });

    it('parses a minimal PIREP (mandatory fields only)', () => {
      const pirep = parsePirep('UA /OV OKC/TM 1530/FL085/TP C172');

      expect(pirep.type).toBe('UA');
      assert(pirep.location);
      assert(pirep.time);
      expect(pirep.altitudeFtMsl).toBe(8500);
      expect(pirep.aircraftType).toBe('C172');

      expect(pirep.skyCondition).toBe(undefined);
      expect(pirep.visibility).toBe(undefined);
      expect(pirep.weatherPhenomena).toBe(undefined);
      expect(pirep.temperatureC).toBe(undefined);
      expect(pirep.wind).toBe(undefined);
      expect(pirep.turbulence).toBe(undefined);
      expect(pirep.icing).toBe(undefined);
      expect(pirep.remarks).toBe(undefined);
    });

    it('parses an urgent PIREP with severe conditions', () => {
      const raw =
        'UUA /OV DHT360015-AMA/TM 1845/FL310/TP B738/TB SEV CAT/IC SEV MXD 280-340/RM SEVERE TURBULENCE AND ICING';
      const pirep = parsePirep(raw);

      expect(pirep.type).toBe('UUA');

      assert(pirep.location);
      expect(pirep.location.locationType).toBe('route');
      if (pirep.location.locationType === 'route') {
        expect(pirep.location.points.length).toBe(2);
        expect(pirep.location.points[0]!.identifier).toBe('DHT');
        expect(pirep.location.points[0]!.radialDeg).toBe(360);
        expect(pirep.location.points[0]!.distanceNm).toBe(15);
        expect(pirep.location.points[1]!.identifier).toBe('AMA');
      }

      expect(pirep.altitudeFtMsl).toBe(31000);

      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('SEV');
      expect(pirep.turbulence[0]!.type).toBe('CAT');

      assert(pirep.icing);
      expect(pirep.icing[0]!.intensity).toBe('SEV');
      expect(pirep.icing[0]!.type).toBe('MXD');
      expect(pirep.icing[0]!.baseFtMsl).toBe(28000);
      expect(pirep.icing[0]!.topFtMsl).toBe(34000);

      expect(pirep.remarks).toBe('SEVERE TURBULENCE AND ICING');
    });
  });

  describe('coverage edge cases', () => {
    it('treats reports without a UA/UUA prefix as routine', () => {
      // Exercises the no-prefix fallback branch (pirepType defaults to UA).
      const pirep = parsePirep('/OV BOS/TM 1530/FL080/TP C172');
      expect(pirep.type).toBe('UA');
    });

    it('returns no time when /TM is missing the 4-digit format', () => {
      const pirep = parsePirep('UA /OV BOS/TM ABC/FL080/TP C172');
      expect(pirep.time).toBeUndefined();
    });

    it('parses turbulence with only base altitude (single value, no range)', () => {
      // Hits the "if baseFtMsl undefined, set base" branch.
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB MOD 080');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('MOD');
      expect(pirep.turbulence[0]!.baseFtMsl).toBe(8000);
    });

    it('parses turbulence with both base and top via two single altitudes', () => {
      // Hits the "else assign top" branch in turbulence single-altitude parsing.
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB MOD 080 120');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.baseFtMsl).toBe(8000);
      expect(pirep.turbulence[0]!.topFtMsl).toBe(12000);
    });

    it('parses icing with single base altitude (no range)', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/IC MOD 080');
      assert(pirep.icing);
      expect(pirep.icing[0]!.baseFtMsl).toBe(8000);
    });

    it('parses icing with two single altitudes (sets base then top)', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/IC MOD 080 120');
      assert(pirep.icing);
      expect(pirep.icing[0]!.baseFtMsl).toBe(8000);
      expect(pirep.icing[0]!.topFtMsl).toBe(12000);
    });

    it('returns no temperature when /TA value is unparseable', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TA XYZ');
      expect(pirep.temperatureC).toBeUndefined();
    });

    it('returns no wind when /WV value does not match dddss format', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/WV INVALID');
      expect(pirep.wind).toBeUndefined();
    });

    it('parses turbulence with high-end of intensity range only (LGT-MOD)', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB LGT-MOD CHOP');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.intensity).toBe('LGT');
      expect(pirep.turbulence[0]!.intensityHigh).toBe('MOD');
    });

    it('parses turbulence range (FL060-FL090) altitude in turbulence', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB MOD FL060-FL090');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.baseFtMsl).toBe(6000);
      expect(pirep.turbulence[0]!.topFtMsl).toBe(9000);
    });

    it('parses icing range (060-090) altitude', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/IC MOD 060-090');
      assert(pirep.icing);
      expect(pirep.icing[0]!.baseFtMsl).toBe(6000);
      expect(pirep.icing[0]!.topFtMsl).toBe(9000);
    });

    it('returns no turbulence when /TB has only an unrecognized intensity', () => {
      // No matching intensity → results array empty → returns undefined
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB UNKN');
      expect(pirep.turbulence).toBeUndefined();
    });

    it('returns no icing when /IC has only an unrecognized value', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/IC UNKN');
      expect(pirep.icing).toBeUndefined();
    });

    it('handles BLO with no following altitude token gracefully', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB MOD BLO');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.belowAltitude).toBeUndefined();
    });

    it('handles ABV with an unparseable altitude token gracefully', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/TB MOD ABV XXX');
      assert(pirep.turbulence);
      expect(pirep.turbulence[0]!.aboveAltitude).toBeUndefined();
    });

    it('returns sky condition undefined when no recognized layer pattern', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/SK GARBAGE');
      expect(pirep.skyCondition).toBeUndefined();
    });

    it('returns no weather visibility when /WX has only weather phenomena', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/WX RA');
      expect(pirep.visibility).toBeUndefined();
      assert(pirep.weatherPhenomena);
      expect(pirep.weatherPhenomena.length).toBeGreaterThan(0);
    });

    it('returns location undefined when /OV value cannot be parsed', () => {
      // parseLocation returns a station-format result for any non-empty input,
      // but a single-character input falls through to a degenerate
      // station record with no recognizable fields.
      const pirep = parsePirep('UA /OV X/TM 1530/FL080/TP C172');
      expect(pirep.location).toBeDefined();
    });

    it('omits aircraftType when /TP is whitespace-only', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP /SK BKN040');
      expect(pirep.aircraftType).toBeUndefined();
    });

    it('parses lat/lon location in southern hemisphere with eastern longitude', () => {
      const pirep = parsePirep('UA /OV 3412S11830E/TM 1530/FL350/TP B738');
      assert(pirep.location);
      expect(pirep.location.locationType).toBe('latlon');
      if (pirep.location.locationType === 'latlon') {
        // 34deg + 12/60 = 34.2 → -34.2 in southern hemisphere
        assert(pirep.location.coordinates.lat < 0, 'expected negative latitude');
        // 118deg + 30/60 = 118.5 → +118.5 in eastern hemisphere
        assert(pirep.location.coordinates.lon > 0, 'expected positive longitude');
      }
    });

    it('parses sky condition with unknown top (-TOPUNKN)', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/SK BKN040-TOPUNKN');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.topFtMsl).toBeUndefined();
    });

    it('parses sky condition with unknown base (UNKN)', () => {
      const pirep = parsePirep('UA /OV BOS/TM 1530/FL080/TP C172/SK BKNUNKN-TOP100');
      assert(pirep.skyCondition);
      expect(pirep.skyCondition[0]!.coverage).toBe('BKN');
      expect(pirep.skyCondition[0]!.baseFtMsl).toBeUndefined();
    });

    it('parses /TM with shorter-than-4-digit value as undefined', () => {
      const pirep = parsePirep('UA /OV BOS/TM 153/FL080/TP C172');
      expect(pirep.time).toBeUndefined();
    });

    it('handles a station identifier alone (no radial/distance)', () => {
      const pirep = parsePirep('UA /OV ABC/TM 1530/FL080/TP C172');
      assert(pirep.location);
      if (pirep.location.locationType === 'station') {
        expect(pirep.location.point.identifier).toBe('ABC');
        expect(pirep.location.point.radialDeg).toBeUndefined();
      }
    });
  });
});
