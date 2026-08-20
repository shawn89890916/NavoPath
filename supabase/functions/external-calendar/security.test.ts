import assert from "node:assert/strict";
import test from "node:test";
import { isForbiddenNetworkAddress, validateCalendarUrl } from "./security.ts";

test("calendar URL policy allows only public-style HTTPS hosts on port 443", () => {
  assert.equal(validateCalendarUrl("https://calendar.example.com/private.ics").hostname, "calendar.example.com");
  for (const value of ["http://example.com/a.ics", "https://localhost/a.ics", "https://127.0.0.1/a.ics", "https://example.com:8443/a.ics", "https://user:pass@example.com/a.ics"]) {
    assert.throws(() => validateCalendarUrl(value));
  }
});

test("private, loopback, link-local and mapped addresses are rejected", () => {
  for (const value of ["10.0.0.1", "127.0.0.1", "169.254.2.3", "172.20.1.1", "192.168.1.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isForbiddenNetworkAddress(value), true, value);
  }
  assert.equal(isForbiddenNetworkAddress("8.8.8.8"), false);
  assert.equal(isForbiddenNetworkAddress("2606:4700:4700::1111"), false);
});
