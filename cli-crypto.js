// =============================================================================
// Optional client-side-encryption support for the CLI.
//
// Loaded only when the account has a keyring (i.e. the deployment runs with
// ENCRYPTED_VISITS). Wires the published @thecrossroads42/crypto-client to the
// CLI's HTTP + auth so the CLI can read and write an encrypted account's visits.
//
//   null            → plaintext account (the common/default case); CLI runs as-is
//   throws          → device tier (key bound to its origin device), a missing
//                     passphrase, or the crypto-client dep not installed
//   { … } handler   → tier + turnFields (sent on greeting/chat) + encryptPut /
//                     decryptVisit, used to wrap the CLI's persistence
//
// The actual crypto lives in the published package; this is just the routing +
// wiring. `loadClient` is injectable so the routing is unit-testable without the
// real package or a server.
// =============================================================================

async function setupEncryption({ apiUrl, authHeader, getKeyringRecord, getUserId, getPassphrase, loadClient }) {
  const record = await getKeyringRecord();
  if (!record || !record.tier) return null; // plaintext account

  const load = loadClient || (() => import('@thecrossroads42/crypto-client'));
  let client;
  try {
    client = await load();
  } catch {
    throw new Error(
      "this account uses client-side encryption — install the crypto client to use it:\n" +
      "  npm i @thecrossroads42/crypto-client",
    );
  }

  const userId = await getUserId();
  client.configure({ baseUrl: apiUrl, getAuthHeader: () => authHeader, getUserId: () => userId });

  const tier = record.tier;
  if (tier === 'device') {
    throw new Error("this account's encryption key is bound to its original device; the CLI can't unlock it — use the app for this account.");
  }
  if (tier === 'passphrase') {
    const passphrase = await getPassphrase();
    if (!passphrase) {
      throw new Error('this account is passphrase-encrypted — provide it with --passphrase or the CROSSROADS_PASSPHRASE env var.');
    }
    try {
      await client.keyring.unlock(userId, { passphrase });
    } catch {
      throw new Error('could not unlock the account — wrong passphrase?');
    }
  } else {
    // managed: the server-unwrapped CEK is in the record; unlock resolves it.
    await client.keyring.unlock(userId);
  }

  return {
    tier,
    // Sent on greeting/chat so the server's encryption guard admits the turn.
    turnFields: { encrypted: true, encryptionTier: tier },
    // Encrypt a visit update for PUT /visits/:id (the server stores the opaque blob).
    async encryptPut(visitId, updates) {
      return { ...(await client.encryptVisitUpdate(visitId, updates)), encrypted: true };
    },
    // Decrypt a wire visit from GET /visits/:id back to plaintext.
    decryptVisit(wireVisit) {
      return client.decryptVisit(wireVisit);
    },
  };
}

module.exports = { setupEncryption };
