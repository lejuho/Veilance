// Veilance — sealed credential entries for the on-chain encrypted inbox.
//
// WHY THIS EXISTS
// ---------------
// A Veilance credential is only useful to its recipient if the recipient learns
// its PRE-IMAGE (originId, materialType, carbonClass, batchSecret). The ledger
// stores only `commitmentOf(credential)`, which is one-way. Midnight offers no
// transport for that pre-image:
//
//   - contract-call transactions have no memo field;
//   - the Zswap ciphertext slot is restricted to `ShieldedCoinInfo` and is
//     forbidden on contract outputs;
//   - the DApp connector exposes only the wallet's encryption PUBLIC key — there
//     is no decrypt operation to borrow.
//
// So delivery goes through contract state, following the MIP-0012 /
// midnightntwrk/passport precedent: an append-only inbox of fixed-size opaque
// sealed entries, plus a per-party X25519 public key registered on-ledger.
// `issueProvenance` and `transferProvenance` each append exactly one entry, in
// the same transaction as the commitment insertion, so creation and delivery are
// atomic.
//
// CRYPTOGRAPHIC SUITE (suite byte = 1)
// ------------------------------------
// Copied from MIP-0012 §6.4:
//
//   ephemeral X25519  ->  HKDF-SHA256  ->  AES-256-GCM
//
//   ikm    = X25519(ephSk, recipientPk)          32 bytes, the raw shared secret
//   salt   = ephPk || recipientPk                64 bytes
//   info   = utf8("veilance:credential:v1")
//   key    = HKDF-Expand(HKDF-Extract(salt, ikm), info, 32)
//   aad    = [ver, suite]                         2 bytes, the cleartext header
//   nonce  = 12 fresh random bytes
//
// The sender key is EPHEMERAL and discarded immediately after sealing. That is
// what makes an entry unattributable: it identifies neither sender nor
// recipient, and two entries to the same recipient are unlinkable. It is also
// why a sender cannot re-open its own output (see `openCredential`).
//
// `salt = ephPk || recipientPk` rather than a fixed salt: it binds the derived
// key to this exact (ephemeral, recipient) pair, so a shared secret can never be
// reused across recipients even if an ephemeral key were accidentally repeated.
//
// PLAINTEXT LAYOUT (129 bytes)
// ----------------------------
//   offset  size  field
//        0    32  originId
//       32    32  materialType
//       64     1  carbonClass          (Uint<8>)
//       65    32  batchSecret
//       97    32  commitment           (redundant, but see `scanInbox`)
//   total   129
//
// `ownerId` is deliberately NOT transmitted: the recipient is the only party who
// can decrypt, so it already knows the credential is addressed to itself and
// fills in its own partyId. `commitment` IS transmitted so a scanner can reject
// a malformed or malicious entry cheaply, before trusting any of its fields.
//
// CONTAINER LAYOUT (192 bytes — matches `Bytes<192>` in veilance.compact)
// ----------------------------------------------------------------------
//   offset  size  field
//        0     1  ver        = 1
//        1     1  suite      = 1   (X25519 + HKDF-SHA256 + AES-256-GCM)
//        2    32  ephPk           ephemeral X25519 public key, raw
//       34    12  nonce           AES-GCM IV
//       46    16  tag             AES-GCM authentication tag
//       62   129  ct              AES-GCM ciphertext of the plaintext above
//      191     1  reserved   = 0  padding to the fixed on-chain cell size
//   total   192
//
// `ver` and `suite` are the AAD, so a downgrade to a future weaker suite cannot
// be forged onto an existing ciphertext. `reserved` exists because the ledger
// cell is a fixed `Bytes<192>` and 62 + 129 = 191; it is asserted to be zero on
// open so it cannot become a covert channel unnoticed.
//
// PORTABILITY
// -----------
// Implemented on `node:crypto`, but only through primitives that WebCrypto also
// provides, and entirely over raw byte arrays. The browser port is mechanical:
//   crypto.generateKeyPairSync('x25519')  -> subtle.generateKey({name:'X25519'})
//   crypto.diffieHellman(...)             -> subtle.deriveBits({name:'X25519'})
//   crypto.hkdfSync('sha256', ...)        -> subtle.deriveBits({name:'HKDF'})
//   createCipheriv('aes-256-gcm', ...)    -> subtle.encrypt({name:'AES-GCM'})
// Note that WebCrypto concatenates the GCM tag onto the ciphertext while
// node:crypto exposes it separately; the container stores them in fixed slots so
// either implementation produces byte-identical entries.

import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { pureCircuits } from "./managed/veilance/contract/index.js";
import type { Credential, Ledger } from "./managed/veilance/contract/index.js";

// --- container / plaintext geometry ------------------------------------------

export const ENTRY_BYTES = 192;
const PLAINTEXT_BYTES = 129;

const VERSION = 1;
const SUITE_X25519_HKDF_AESGCM = 1;

const OFF_VER = 0;
const OFF_SUITE = 1;
const OFF_EPH_PK = 2;
const OFF_NONCE = 34;
const OFF_TAG = 46;
const OFF_CT = 62;
const OFF_RESERVED = 191;

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

const P_ORIGIN = 0;
const P_MATERIAL = 32;
const P_CARBON = 64;
const P_BATCH = 65;
const P_COMMITMENT = 97;

const HKDF_INFO = new TextEncoder().encode("veilance:credential:v1");

// DER prefixes for raw <-> KeyObject conversion. X25519 SPKI and PKCS8 wrappers
// are fixed-length and constant, so raw 32-byte keys round-trip exactly.
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");
const X25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");

// --- key material -------------------------------------------------------------

/** A party's X25519 keypair, as raw 32-byte values. */
export type EncKeypair = {
  /** Registered on-ledger via `registerEncKey`. */
  readonly encPk: Uint8Array;
  /** Never leaves the party's machine. */
  readonly encSk: Uint8Array;
};

/** Fresh X25519 keypair for a party's inbox. */
export const generateEncKeypair = (): EncKeypair => {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const spki = publicKey.export({ type: "spki", format: "der" });
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  return {
    encPk: new Uint8Array(spki.subarray(spki.length - 32)),
    encSk: new Uint8Array(pkcs8.subarray(pkcs8.length - 32)),
  };
};

const publicKeyFromRaw = (raw: Uint8Array) =>
  createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, Buffer.from(raw)]),
    format: "der",
    type: "spki",
  });

const privateKeyFromRaw = (raw: Uint8Array) =>
  createPrivateKey({
    key: Buffer.concat([X25519_PKCS8_PREFIX, Buffer.from(raw)]),
    format: "der",
    type: "pkcs8",
  });

/** ikm -> HKDF-SHA256 -> 32-byte AES-256-GCM key. */
const deriveKey = (
  sharedSecret: Uint8Array,
  ephPk: Uint8Array,
  recipientPk: Uint8Array,
): Buffer => {
  const salt = Buffer.concat([Buffer.from(ephPk), Buffer.from(recipientPk)]);
  return Buffer.from(hkdfSync("sha256", sharedSecret, salt, HKDF_INFO, 32));
};

const aad = (): Buffer => Buffer.from([VERSION, SUITE_X25519_HKDF_AESGCM]);

// --- seal ---------------------------------------------------------------------

/** The credential fields a sender seals, plus the commitment the chain will hold. */
export type SealableCredential = Omit<Credential, "ownerId"> & {
  readonly commitment: Uint8Array;
};

const packPlaintext = (c: SealableCredential): Buffer => {
  const p = Buffer.alloc(PLAINTEXT_BYTES);
  Buffer.from(c.originId).copy(p, P_ORIGIN);
  Buffer.from(c.materialType).copy(p, P_MATERIAL);
  if (c.carbonClass < 0n || c.carbonClass > 255n) {
    throw new Error(`sealCredential: carbonClass ${c.carbonClass} does not fit in Uint<8>`);
  }
  p[P_CARBON] = Number(c.carbonClass);
  Buffer.from(c.batchSecret).copy(p, P_BATCH);
  Buffer.from(c.commitment).copy(p, P_COMMITMENT);
  return p;
};

/**
 * Seal a credential pre-image to `recipientPk`, producing the exact 192-byte
 * value the contract's `Bytes<192>` inbox cell expects.
 *
 * The ephemeral private key is created here and never returned, so not even the
 * caller can re-open the result.
 */
export const sealCredential = (
  recipientPk: Uint8Array,
  cred: SealableCredential,
): Uint8Array => {
  if (recipientPk.length !== 32) {
    throw new Error(`sealCredential: recipientPk must be 32 bytes, got ${recipientPk.length}`);
  }
  const { publicKey: ephPub, privateKey: ephSec } = generateKeyPairSync("x25519");
  const ephSpki = ephPub.export({ type: "spki", format: "der" });
  const ephPk = new Uint8Array(ephSpki.subarray(ephSpki.length - 32));

  const shared = diffieHellman({
    privateKey: ephSec,
    publicKey: publicKeyFromRaw(recipientPk),
  });
  const key = deriveKey(shared, ephPk, recipientPk);
  const nonce = randomBytes(NONCE_BYTES);

  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad());
  const ct = Buffer.concat([cipher.update(packPlaintext(cred)), cipher.final()]);
  const tag = cipher.getAuthTag();

  const entry = Buffer.alloc(ENTRY_BYTES);
  entry[OFF_VER] = VERSION;
  entry[OFF_SUITE] = SUITE_X25519_HKDF_AESGCM;
  Buffer.from(ephPk).copy(entry, OFF_EPH_PK);
  nonce.copy(entry, OFF_NONCE);
  tag.copy(entry, OFF_TAG);
  ct.copy(entry, OFF_CT);
  entry[OFF_RESERVED] = 0;
  return new Uint8Array(entry);
};

// --- open ---------------------------------------------------------------------

/** What a recipient recovers from a sealed entry. `ownerId` is filled in by the caller. */
export type OpenedCredential = {
  readonly originId: Uint8Array;
  readonly materialType: Uint8Array;
  readonly carbonClass: bigint;
  readonly batchSecret: Uint8Array;
  readonly commitment: Uint8Array;
};

/**
 * Attempt to open one inbox entry with `encSk`.
 *
 * Returns `null` — never throws — when the entry is not addressed to this key,
 * is malformed, or fails AEAD verification. That is the normal case: scanning an
 * inbox means failing to open almost every entry in it, and a thrown exception
 * would make "not mine" indistinguishable from "broken client".
 */
export const openCredential = (
  encSk: Uint8Array,
  entry: Uint8Array,
): OpenedCredential | null => {
  try {
    if (entry.length !== ENTRY_BYTES) return null;
    const buf = Buffer.from(entry);
    if (buf[OFF_VER] !== VERSION) return null;
    if (buf[OFF_SUITE] !== SUITE_X25519_HKDF_AESGCM) return null;
    if (buf[OFF_RESERVED] !== 0) return null;

    const ephPk = new Uint8Array(buf.subarray(OFF_EPH_PK, OFF_EPH_PK + 32));
    const nonce = buf.subarray(OFF_NONCE, OFF_NONCE + NONCE_BYTES);
    const tag = buf.subarray(OFF_TAG, OFF_TAG + TAG_BYTES);
    const ct = buf.subarray(OFF_CT, OFF_CT + PLAINTEXT_BYTES);

    const sk = privateKeyFromRaw(encSk);
    // Our own public key is needed for the salt; recompute it from the private key.
    const ownSpki = createPublicKey(sk).export({ type: "spki", format: "der" });
    const ownPk = new Uint8Array(ownSpki.subarray(ownSpki.length - 32));

    const shared = diffieHellman({ privateKey: sk, publicKey: publicKeyFromRaw(ephPk) });
    const key = deriveKey(shared, ephPk, ownPk);

    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(aad());
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);

    return {
      originId: new Uint8Array(pt.subarray(P_ORIGIN, P_ORIGIN + 32)),
      materialType: new Uint8Array(pt.subarray(P_MATERIAL, P_MATERIAL + 32)),
      carbonClass: BigInt(pt[P_CARBON]),
      batchSecret: new Uint8Array(pt.subarray(P_BATCH, P_BATCH + 32)),
      commitment: new Uint8Array(pt.subarray(P_COMMITMENT, P_COMMITMENT + 32)),
    };
  } catch {
    // AEAD failure (the overwhelmingly common "not for me" case), a malformed
    // key, or a truncated container. All are "not mine", not an error.
    return null;
  }
};

// --- scan ---------------------------------------------------------------------

/** Just enough of the ledger for a scan — keeps this usable with any provider. */
export type InboxLedger = Pick<Ledger, "credentialInbox" | "credentialInboxCount"> & {
  provenanceTree: { findPathForLeaf(leaf: Uint8Array): unknown };
};

export type ScanResult = {
  /** Credentials recovered from this scan, in inbox order. */
  readonly credentials: Credential[];
  /** Where to resume next time. Persist this to avoid rescanning. */
  readonly nextIndex: bigint;
};

const eq = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Trial-decrypt the inbox from `fromIndex` and return the credentials that
 * belong to `myPartyId`.
 *
 * This is the whole point of Change C: given ONLY a party's `partySecret`
 * (hence `myPartyId`), its `encSk`, and public chain data, it reconstructs every
 * credential the party holds. No out-of-band channel, and no local state beyond
 * the two secrets.
 *
 * An entry is kept only if all three hold:
 *   1. it opens under `encSk` (AEAD authenticates it);
 *   2. `commitmentOf({ownerId: myPartyId, ...fields})` equals the commitment
 *      embedded in the plaintext — so a sender cannot make us believe in a
 *      credential whose fields do not hash to what it claims;
 *   3. that commitment is actually in `provenanceTree` — so a sender cannot make
 *      us believe in a credential the chain never recorded.
 *
 * Check 2 is what catches a sender that seals fields for a DIFFERENT ownerId:
 * the recomputed commitment would not match. Check 3 is what catches a
 * well-formed entry whose commitment was never inserted.
 */
export const scanInbox = (
  ledger: InboxLedger,
  encSk: Uint8Array,
  myPartyId: Uint8Array,
  fromIndex: bigint = 0n,
): ScanResult => {
  const end = ledger.credentialInboxCount;
  const credentials: Credential[] = [];

  for (let i = fromIndex; i < end; i += 1n) {
    if (!ledger.credentialInbox.member(i)) continue;
    const opened = openCredential(encSk, ledger.credentialInbox.lookup(i));
    if (opened === null) continue; // not ours, or garbage

    const candidate: Credential = {
      ownerId: myPartyId,
      originId: opened.originId,
      materialType: opened.materialType,
      carbonClass: opened.carbonClass,
      batchSecret: opened.batchSecret,
    };

    if (!eq(pureCircuits.commitmentOf(candidate), opened.commitment)) continue;
    if (ledger.provenanceTree.findPathForLeaf(opened.commitment) === undefined) continue;

    credentials.push(candidate);
  }

  return { credentials, nextIndex: end };
};
