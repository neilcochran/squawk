import type {
  Airport,
  AirportFrequency,
  FacilityStatus,
  FacilityType,
  FacilityUseType,
  IlsSystem,
  IlsSystemType,
  OwnershipType,
  Runway,
  RunwayEnd,
  RunwayLighting,
  RunwayMarkingCondition,
  RunwayMarkingType,
  SurfaceCondition,
  SurfaceTreatment,
  VgsiType,
} from '@squawk/types';
import { ILS_CATEGORY_MAP, ILS_SYSTEM_TYPE_MAP } from '@squawk/types';
import type { CsvRecord } from './parse-csv.js';

/** Maps FAA SITE_TYPE_CODE values to FacilityType. */
const facilityTypeMap: Record<string, FacilityType> = {
  A: 'AIRPORT',
  H: 'HELIPORT',
  C: 'SEAPLANE_BASE',
  G: 'GLIDERPORT',
  U: 'ULTRALIGHT',
  B: 'BALLOONPORT',
};

/** Maps FAA ownership codes to OwnershipType. */
const ownershipMap: Record<string, OwnershipType> = {
  PU: 'PUBLIC',
  PR: 'PRIVATE',
  MA: 'PRIVATE',
  MN: 'PRIVATE',
  MR: 'PRIVATE',
  CG: 'PRIVATE',
};

/** Maps FAA facility use codes to FacilityUseType. */
const useMap: Record<string, FacilityUseType> = {
  PU: 'PUBLIC',
  PR: 'PRIVATE',
};

/** Maps FAA status codes to FacilityStatus. */
const statusMap: Record<string, FacilityStatus> = {
  O: 'OPEN',
  CI: 'CLOSED_INDEFINITELY',
  CP: 'CLOSED_PERMANENTLY',
};

/** Maps FAA surface condition codes. */
const conditionMap: Record<string, SurfaceCondition> = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
  FAILED: 'FAILED',
};

/** Maps FAA surface treatment codes. */
const treatmentMap: Record<string, SurfaceTreatment> = {
  GRVD: 'GROOVED',
  PFC: 'PFC',
  'GRVD-PFC': 'GROOVED_PFC',
};

/** Maps FAA runway lighting codes. */
const lightingMap: Record<string, RunwayLighting> = {
  HIGH: 'HIGH',
  MED: 'MEDIUM',
  LOW: 'LOW',
  NSTD: 'NONSTANDARD',
  NONE: 'NONE',
};

/** Maps FAA VGSI codes. */
const vgsiMap: Record<string, VgsiType> = {
  V2L: 'VASI-2L',
  V4L: 'VASI-4L',
  V2R: 'VASI-2R',
  V6L: 'VASI-6L',
  V12: 'VASI-12',
  V16: 'VASI-16',
  P2L: 'PAPI-2L',
  P4L: 'PAPI-4L',
  P2R: 'PAPI-2R',
  P4R: 'PAPI-4R',
  PVASI: 'PVASI',
  SAVASI: 'SAVASI',
  TRCOL: 'TRICOLOR',
  PANL: 'PANELS',
};

/** Maps FAA marking type codes. */
const markingTypeMap: Record<string, RunwayMarkingType> = {
  PIR: 'PIR',
  NPI: 'NPI',
  BSC: 'BSC',
  BUOY: 'BUOY',
  STOL: 'STOL',
  NONE: 'NONE',
};

/** Maps FAA marking condition codes. */
const markingCondMap: Record<string, RunwayMarkingCondition> = {
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
};

/** Maps FAA glide slope class/type codes to descriptive names. */
const glideSlopeTypeMap: Record<string, string> = {
  GS: 'GLIDE SLOPE',
  GD: 'GLIDE SLOPE/DME',
};

/**
 * Safely parses a string to a float, returning undefined if empty or NaN.
 */
function parseOptFloat(val: string | undefined): number | undefined {
  if (!val) {
    return undefined;
  }
  const n = parseFloat(val);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Safely parses a string to an integer, returning undefined if empty or NaN.
 */
function parseOptInt(val: string | undefined): number | undefined {
  if (!val) {
    return undefined;
  }
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Builds an IlsSystem from ILS CSV records for a specific runway end.
 * Merges base, glide slope, and DME component data into a single object.
 *
 * @param baseRec - Parsed ILS_BASE.csv record for this runway end.
 * @param gsRec - Parsed ILS_GS.csv record for this runway end, if present.
 * @param dmeRec - Parsed ILS_DME.csv record for this runway end, if present.
 * @returns An IlsSystem object, or undefined if the system type is unrecognized or shutdown.
 */
function buildIlsSystem(
  baseRec: CsvRecord,
  gsRec: CsvRecord | undefined,
  dmeRec: CsvRecord | undefined,
): IlsSystem | undefined {
  const typeCode = baseRec.SYSTEM_TYPE_CODE;
  if (!typeCode) {
    return undefined;
  }
  const systemType: IlsSystemType | undefined = ILS_SYSTEM_TYPE_MAP[typeCode];
  if (!systemType) {
    return undefined;
  }

  // Exclude shutdown systems.
  const status = baseRec.COMPONENT_STATUS;
  if (status === 'SHUTDOWN') {
    return undefined;
  }

  const ils: IlsSystem = { systemType };

  if (baseRec.ILS_LOC_ID) {
    ils.identifier = 'I-' + baseRec.ILS_LOC_ID;
  }

  const catCode = baseRec.CATEGORY;
  if (catCode) {
    const category = ILS_CATEGORY_MAP[catCode];
    if (category) {
      ils.category = category;
    }
  }

  const locFreq = parseOptFloat(baseRec.LOC_FREQ);
  if (locFreq !== undefined) {
    ils.localizerFrequencyMhz = locFreq;
  }

  const course = parseOptFloat(baseRec.APCH_BEAR);
  if (course !== undefined) {
    ils.localizerCourseDeg = course;
  }

  // Glide slope data from ILS_GS record.
  if (gsRec) {
    const gsAngle = parseOptFloat(gsRec.G_S_ANGLE);
    if (gsAngle !== undefined) {
      ils.glideSlopeAngleDeg = gsAngle;
    }

    const gsTypeCode = gsRec.G_S_TYPE_CODE;
    if (gsTypeCode) {
      const gsType = glideSlopeTypeMap[gsTypeCode];
      if (gsType) {
        ils.glideSlopeType = gsType;
      }
    }
  }

  // DME data from ILS_DME record.
  if (dmeRec) {
    if (dmeRec.CHANNEL) {
      ils.dmeChannel = dmeRec.CHANNEL;
    }
  }

  return ils;
}

/**
 * Builds a RunwayEnd from a CSV record.
 *
 * @param rec - Parsed APT_RWY_END.csv record.
 * @param ils - Pre-built IlsSystem for this runway end, if one exists.
 * @returns A RunwayEnd object.
 */
function buildRunwayEnd(rec: CsvRecord, ils: IlsSystem | undefined): RunwayEnd {
  const end: RunwayEnd = {
    id: rec.RWY_END_ID ?? '',
  };

  const hdg = parseOptInt(rec.TRUE_ALIGNMENT);
  if (hdg !== undefined) {
    end.trueHeading = hdg;
  }
  if (ils) {
    end.ils = ils;
  }
  if (rec.RIGHT_HAND_TRAFFIC_PAT_FLAG === 'Y') {
    end.rightTraffic = true;
  }

  const mt = rec.RWY_MARKING_TYPE_CODE;
  if (mt) {
    const mapped = markingTypeMap[mt];
    if (mapped) {
      end.markingType = mapped;
    }
  }

  const mc = rec.RWY_MARKING_COND;
  if (mc) {
    const mapped = markingCondMap[mc];
    if (mapped) {
      end.markingCondition = mapped;
    }
  }

  const lat = parseOptFloat(rec.LAT_DECIMAL);
  const lon = parseOptFloat(rec.LONG_DECIMAL);
  if (lat !== undefined) {
    end.lat = lat;
  }
  if (lon !== undefined) {
    end.lon = lon;
  }

  const elev = parseOptFloat(rec.RWY_END_ELEV);
  if (elev !== undefined) {
    end.elevationFt = elev;
  }
  const tch = parseOptFloat(rec.THR_CROSSING_HGT);
  if (tch !== undefined) {
    end.thresholdCrossingHeightFt = tch;
  }
  const gpa = parseOptFloat(rec.VISUAL_GLIDE_PATH_ANGLE);
  if (gpa !== undefined) {
    end.glidepathAngle = gpa;
  }
  const dispLen = parseOptInt(rec.DISPLACED_THR_LEN);
  if (dispLen !== undefined) {
    end.displacedThresholdFt = dispLen;
  }
  const dispElev = parseOptFloat(rec.DISPLACED_THR_ELEV);
  if (dispElev !== undefined) {
    end.displacedThresholdElevFt = dispElev;
  }
  const tdzElev = parseOptFloat(rec.TDZ_ELEV);
  if (tdzElev !== undefined) {
    end.tdzElevationFt = tdzElev;
  }

  const vgsi = rec.VGSI_CODE;
  if (vgsi) {
    const mapped = vgsiMap[vgsi];
    if (mapped) {
      end.vgsiType = mapped;
    }
  }

  if (rec.RWY_VISUAL_RANGE_EQUIP_CODE === 'Y') {
    end.hasRvr = true;
  }
  if (rec.APCH_LGT_SYSTEM_CODE) {
    end.approachLights = rec.APCH_LGT_SYSTEM_CODE;
  }
  if (rec.RWY_END_LGTS_FLAG === 'Y') {
    end.hasReil = true;
  }
  if (rec.CNTRLN_LGTS_AVBL_FLAG === 'Y') {
    end.hasCenterlineLights = true;
  }
  if (rec.TDZ_LGT_AVBL_FLAG === 'Y') {
    end.hasTdzLights = true;
  }

  const tora = parseOptInt(rec.TKOF_RUN_AVBL);
  if (tora !== undefined) {
    end.toraFt = tora;
  }
  const toda = parseOptInt(rec.TKOF_DIST_AVBL);
  if (toda !== undefined) {
    end.todaFt = toda;
  }
  const asda = parseOptInt(rec.ACLT_STOP_DIST_AVBL);
  if (asda !== undefined) {
    end.asdaFt = asda;
  }
  const lda = parseOptInt(rec.LNDG_DIST_AVBL);
  if (lda !== undefined) {
    end.ldaFt = lda;
  }
  const lahso = parseOptInt(rec.LAHSO_ALD);
  if (lahso !== undefined) {
    end.lahsoDistanceFt = lahso;
  }
  if (rec.RWY_END_INTERSECT_LAHSO) {
    end.lahsoEntity = rec.RWY_END_INTERSECT_LAHSO;
  }

  return end;
}

/**
 * Builds a Runway from an APT_RWY.csv record with its associated runway end records.
 *
 * @param rec - Parsed APT_RWY.csv record.
 * @param endRecords - Associated APT_RWY_END.csv records for this runway.
 * @param ilsByRwyEnd - Map from runway end identifier to pre-built IlsSystem.
 * @returns A Runway object.
 */
function buildRunway(
  rec: CsvRecord,
  endRecords: CsvRecord[],
  ilsByRwyEnd: Map<string, IlsSystem>,
): Runway {
  const runway: Runway = {
    id: rec.RWY_ID ?? '',
    ends: endRecords.map((endRec) => {
      const rwyEndId = endRec.RWY_END_ID ?? '';
      return buildRunwayEnd(endRec, ilsByRwyEnd.get(rwyEndId));
    }),
  };

  const len = parseOptInt(rec.RWY_LEN);
  if (len !== undefined) {
    runway.lengthFt = len;
  }
  const width = parseOptInt(rec.RWY_WIDTH);
  if (width !== undefined) {
    runway.widthFt = width;
  }
  if (rec.SURFACE_TYPE_CODE) {
    runway.surfaceType = rec.SURFACE_TYPE_CODE;
  }

  const cond = rec.COND;
  if (cond) {
    const mapped = conditionMap[cond];
    if (mapped) {
      runway.condition = mapped;
    }
  }

  const trt = rec.TREATMENT_CODE;
  if (trt) {
    const mapped = treatmentMap[trt];
    if (mapped) {
      runway.treatment = mapped;
    }
  }

  if (rec.PCN) {
    runway.pcn = rec.PCN;
  }

  const lgt = rec.RWY_LGT_CODE;
  if (lgt) {
    const mapped = lightingMap[lgt];
    if (mapped) {
      runway.lighting = mapped;
    }
  }

  const sw = parseOptFloat(rec.GROSS_WT_SW);
  if (sw !== undefined) {
    runway.weightLimitSingleWheelKlb = sw;
  }
  const dw = parseOptFloat(rec.GROSS_WT_DW);
  if (dw !== undefined) {
    runway.weightLimitDualWheelKlb = dw;
  }
  const dtw = parseOptFloat(rec.GROSS_WT_DTW);
  if (dtw !== undefined) {
    runway.weightLimitDualTandemKlb = dtw;
  }
  const ddtw = parseOptFloat(rec.GROSS_WT_DDTW);
  if (ddtw !== undefined) {
    runway.weightLimitDdtKlb = ddtw;
  }

  return runway;
}

/**
 * Builds an AirportFrequency from a FRQ.csv record.
 *
 * @param rec - Parsed FRQ.csv record.
 * @returns An AirportFrequency object, or undefined if the frequency is missing.
 */
function buildFrequency(rec: CsvRecord): AirportFrequency | undefined {
  const freq = parseOptFloat(rec.FREQ);
  const use = rec.FREQ_USE;
  if (freq === undefined || !use) {
    return undefined;
  }

  const result: AirportFrequency = {
    frequencyMhz: freq,
    use,
  };

  if (rec.SECTORIZATION) {
    result.sectorization = rec.SECTORIZATION;
  }

  return result;
}

/**
 * Builds a complete Airport object from parsed CSV records.
 *
 * @param base - Parsed APT_BASE.csv record.
 * @param rwyRecords - Associated APT_RWY.csv records.
 * @param rwyEndRecords - Associated APT_RWY_END.csv records.
 * @param freqRecords - Associated FRQ.csv records.
 * @param ilsBaseRecords - Associated ILS_BASE.csv records for this airport.
 * @param ilsGsRecords - Associated ILS_GS.csv records for this airport.
 * @param ilsDmeRecords - Associated ILS_DME.csv records for this airport.
 * @returns An Airport object, or undefined if required fields are missing.
 */
export function buildAirport(
  base: CsvRecord,
  rwyRecords: CsvRecord[],
  rwyEndRecords: CsvRecord[],
  freqRecords: CsvRecord[],
  ilsBaseRecords: CsvRecord[],
  ilsGsRecords: CsvRecord[],
  ilsDmeRecords: CsvRecord[],
): Airport | undefined {
  const faaId = base.ARPT_ID;
  const name = base.ARPT_NAME;
  const city = base.CITY;
  const state = base.STATE_CODE;
  const country = base.COUNTRY_CODE;
  const siteNo = base.SITE_NO;
  const lat = parseOptFloat(base.LAT_DECIMAL);
  const lon = parseOptFloat(base.LONG_DECIMAL);

  if (
    !faaId ||
    !name ||
    !city ||
    !state ||
    !country ||
    !siteNo ||
    lat === undefined ||
    lon === undefined
  ) {
    return undefined;
  }

  const siteTypeCode = base.SITE_TYPE_CODE;
  const ownerCode = base.OWNERSHIP_TYPE_CODE;
  const useCode = base.FACILITY_USE_CODE;
  const statusCode = base.ARPT_STATUS;

  if (!siteTypeCode || !ownerCode || !useCode || !statusCode) {
    return undefined;
  }

  const facType = facilityTypeMap[siteTypeCode];
  const ownership = ownershipMap[ownerCode];
  const useType = useMap[useCode];
  const status = statusMap[statusCode];

  if (!facType || !ownership || !useType || !status) {
    return undefined;
  }

  const airport: Airport = {
    faaId,
    name,
    facilityType: facType,
    ownershipType: ownership,
    useType,
    status,
    city,
    state,
    country,
    lat,
    lon,
    runways: [],
    frequencies: [],
  };

  if (base.ICAO_ID) {
    airport.icao = base.ICAO_ID;
  }
  const elev = parseOptFloat(base.ELEV);
  if (elev !== undefined) {
    airport.elevationFt = elev;
  }
  const magVar = parseOptFloat(base.MAG_VARN);
  if (magVar !== undefined) {
    airport.magneticVariation = magVar;
  }
  if (base.MAG_HEMIS) {
    airport.magneticVariationDirection = base.MAG_HEMIS;
  }
  const magYear = parseOptInt(base.MAG_VARN_YEAR);
  if (magYear !== undefined) {
    airport.magneticVariationYear = magYear;
  }
  const tpa = parseOptFloat(base.TPA);
  if (tpa !== undefined) {
    airport.trafficPatternAltitudeFt = tpa;
  }
  if (base.CHART_NAME) {
    airport.sectionChart = base.CHART_NAME;
  }
  if (base.RESP_ARTCC_ID) {
    airport.artccId = base.RESP_ARTCC_ID;
  }
  if (base.TWR_TYPE_CODE) {
    airport.towerType = base.TWR_TYPE_CODE;
  }
  if (base.FUEL_TYPES) {
    airport.fuelTypes = base.FUEL_TYPES;
  }
  if (base.AIRFRAME_REPAIR_SER_CODE) {
    airport.airframeRepair = base.AIRFRAME_REPAIR_SER_CODE;
  }
  if (base.PWR_PLANT_REPAIR_SER) {
    airport.powerplantRepair = base.PWR_PLANT_REPAIR_SER;
  }
  if (base.BOTTLED_OXY_TYPE) {
    airport.bottledOxygen = base.BOTTLED_OXY_TYPE;
  }
  if (base.BULK_OXY_TYPE) {
    airport.bulkOxygen = base.BULK_OXY_TYPE;
  }
  if (base.LGT_SKED) {
    airport.lightingSchedule = base.LGT_SKED;
  }
  if (base.BCN_LENS_COLOR) {
    airport.beaconColor = base.BCN_LENS_COLOR;
  }
  if (base.LNDG_FEE_FLAG === 'Y') {
    airport.hasLandingFee = true;
  }
  if (base.ACTIVATION_DATE) {
    airport.activationDate = base.ACTIVATION_DATE;
  }
  if (base.OTHER_SERVICES) {
    airport.otherServices = base.OTHER_SERVICES;
  }
  if (base.NOTAM_ID) {
    airport.notamId = base.NOTAM_ID;
  }
  if (base.COUNTY_NAME) {
    airport.county = base.COUNTY_NAME;
  }

  // Build ILS systems indexed by runway end identifier.
  const ilsByRwyEnd = new Map<string, IlsSystem>();

  // Index GS and DME records by RWY_END_ID for merging into ILS base records.
  const gsByRwyEnd = new Map<string, CsvRecord>();
  for (const gsRec of ilsGsRecords) {
    const rwyEndId = gsRec.RWY_END_ID;
    if (rwyEndId) {
      gsByRwyEnd.set(rwyEndId, gsRec);
    }
  }

  const dmeByRwyEnd = new Map<string, CsvRecord>();
  for (const dmeRec of ilsDmeRecords) {
    const rwyEndId = dmeRec.RWY_END_ID;
    if (rwyEndId) {
      dmeByRwyEnd.set(rwyEndId, dmeRec);
    }
  }

  for (const ilsBaseRec of ilsBaseRecords) {
    const rwyEndId = ilsBaseRec.RWY_END_ID;
    if (!rwyEndId) {
      continue;
    }
    const gsRec = gsByRwyEnd.get(rwyEndId);
    const dmeRec = dmeByRwyEnd.get(rwyEndId);
    const ils = buildIlsSystem(ilsBaseRec, gsRec, dmeRec);
    if (ils) {
      ilsByRwyEnd.set(rwyEndId, ils);
    }
  }

  // Build runways with their ends.
  const endsBySiteRwy = new Map<string, CsvRecord[]>();
  for (const endRec of rwyEndRecords) {
    const endSiteNo = endRec.SITE_NO;
    const endRwyId = endRec.RWY_ID;
    if (endSiteNo && endRwyId) {
      const key = `${endSiteNo}|${endRwyId}`;
      let arr = endsBySiteRwy.get(key);
      if (!arr) {
        arr = [];
        endsBySiteRwy.set(key, arr);
      }
      arr.push(endRec);
    }
  }

  for (const rwyRec of rwyRecords) {
    if (rwyRec.SITE_NO !== siteNo) {
      continue;
    }
    const rwyId = rwyRec.RWY_ID;
    if (!rwyId) {
      continue;
    }
    const key = `${siteNo}|${rwyId}`;
    const ends = endsBySiteRwy.get(key) ?? [];
    airport.runways.push(buildRunway(rwyRec, ends, ilsByRwyEnd));
  }

  // Build frequencies
  for (const freqRec of freqRecords) {
    const freq = buildFrequency(freqRec);
    if (freq) {
      airport.frequencies.push(freq);
    }
  }

  return airport;
}
