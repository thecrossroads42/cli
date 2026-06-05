// Unit tests for the CLI's encryption routing (cli-crypto.js). The crypto itself
// is proven by the @thecrossroads42/crypto-client tests; here we cover the tier
// routing with an injected fake client (no real package / server). Run:
//   node --test cli-crypto.test.js

const { test } = require('node:test');
const assert = require('node:assert');
const { setupEncryption } = require('./cli-crypto.js');

function fakeClient() {
  const calls = { configure: null, unlock: [] };
  return {
    calls,
    configure(cfg) { calls.configure = cfg; },
    keyring: { unlock: async (uid, opts) => { calls.unlock.push([uid, opts]); } },
    encryptVisitUpdate: async (_id, updates) => ({ meta: 'clear', enc: { ct: 'x' }, _updates: updates }),
    decryptVisit: async (w) => ({ decrypted: true, id: w.id }),
  };
}
const base = (over = {}) => ({
  apiUrl: 'https://x', authHeader: { Authorization: 'Bearer t' },
  getUserId: async () => 'user_a',
  getKeyringRecord: async () => null,
  getPassphrase: async () => '',
  loadClient: async () => fakeClient(),
  ...over,
});

test('plaintext account (no keyring) → null, package never loaded', async () => {
  let loaded = false;
  const h = await setupEncryption(base({ loadClient: async () => { loaded = true; return fakeClient(); } }));
  assert.equal(h, null);
  assert.equal(loaded, false);
});

test('device tier → refused (key bound to origin device)', async () => {
  await assert.rejects(
    setupEncryption(base({ getKeyringRecord: async () => ({ tier: 'device' }) })),
    /bound to its original device/,
  );
});

test('passphrase tier without a passphrase → clear error', async () => {
  await assert.rejects(
    setupEncryption(base({ getKeyringRecord: async () => ({ tier: 'passphrase' }), getPassphrase: async () => '' })),
    /--passphrase or the CROSSROADS_PASSPHRASE/,
  );
});

test('passphrase tier unlocks with the supplied passphrase + returns a handler', async () => {
  const client = fakeClient();
  const h = await setupEncryption(base({
    getKeyringRecord: async () => ({ tier: 'passphrase' }),
    getPassphrase: async () => 'hunter2',
    loadClient: async () => client,
  }));
  assert.equal(h.tier, 'passphrase');
  assert.deepEqual(h.turnFields, { encrypted: true, encryptionTier: 'passphrase' });
  assert.deepEqual(client.calls.unlock[0], ['user_a', { passphrase: 'hunter2' }]);
  assert.equal(client.calls.configure.baseUrl, 'https://x');
  // encryptPut marks the body encrypted; decryptVisit delegates to the client.
  const put = await h.encryptPut(7, { messages: [1] });
  assert.equal(put.encrypted, true);
  assert.deepEqual((await h.decryptVisit({ id: 7 })), { decrypted: true, id: 7 });
});

test('managed tier auto-unlocks (no passphrase needed)', async () => {
  const client = fakeClient();
  const h = await setupEncryption(base({ getKeyringRecord: async () => ({ tier: 'managed' }), loadClient: async () => client }));
  assert.equal(h.tier, 'managed');
  assert.deepEqual(client.calls.unlock[0], ['user_a', undefined]);
});

test('missing crypto-client dep → actionable error', async () => {
  await assert.rejects(
    setupEncryption(base({ getKeyringRecord: async () => ({ tier: 'managed' }), loadClient: async () => { throw new Error('not found'); } })),
    /npm i @thecrossroads42\/crypto-client/,
  );
});
