// Read-only traffic report for ipynb.ashwingopalsamy.in, measured at Cloudflare's edge: no script on the page, no cookies, no change to the CSP.
//   CF_API_TOKEN=... node tools/traffic.mjs [days=7]
// The token needs: Zone > Analytics > Read, and Account > Account Analytics > Read (for the /link/ outcomes).
const HOST = 'ipynb.ashwingopalsamy.in';
const ZONE = 'ashwingopalsamy.in';
const token = process.env.CF_API_TOKEN;
if (!token) {
  console.error('Set CF_API_TOKEN (Zone Analytics: Read, Account Analytics: Read).');
  process.exit(1);
}
const days = Math.max(1, Number(process.argv[2]) || 7);
const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
const api = async (path, init) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text.slice(0, 300)}`);
  return path === 'graphql' || path.endsWith('/sql') ? JSON.parse(text.startsWith('{') ? text : '{}') : JSON.parse(text);
};
const gql = async (query) => {
  const res = await api('graphql', { method: 'POST', body: JSON.stringify({ query }) });
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
  return res.data.viewer.zones[0].httpRequestsAdaptiveGroups;
};
const table = (rows) => rows.forEach((r) => console.log('  ' + r.map((c, i) => (i ? String(c).padStart(8) : String(c).padEnd(28))).join(' ')));

const zone = (await api(`zones?name=${ZONE}`)).result[0];
if (!zone) throw new Error(`zone ${ZONE} not visible to this token`);
const where = `filter:{ date_geq:"${since}", clientRequestHTTPHost:"${HOST}", requestSource:"eyeball" }`;
const group = (dims, extra = '') => gql(`{ viewer { zones(filter:{zoneTag:"${zone.id}"}) { httpRequestsAdaptiveGroups(limit:1000, ${where}${extra}) { count sum { visits edgeResponseBytes } dimensions { ${dims} } } } } }`);
const html = ', filter:{ date_geq:"' + since + '", clientRequestHTTPHost:"' + HOST + '", requestSource:"eyeball", edgeResponseContentTypeName:"html" }';
const htmlGroup = (dims) => gql(`{ viewer { zones(filter:{zoneTag:"${zone.id}"}) { httpRequestsAdaptiveGroups(limit:1000, orderBy:[count_DESC]${html}) { count sum { visits } dimensions { ${dims} } } } } }`);

console.log(`${HOST}, last ${days} day(s), visitor-initiated requests (bots not excluded)\n`);
try {
  const daily = (await htmlGroup('date')).sort((a, b) => a.dimensions.date.localeCompare(b.dimensions.date));
  console.log('Page loads and visits per day');
  table([['day', 'loads', 'visits'], ...daily.map((r) => [r.dimensions.date, r.count, r.sum.visits])]);
  console.log('\nTop pages');
  const pages = new Map();
  for (const r of await htmlGroup('clientRequestPath')) pages.set(r.dimensions.clientRequestPath, (pages.get(r.dimensions.clientRequestPath) ?? 0) + r.count);
  table([...pages].sort((a, b) => b[1] - a[1]).slice(0, 10));
  console.log('\nTop countries');
  const countries = new Map();
  for (const r of await htmlGroup('clientCountryName')) countries.set(r.dimensions.clientCountryName, (countries.get(r.dimensions.clientCountryName) ?? 0) + r.count);
  table([...countries].sort((a, b) => b[1] - a[1]).slice(0, 10));
  console.log('\nStatus codes (all requests)');
  const status = new Map();
  for (const r of await group('edgeResponseStatus', ', orderBy:[count_DESC]')) status.set(r.dimensions.edgeResponseStatus, (status.get(r.dimensions.edgeResponseStatus) ?? 0) + r.count);
  table([...status].sort((a, b) => b[1] - a[1]));
} catch (e) {
  console.error('Edge analytics failed:', e.message);
  if (days > 1) console.error('(free plans may keep only about a day of per-host data; try: node tools/traffic.mjs 1)');
}

// How notebook links ended, from the Worker's own aggregate rows (no addresses are stored).
try {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${zone.account.id}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: `SELECT blob1 AS outcome, blob2 AS host, count() AS n FROM ipynb_viewer WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY outcome, host ORDER BY n DESC FORMAT JSON`,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const rows = (await res.json()).data ?? [];
  console.log('\nNotebook link outcomes (/link/)');
  table(rows.length ? rows.map((r) => [`${r.outcome} ${r.host}`, r.n]) : [['none yet', '']]);
} catch (e) {
  console.error('\nLink outcomes failed:', e.message);
}
