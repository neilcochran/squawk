/**
 * A direct local ADS-B source (dump1090/readsb) with host/port path.
 */
export interface LocalSource {
  type: 'local';
  host: string;
  port: number;
  path?: string;
}

/**
 * OpenSky REST API source config. Optional auth improves rate limits.
 */
export interface OpenSkySource {
  type: 'opensky';
  /** Username for OpenSky API. */
  username?: string;
  /** Password for OpenSky API. */
  password?: string;
}

/**
 * ADSBexchange REST API source config.
 */
export interface AdsbExchangeSource {
  type: 'adsbexchange';
  /** API key for ADSBexchange REST API. */
  apiKey: string;
}

/**
 * ADSB.fi API source config (public, no auth required).
 */
export interface AdsbFiSource {
  type: 'adsbfi';
}

/**
 * Union of supported ADS-B source configurations.
 */
export type AdsbSource = LocalSource | OpenSkySource | AdsbExchangeSource | AdsbFiSource;
