export interface Airport {
  icao: string;
  iata?: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  elevationFt?: number;
}
