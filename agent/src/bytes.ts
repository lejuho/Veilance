// Veilance Party Agent — small byte/hex helpers shared across the agent.
//
// `bytes32FromLabel` mirrors contract/e2e/run.ts's own `bytes32()` helper
// exactly (UTF-8 encode, zero-pad/truncate to 32 bytes) — reused rather than
// reinvented so materialType/originId encoding stays identical to the
// devnet-verified e2e script's.

export const bytes32FromLabel = (label: string): Uint8Array => {
  const encoded = new TextEncoder().encode(label);
  if (encoded.length > 32) {
    throw new Error(`label "${label}" is ${encoded.length} UTF-8 bytes, does not fit in Bytes<32>`);
  }
  const out = new Uint8Array(32);
  out.set(encoded);
  return out;
};

/** Decodes a Bytes<32> produced by {@link bytes32FromLabel} back to its label, stripping zero padding. */
export const labelFromBytes32 = (bytes: Uint8Array): string => {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  return new TextDecoder().decode(bytes.subarray(0, end));
};

export const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");

export const fromHex = (hex: string): Uint8Array => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`odd-length hex string: ${hex}`);
  return new Uint8Array(Buffer.from(clean, "hex"));
};

export const randomHex32 = (): string => toHex(crypto.getRandomValues(new Uint8Array(32)));

export const ZERO_HEX_32 = "00".repeat(32);
