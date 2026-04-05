/**
 * @packageDocumentation
 * Parse raw aviation weather strings into fully typed, structured objects.
 * Supports METAR, SPECI, TAF, SIGMET, and AIRMET formats.
 */
export { parseMetar } from './metar-parser.js';
export { deriveFlightCategory } from './flight-category.js';
