function isPrivateIpv4(value: string) {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

export function isForbiddenNetworkAddress(value: string) {
  const address = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return isPrivateIpv4(address);
  if (address === "::" || address === "::1" || address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export function validateCalendarUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || (url.port && url.port !== "443")) throw new Error("Only HTTPS calendar URLs on port 443 are allowed");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in the calendar URL");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Local calendar hosts are not allowed");
  if (/^\[.*\]$/.test(url.host) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) throw new Error("IP-address calendar hosts are not allowed");
  return url;
}

export async function assertPublicCalendarHost(url: URL) {
  const resolveDns = (globalThis as any).Deno?.resolveDns as undefined | ((host: string, type: "A" | "AAAA") => Promise<string[]>);
  if (!resolveDns) throw new Error("DNS validation is unavailable");
  const results = await Promise.allSettled([resolveDns(url.hostname, "A"), resolveDns(url.hostname, "AAAA")]);
  const addresses = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!addresses.length) throw new Error("Calendar host could not be resolved");
  if (addresses.some(isForbiddenNetworkAddress)) throw new Error("Private and link-local calendar hosts are not allowed");
}
