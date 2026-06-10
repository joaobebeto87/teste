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
const DESDE_OVERRIDE = arg("--desde"); // força uma data específica (YYYY-MM-DD)

if (!BASE_URL || !CRON_SECRET) {
  console.error("ERRO: defina GP_BASE_URL e GP_CRON_SECRET (ou use --base e --secret).");
  process.exit(1);
}

const DJEN_URL    = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_KEY  = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const BROWSER_UA  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TJ_TT_TO_UF = {
  "01":"ac","02":"al","03":"ap","04":"am","05":"ba","06":"ce","07":"df","08":"es",
  "09":"go","10":"ma","11":"mt","12":"ms","13":"mg","14":"pa","15":"pb","16":"pr",
  "17":"pe","18":"pi","19":"rj","20":"rn","21":"rs","22":"ro","23":"rr","24":"sc",
  "25":"se","26":"sp","27":"to",
};

function cnjToAlias(digits) {
  if (digits.length !== 20) return null;
  const j = digits[13], tt = digits.substring(14,16), n = parseInt(tt,10);
  switch(j) {
    case "8": { const uf = TJ_TT_TO_UF[tt]; return uf ? `api_publica_tj${uf}` : null; }
    case "5": return n >= 1 ? `api_publica_trt${n}` : null;
    case "4": return n >= 1 ? `api_publica_trf${n}` : null;
    case "3": return tt === "00" ? "api_publica_stj" : null;
    default:  return null;
  }
}

async function fetchCapa(digits, sigla) {
  const alias = cnjToAlias(digits) ?? (sigla ? `api_publica_${sigla.toLowerCase()}` : null);
  if (!alias) return null;
  try {
    const res = await fetch(`${DATAJUD_BASE}/${alias}/_search`, {
      method: "POST",
      headers: { Authorization: `APIKey ${DATAJUD_KEY}`, "Content-Type": "application/json", "User-Agent": BROWSER_UA },
      body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: digits } } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.hits?.hits?.[0]?._source;
    if (!hit) return null;
    const movimentos = (Array.isArray(hit.movimentos) ? hit.movimentos : [])
      .map(m => ({ data: m?.dataHora ?? "", nome: m?.nome ?? "" }))
      .filter(m => m.nome)
      .sort((a,b) => new Date(b.data) - new Date(a.data));
    return { classe: hit.classe?.nome, assunto: hit.assuntos?.[0]?.nome, orgaoJulgador: hit.orgaoJulgador?.nome, dataAjuizamento: hit.dataAjuizamento, movimentos };
  } catch { return null; }
}

// OABs monitoradas — deve espelhar MONITORED_OABS em src/lib/djen.ts
const OABS = [
  { numero: "22412", uf: "PE", label: "Waldemar Cavalcanti" },
  { numero: "51184", uf: "PE", label: "João Roberto" },
];

async function fetchAllForOab(oab, desde) {
  const itensPorPagina = 200;
  const all = [];
  let pagina = 1;
  for (let guard = 0; guard < 25; guard++) {
    const url = new URL(DJEN_URL);
    url.searchParams.set("numeroOab", oab.numero);
    url.searchParams.set("ufOab", oab.uf);
    url.searchParams.set("itensPorPagina", String(itensPorPagina));
    url.searchParams.set("pagina", String(pagina));
    if (desde) {
      // API do DJEN espera DD/MM/YYYY
      const [ano, mes, dia] = desde.split("-");
      url.searchParams.set("dataDisponibilizacaoInicio", `${dia}/${mes}/${ano}`);
    }
    const res = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": BROWSER_UA },
      signal: AbortSignal.timeout(30000),
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

  // Janela fixa de 60 dias — NÃO usa a data da última sync.
  // A API do DJEN é instável com filtros de datas recentes (retorna 0 com ontem).
  // Com 60 dias a resposta é confiável. O processedIds no servidor deduplica.
  let desde = DESDE_OVERRIDE;
  if (!desde) {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    desde = d.toISOString().substring(0, 10);
  }
  console.log(`  Janela de busca: ${desde} até hoje\n`);

  const perOab = [];
  const byHash = new Map();

  for (const oab of OABS) {
    try {
      process.stdout.write(`  Buscando ${oab.numero}/${oab.uf} — ${oab.label}... `);
      const items = await fetchAllForOab(oab, desde);
      perOab.push({ oab: `${oab.numero}/${oab.uf}`, label: oab.label, total: items.length });
      console.log(`${items.length} publicações`);
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

  if (items.length === 0) {
    console.log("Nenhuma publicação encontrada. Verifique a conectividade com a API do DJEN.\n");
    process.exit(0);
  }

  // Buscar capas DataJud apenas para processos que ainda não existem no servidor.
  // Estratégia: envia um lote de "dry-check" para saber quais CNJs são novos.
  const todosCnjs = [...new Set(
    items.map(it => (it.numero_processo || it.numeroprocessocommascara || "").replace(/\D/g, ""))
         .filter(d => d.length === 20)
  )];

  console.log(`\nVerificando quais dos ${todosCnjs.length} processos são novos no servidor...`);
  let cnjsNovos = new Set(todosCnjs);
  try {
    const checkRes = await fetch(`${BASE_URL}/api/processos/check-cnjs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ cnjs: todosCnjs }),
      signal: AbortSignal.timeout(15000),
    });
    if (checkRes.ok) {
      const { existing } = await checkRes.json();
      existing.forEach(c => cnjsNovos.delete(c));
      console.log(`  ${cnjsNovos.size} processos novos, ${existing.length} já existem\n`);
    }
  } catch { console.log("  (não foi possível verificar — buscaremos capas para todos)\n"); }

  // Buscar DataJud apenas para os processos novos
  const capas = {};
  const cnjsParaCapas = [...cnjsNovos];
  if (cnjsParaCapas.length > 0) {
    console.log(`Buscando capas DataJud para ${cnjsParaCapas.length} processo(s) novo(s)...`);
    for (const digits of cnjsParaCapas) {
      const sigla = items.find(it =>
        (it.numero_processo || it.numeroprocessocommascara || "").replace(/\D/g, "") === digits
      )?.siglaTribunal;
      capas[digits] = await fetchCapa(digits, sigla);
      process.stdout.write(".");
    }
    console.log();
  }

  console.log("\nEnviando ao servidor em lotes...\n");

  const BATCH_SIZE = 200;
  let totalCreated = 0, totalSynced = 0, lote = 0;

  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    lote++;
    const res = await fetch(`${BASE_URL}/api/cron/sincronizar-djen/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ items: batch, perOab, capas }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await res.json();
    if (!res.ok) { console.error("ERRO do servidor:", data.error || res.status); process.exit(1); }

    totalCreated += data.created || 0;
    totalSynced  += data.synced  || 0;
    console.log(`  Lote ${lote}: +${data.created} processos  +${data.synced} movimentações  (${offset + batch.length}/${items.length})`);
    if ((data.errors || []).length) {
      for (const e of data.errors.slice(0, 3)) console.log(`    aviso: ${e}`);
    }
  }

  console.log(`\nConcluído: ${totalCreated} processos criados, ${totalSynced} movimentações.\n`);
}

main().catch((err) => { console.error("Falha:", err?.message || err); process.exit(1); });
