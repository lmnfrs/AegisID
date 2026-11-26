// Decodes one base64url JWT segment into JSON. Throws on malformed input.
function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Dev display only: shows the header and payload. The signature is never decoded or trusted here.
export function decodeToken(token: string): { header: unknown; payload: unknown } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return { header: decodeSegment(parts[0]), payload: decodeSegment(parts[1]) };
  } catch {
    return null;
  }
}
