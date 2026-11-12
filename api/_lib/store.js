// Key-value store. Upstash Redis over REST in production; in-memory map for dev and tests.
// Only the commands below are used, so swapping providers means re-implementing this file only.

const mem = { kv: new Map(), sets: new Map() };

function memExpired(key) {
  const e = mem.kv.get(key);
  if (e && e.exp && e.exp < Date.now()) {
    mem.kv.delete(key);
    return true;
  }
  return false;
}

const memoryStore = {
  kind: 'memory',
  async get(key) {
    memExpired(key);
    return mem.kv.has(key) ? mem.kv.get(key).v : null;
  },
  async set(key, value, { ex, nx } = {}) {
    memExpired(key);
    if (nx && mem.kv.has(key)) return false;
    mem.kv.set(key, { v: String(value), exp: ex ? Date.now() + ex * 1000 : 0 });
    return true;
  },
  async del(key) {
    mem.kv.delete(key);
    mem.sets.delete(key);
  },
  async incr(key, ex) {
    memExpired(key);
    const cur = Number(mem.kv.get(key)?.v || 0) + 1;
    const exp = mem.kv.get(key)?.exp || (ex ? Date.now() + ex * 1000 : 0);
    mem.kv.set(key, { v: String(cur), exp });
    return cur;
  },
  async sadd(key, member) {
    if (!mem.sets.has(key)) mem.sets.set(key, new Set());
    mem.sets.get(key).add(member);
  },
  async srem(key, member) {
    mem.sets.get(key)?.delete(member);
  },
  async smembers(key) {
    return [...(mem.sets.get(key) || [])];
  },
  _reset() {
    mem.kv.clear();
    mem.sets.clear();
  },
};

function upstashStore(url, token) {
  async function cmd(...args) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args.map(String)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`upstash ${args[0]}: ${data.error || res.status}`);
    return data.result;
  }
  return {
    kind: 'upstash',
    get: (k) => cmd('GET', k),
    async set(k, v, { ex, nx } = {}) {
      const args = ['SET', k, v];
      if (ex) args.push('EX', ex);
      if (nx) args.push('NX');
      return (await cmd(...args)) === 'OK';
    },
    async del(k) {
      await cmd('DEL', k);
    },
    async incr(k, ex) {
      const n = await cmd('INCR', k);
      if (n === 1 && ex) await cmd('EXPIRE', k, ex);
      return n;
    },
    async sadd(k, m) {
      await cmd('SADD', k, m);
    },
    async srem(k, m) {
      await cmd('SREM', k, m);
    },
    smembers: (k) => cmd('SMEMBERS', k),
  };
}

let cached;
export function store() {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  cached = url && token ? upstashStore(url, token) : memoryStore;
  return cached;
}

export const _memoryStore = memoryStore;
