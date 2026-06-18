// Minimal Vercel KV (Upstash Redis) client over REST — no npm dependency.
// Enabled automatically when a Vercel KV / Upstash store is connected
// (env vars KV_REST_API_URL + KV_REST_API_TOKEN are injected by Vercel).
const URL = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

const enabled = !!(URL && TOKEN);

// Run a pipeline of Redis commands. `cmds` = [["INCR","k"], ["HGETALL","h"], ...]
async function pipe(cmds) {
  if (!enabled || !cmds.length) return [];
  const r = await fetch(URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("KV " + r.status);
  const data = await r.json(); // [{result:...}|{error:...}, ...]
  return data.map((x) => (x && "result" in x ? x.result : null));
}

// Convert HGETALL flat array [f,v,f,v] -> { f:Number(v) }
function hToObj(arr) {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]) || 0;
  return o;
}

module.exports = { enabled, pipe, hToObj };
