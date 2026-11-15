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
export { computeRouteDistance } from './route-distance.js';
export type { RouteLeg, RouteDistanceResult } from './route-distance.js';
export { computeRouteTiming } from './route-timing.js';
export type {
  WindProvider,
  RouteTimingOptions,
  RouteTimingLeg,
  RouteTimingResult,
} from './route-timing.js';
export type { WindVector } from '@squawk/flight-math';
export { checkRouteAltitudes } from './route-altitude.js';
export type {
  NavigationEquipment,
  RouteAltitudeCheckOptions,
  RouteAltitudeCheckResult,
  RouteAltitudeCheckStatus,
  RouteAltitudeStatus,
  RouteAltitudeFinding,
  RouteAltitudeFindingCode,
  RouteAltitudeFindingKind,
  RouteAltitudeSource,
  RouteAltitudeLeg,
  RouteAltitudePoint,
  RouteAltitudeAirwayRemarks,
  ApplicableMinimumEnrouteAltitude,
  ApplicableMinimumCrossingAltitude,
  MinimumEnrouteAltitudeKind,
  CruisingAltitudeCheck,
  CruisingAltitudeStatus,
} from './route-altitude.js';
export { extractRoutePoints, routeToLineString } from './route-geometry.js';
export type { RoutePoint } from './route-geometry.js';
