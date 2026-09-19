import { isIP } from 'node:net';

/**
 * Extracts the hostname from an HTTP `Host` header value, dropping any port
 * and the brackets around an IPv6 literal.
 *
 * @param hostHeader - Raw `Host` header value, e.g. `localhost:8090` or `[::1]:8090`.
 * @returns The lowercased hostname.
 */
export function hostnameFromHostHeader(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase();
  if (trimmed.startsWith('[')) {
    const close = trimmed.indexOf(']');
    return close === -1 ? trimmed : trimmed.slice(1, close);
  }
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon !== -1 && trimmed.indexOf(':') === lastColon) {
    return trimmed.slice(0, lastColon);
  }
  return trimmed;
}

/**
 * Builds the set of hostnames the scope server answers to besides IP
 * literals: `localhost`, plus this machine's own hostname with and without a
 * `.local` suffix, so the scope can be opened by name from another device on
 * the network.
 *
 * @param machineHostname - This machine's hostname, e.g. from `os.hostname()`.
 * @returns The allowed names, lowercased.
 */
export function buildAllowedHostnames(machineHostname: string): string[] {
  const names = ['localhost'];
  const machine = machineHostname.trim().toLowerCase();
  if (machine !== '') {
    names.push(machine);
    names.push(
      machine.endsWith('.local') ? machine.slice(0, -'.local'.length) : `${machine}.local`,
    );
  }
  return names;
}

/**
 * Decides whether a request's `Host` header names this server. A request is
 * accepted when the hostname is an IP literal or one of `allowedHostnames`.
 *
 * This is the scope server's defense against DNS rebinding: a hostile web
 * page can point a domain it controls at 127.0.0.1 or a LAN address and then
 * read this server's responses - which include the receiver's coordinates -
 * as if they were its own. Such a request necessarily carries the attacker's
 * domain in `Host`, so rejecting unknown names closes the hole, while direct
 * IP access and the machine's own name keep working.
 *
 * @param hostHeader - Raw `Host` header value, or undefined if the request had none.
 * @param allowedHostnames - Lowercased hostnames accepted besides IP literals.
 * @returns True if the request should be served.
 */
export function isAllowedHost(
  hostHeader: string | undefined,
  allowedHostnames: readonly string[],
): boolean {
  if (hostHeader === undefined) {
    return false;
  }
  const hostname = hostnameFromHostHeader(hostHeader);
  return isIP(hostname) !== 0 || allowedHostnames.includes(hostname);
}
