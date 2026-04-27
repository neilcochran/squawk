/**
 * Typed unit string literals for temperature values to prevent unit confusion at the call site.
 */
export type TemperatureUnit = 'C' | 'F' | 'K';

/**
 * Converts Celsius to Fahrenheit.
 * @param celsius - Temperature in degrees Celsius.
 * @returns Temperature in degrees Fahrenheit.
 */
export function celsiusToFahrenheit(celsius: number): number {
  return celsius * (9 / 5) + 32;
}

/**
 * Converts Fahrenheit to Celsius.
 * @param fahrenheit - Temperature in degrees Fahrenheit.
 * @returns Temperature in degrees Celsius.
 */
export function fahrenheitToCelsius(fahrenheit: number): number {
  return (fahrenheit - 32) * (5 / 9);
}

/**
 * Converts Celsius to Kelvin.
 * @param celsius - Temperature in degrees Celsius.
 * @returns Temperature in Kelvin.
 */
export function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15;
}

/**
 * Converts Kelvin to Celsius.
 * @param kelvin - Temperature in Kelvin.
 * @returns Temperature in degrees Celsius.
 */
export function kelvinToCelsius(kelvin: number): number {
  return kelvin - 273.15;
}

/**
 * Converts Fahrenheit to Kelvin.
 * @param fahrenheit - Temperature in degrees Fahrenheit.
 * @returns Temperature in Kelvin.
 */
export function fahrenheitToKelvin(fahrenheit: number): number {
  return celsiusToKelvin(fahrenheitToCelsius(fahrenheit));
}

/**
 * Converts Kelvin to Fahrenheit.
 * @param kelvin - Temperature in Kelvin.
 * @returns Temperature in degrees Fahrenheit.
 */
export function kelvinToFahrenheit(kelvin: number): number {
  return celsiusToFahrenheit(kelvinToCelsius(kelvin));
}
