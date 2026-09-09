import type { DisclosureOp, DisclosurePreview, Profile } from './types';

/**
 * Static "Goes on chain / Stays private" text per spec.md §2.2.1, §3.2.2, §4.2.2 and CONTRACT_DESIGN.md §5.
 * Used by the mock adapter, and as a fallback when the agent's disclosure-preview endpoint is unavailable.
 */
export function staticDisclosure(op: DisclosureOp, profile?: Profile): DisclosurePreview {
  switch (op) {
    case 'issue':
      return {
        public: [
          'One new commitment (32-byte hash) in provenanceTree',
          'One sealed 192-byte inbox entry (ciphertext, unreadable)',
          'Transaction submitter address and timestamp',
        ],
        private: [
          'Recipient organisation and partyId',
          'Origin (originId and its label)',
          'Material type',
          'Carbon class',
          'Quantity, price, contract memo',
          'batchSecret',
        ],
      };
    case 'transfer':
      return {
        public: [
          'One nullifier (32-byte, unlinkable to the commitment)',
          'One new commitment in provenanceTree',
          'One sealed 192-byte inbox entry',
          'Transaction submitter address and timestamp',
        ],
        private: [
          'Which upstream commitment was consumed (anonymity set = whole tree)',
          'Upstream supplier',
          'Origin',
          'Material type and carbon class',
          'Recipient organisation',
        ],
      };
    case 'attest': {
      const base = [
        'attestation key = H(challenge, holderId, profile) — opaque 32 bytes',
        'Profile code (1 / 2 / 3) and policyVersion at proof time',
        'Transaction submitter address and timestamp',
      ];
      const priv = [
        'Which credential was used',
        'Holder identity (challenge is a 256-bit secret shared with the verifier only)',
        'Origin, material, carbon class value',
        'Upstream supplier and commercial relationship',
      ];
      if (profile === 'regulator') {
        return {
          public: [...base, 'The credential nullifier (links to any later transfer of this credential)'],
          private: priv.filter((p) => !p.startsWith('Which credential')).concat(['Which commitment the nullifier belongs to']),
        };
      }
      return { public: base, private: priv };
    }
  }
}
