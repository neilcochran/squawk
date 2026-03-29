export interface LocalSource {
  type: 'local';
  host: string;
  port: number;
  path?: string;
}

export interface OpenSkySource {
  type: 'opensky';
  username?: string;
  password?: string;
}

export interface AdsbExchangeSource {
  type: 'adsbexchange';
  apiKey: string;
}

export interface AdsbFiSource {
  type: 'adsbfi';
}

export type AdsbSource = LocalSource | OpenSkySource | AdsbExchangeSource | AdsbFiSource;
