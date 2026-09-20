import { describe, expect, it } from 'vitest';

import { buildAllowedHostnames, hostnameFromHostHeader, isAllowedHost } from './host-check.js';

describe('hostnameFromHostHeader', () => {
  it('drops the port from a name or IPv4 host', () => {
    expect(hostnameFromHostHeader('localhost:8090')).toBe('localhost');
    expect(hostnameFromHostHeader('192.168.1.20:8090')).toBe('192.168.1.20');
  });

  it('returns a host with no port unchanged, lowercased and trimmed', () => {
    expect(hostnameFromHostHeader(' MyPC.local ')).toBe('mypc.local');
  });

  it('unwraps a bracketed IPv6 literal, with or without a port', () => {
    expect(hostnameFromHostHeader('[::1]:8090')).toBe('::1');
    expect(hostnameFromHostHeader('[fe80::1]')).toBe('fe80::1');
  });

  it('leaves an unterminated bracket and a bare IPv6 literal alone', () => {
    expect(hostnameFromHostHeader('[::1')).toBe('[::1');
    expect(hostnameFromHostHeader('fe80::1')).toBe('fe80::1');
  });
});

describe('buildAllowedHostnames', () => {
  it('allows localhost and the machine name with and without .local', () => {
    expect(buildAllowedHostnames('MyPC')).toEqual(['localhost', 'mypc', 'mypc.local']);
    expect(buildAllowedHostnames('mypc.local')).toEqual(['localhost', 'mypc.local', 'mypc']);
  });

  it('allows only localhost when the machine has no name', () => {
    expect(buildAllowedHostnames('  ')).toEqual(['localhost']);
  });
});

describe('isAllowedHost', () => {
  const allowed = buildAllowedHostnames('mypc');

  it('accepts IP literals on any port', () => {
    expect(isAllowedHost('127.0.0.1:8090', allowed)).toBe(true);
    expect(isAllowedHost('192.168.1.20', allowed)).toBe(true);
    expect(isAllowedHost('[::1]:8090', allowed)).toBe(true);
  });

  it('accepts localhost and the machine name', () => {
    expect(isAllowedHost('localhost:8090', allowed)).toBe(true);
    expect(isAllowedHost('MYPC.local:8090', allowed)).toBe(true);
  });

  it('refuses any other name, which is what a DNS rebinding request carries', () => {
    expect(isAllowedHost('evil.example.com:8090', allowed)).toBe(false);
    expect(isAllowedHost('127.0.0.1.evil.example.com', allowed)).toBe(false);
  });

  it('refuses a request with no Host header', () => {
    expect(isAllowedHost(undefined, allowed)).toBe(false);
  });
});
