#!/usr/bin/env node
// sync-djen-local.mjs — CPA Advogados
// Roda no PC do escritório (IP brasileiro).
// Busca publicações DJEN pelas OABs monitoradas e envia ao servidor para gravar.
//
// Uso:
//   node scripts/sync-djen-local.mjs
//   node scripts/sync-djen-local.mjs --base https://SEU-DOMINIO --secret SEGREDO
//
// Variáveis de ambiente:
//   GP_BASE_URL    = URL base do sistema (ex.: https://monitor-juridico.vercel.app)
//   GP_CRON_SECRET = valor do CRON_SECRET

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const BASE_URL    = (arg("--base")   || process.env.GP_BASE_URL    || "").replace(/\/+$/, "");
const CRON_SECRET = (arg("--secret") || process.env.GP_CRON_SECRET || "");

if (!BASE_URL || !CRON_SECRET) {
  console.error("ERRO: defina GP_BASE_URL e GP_CRON_SECRET (ou use --base e --secret).");
  process.exit(1);
}

const DJEN_URL   = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// OABs monitoradas — deve espelhar MONITORED_OABS em src/lib/djen.ts
const OABS = [
  { numero: "22412", uf: "PE", label: "Waldemar Cavalcanti" },
  { numero: "51184", uf: "PE", label: "João Roberto" },
];

async function fetchAllForOab(oab) {
  const itensPorPagina = 200;
  const all = [];
  let pagina = 1;
  for (let guard = 0; guard < 25; guard++) {
    const url = new URL(DJEN_URL);
    url.searchParams.set("numeroOab", oab.numero);
    url.searchParams.set("ufOab", oab.uf);
    url.searchParams.set("itensPorPagina", String(itensPorPagina));
    url.searchParams.set("pagina", String(pagina));
    const res = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": BROWSER_UA },
    });
    if (!res.ok) throw new Error(`DJEN HTTP ${res.status} (OAB ${oab.numero}/${oab.uf})`);
    const data = await res.json();
    const items = data?.items ?? [];
    all.push(...items);
    const count = data?.count ?? all.length;
    if (all.length >= count || items.length === 0) break;
    pagina++;
  }
  return all;
}

async function main() {
  console.log(`\n=== CPA Advogados — Sync DJEN ===`);
  console.log(`Sistema: ${BASE_URL}`);
  console.log(`Hora: ${new Date().toLocaleString("pt-BR")}\n`);

  const perOab = [];
  const byHash = new Map();

  for (const oab of OABS) {
    try {
      const items = await fetchAllForOab(oab);
      perOab.push({ oab: `${oab.numero}/${oab.uf}`, label: oab.label, total: items.length });
      console.log(`  ${oab.numero}/PE — ${oab.label}: ${items.length} publicações`);
      for (const it of items) {
        const k = it.hash || String(it.id);
        if (!byHash.has(k)) byHash.set(k, it);
      }
    } catch (err) {
      console.error(`  Erro OAB ${oab.numero}: ${err?.message || err}`);
      perOab.push({ oab: `${oab.numero}/${oab.uf}`, label: oab.label, total: 0 });
    }
  }

  const items = Array.from(byHash.values());
  console.log(`\nTotal de publicações distintas: ${items.length}`);
  console.log("Enviando ao servidor...\n");

  let totalCreated = 0, totalSynced = 0;

  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${BASE_URL}/api/cron/sincronizar-djen/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ items, perOab }),
    });
    const data = await res.json();
    if (!res.ok) { console.error("ERRO do servidor:", data.error || res.status); process.exit(1); }

    totalCreated += data.created || 0;
    totalSynced  += data.synced  || 0;
    console.log(`  Lote ${i + 1}: +${data.created} processos  +${data.synced} movimentações  restam ${data.remaining}`);
    if ((data.errors || []).length) {
      for (const e of data.errors.slice(0, 5)) console.log(`    aviso: ${e}`);
    }
    if (!data.remaining || data.remaining <= 0) break;
  }

  console.log(`\n✓ Concluído: ${totalCreated} processos criados, ${totalSynced} movimentações.\n`);
}

main().catch((err) => { console.error("Falha:", err?.message || err); process.exit(1); });
