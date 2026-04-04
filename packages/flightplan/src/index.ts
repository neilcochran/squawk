/**
 * @packageDocumentation
 * Flight plan route string parsing and resolution. Composes airport, navaid,
 * fix, airway, and procedure resolvers to parse route strings into structured,
 * coordinate-resolved route elements.
 */
export { createFlightplanResolver } from './resolver.js';
export type {
  FlightplanResolver,
  FlightplanResolverOptions,
  FlightplanAirportLookup,
  FlightplanNavaidLookup,
  FlightplanFixLookup,
  FlightplanAirwayLookup,
  FlightplanProcedureLookup,
  ParsedRoute,
  RouteElement,
  AirportRouteElement,
  SidRouteElement,
  StarRouteElement,
  AirwayRouteElement,
  DirectRouteElement,
  WaypointRouteElement,
  CoordinateRouteElement,
  SpeedAltitudeRouteElement,
  UnresolvedRouteElement,
} from './resolver.js';
