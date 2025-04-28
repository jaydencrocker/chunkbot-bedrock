// bot.cjs

// ─── PATCH THE CRYPTO HASH BUG ───────────────────────────────────────────────
const crypto = require('crypto');
const _origCreateHash = crypto.createHash;
crypto.createHash = function (alg) {
  const h = _origCreateHash(alg);
  const _origUpdate = h.update;
  h.update = function (data, enc) {
    if (typeof data === 'object') data = JSON.stringify(data);
    return _origUpdate.call(this, data, enc);
  };
  return h;
};

// ─── IMPORTS & .env ──────────────────────────────────────────────────────────
const { Authflow, Titles } = require('prismarine-auth');
const { RealmAPI }          = require('prismarine-realms');
const { createClient }      = require('bedrock-protocol');
require('dotenv').config();

// ─── CREDENTIALS CHECK ───────────────────────────────────────────────────────
const email    = process.env.MC_EMAIL;
const password = process.env.MC_PASSWORD;
if (!email || !password) {
  console.error('❌ Set MC_EMAIL and MC_PASSWORD in your .env');
  process.exit(1);
}
console.log('🆔 Email:', email);

// ─── INSTANTIATE AUTH FLOW ────────────────────────────────────────────────────
const flow = new Authflow({
  email,
  password,
  flow:      'live',                    // Microsoft “live” flow (needs authTitle)
  authTitle: Titles.MinecraftWindows10, // The Bedrock title ID for Win10/Realms
  store:     './auth-store'             // where tokens get cached
});

async function main() {
  try {
    // ─── XBL TOKEN ────────────────────────────────────────────────────────────
    console.log('🔑 Fetching Xbox Live token…');
    await flow.getXboxToken();
    console.log('✅ XBL token obtained');

    // ─── REALMS API ──────────────────────────────────────────────────────────
    console.log('🔑 Fetching Realms list…');
    const api    = RealmAPI.from(flow, 'bedrock');
    const realms = await api.getRealms();
    console.log('✅ Realms:', realms.map(r => r.name));

    // ─── PICK YOUR REALM ──────────────────────────────────────────────────────
    const TARGET = 'Main realm';
    const realm  = realms.find(r => r.name === TARGET);
    if (!realm) {
      console.error(`❌ Realm "${TARGET}" not found.`);
      return;
    }
    console.log(`✅ Found Realm: ${realm.name} (ID: ${realm.id})`);

    // ─── RESOLVE ADDRESS ──────────────────────────────────────────────────────
    console.log('🌍 Resolving server address…');
    const rawAddr = await realm.getAddress();
    console.log('🔍 Raw address response:', rawAddr);

    let host, port;
    if (typeof rawAddr === 'object') {
      ({ host, port } = rawAddr);
    } else {
      [host, port] = rawAddr.split(':');
    }

    console.log(`🔌 Connecting to ${host}:${port}`);

    // ─── JOIN VIA bedrock-protocol ────────────────────────────────────────────
    const client = createClient({
      host,
      port:      Number(port),
      authFlow:  flow        // hand off *the same* Authflow to bedrock-protocol
    });

    client.on('join',      () => console.log('✅ Joined Realm!'));
    client.on('disconnect',r => console.log('🔴 Disconnected:', r));
    client.on('error',     e => console.error('❌ Error:', e));

  } catch (err) {
    console.error('❌ Auth/Realms error:', err);
  }
}

main();