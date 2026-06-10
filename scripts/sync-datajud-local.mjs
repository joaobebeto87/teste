#!/usr/bin/env node
// sync-datajud-local.mjs — CPA Advogados
// Busca andamentos novos no Datajud para todos os processos judiciais ativos
// e envia ao servidor para registrar como movimentações.
//
// Uso:
//   node scripts/sync-datajud-local.mjs
//   node scripts/sync-datajud-local.mjs --base https://SEU-DOMINIO --secret SEGREDO
//
// Variáveis de ambiente:
//   GP_BASE_URL    = URL base do sistema
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

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_KEY  = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const BROWSER_UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CONCURRENCY  = 20;

const TJ_TT_TO_UF = {
  "01":"ac","02":"al","03":"ap","04":"am","05":"ba","06":"ce","07":"df","08":"es",
  "09":"go","10":"ma","11":"mt","12":"ms","13":"mg","14":"pa","15":"pb","16":"pr",
  "17":"pe","18":"pi","19":"rj","20":"rn","21":"rs","22":"ro","23":"rr","24":"sc",
  "25":"se","26":"sp","27":"to",
};

function cnjToAlias(digits) {
  if (digits.length !== 20) return null;
  const j = digits[13], tt = digits.substring(14, 16), n = parseInt(tt, 10);
  switch (j) {
    case "8": { const uf = TJ_TT_TO_UF[tt]; return uf ? `api_publica_tj${uf}` : null; }
    case "5": return n >= 1 ? `api_publica_trt${n}` : null;
    case "4": return n >= 1 ? `api_publica_trf${n}` : null;
    case "3": return tt === "00" ? "api_publica_stj" : null;
    case "6": return tt === "00" ? "api_publica_tse" : `api_publica_tre${TJ_TT_TO_UF[tt] ?? ""}`;
    default:  return null;
  }
}

async function fetchMovimentos(digits) {
  const alias = cnjToAlias(digits);
  if (!alias) return null;
  try {
    const res = await fetch(`${DATAJUD_BASE}/${alias}/_search`, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${DATAJUD_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: digits } },
        _source: ["movimentos"],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.hits?.hits?.[0]?._source;
    if (!hit) return null;
    return (Array.isArray(hit.movimentos) ? hit.movimentos : [])
      .map(m => ({ data: m?.dataHora ?? "", nome: m?.nome ?? "" }))
      .filter(m => m.nome)
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  } catch {
    return null;
  }
}

async function main() {
  console.log("\n=== CPA Advogados — Sync Datajud (andamentos) ===");
  console.log(`Sistema: ${BASE_URL}`);
  console.log(`Hora:    ${new Date().toLocaleString("pt-BR")}\n`);

  // 1. Buscar lista de processos ativos + estado atual de andamentos
  console.log("Buscando lista de processos judiciais ativos...");
  const infoRes = await fetch(`${BASE_URL}/api/cron/sincronizar-datajud`, {
    headers: { "x-cron-secret": CRON_SECRET },
    signal: AbortSignal.timeout(15000),
  });
  if (!infoRes.ok) {
    console.error("Erro ao buscar processos:", await infoRes.text());
    process.exit(1);
  }
  const { processes, states } = await infoRes.json();
  console.log(`  ${processes.length} processos judiciais ativos\n`);

  if (processes.length === 0) {
    console.log("Nenhum processo ativo para sincronizar.\n");
    process.exit(0);
  }

  // 2. Para cada processo, buscar movimentos no Datajud em paralelo
  console.log(`Consultando Datajud (${CONCURRENCY} paralelos)...`);
  const results = [];
  let done = 0;

  for (let i = 0; i < processes.length; i += CONCURRENCY) {
    const batch = processes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (proc) => {
      const digits = proc.number.replace(/\D/g, "");
      const movimentos = await fetchMovimentos(digits);
      done++;
      if (done % 50 === 0 || done === processes.length) {
        process.stdout.write(`\r  ${done}/${processes.length} consultados...`);
      }
      if (!movimentos || movimentos.length === 0) return;

      // Filtrar apenas os movimentos mais recentes que o último sync deste processo
      const lastSeenDate = states[proc.id] ?? null;
      const novos = lastSeenDate
        ? movimentos.filter(m => m.data && m.data > lastSeenDate)
        : movimentos; // primeira vez: pega todos

      if (novos.length === 0) return;

      results.push({
        processId: proc.id,
        processNumber: proc.number,
        movements: novos,
        latestDate: movimentos[0].data, // o mais recente (já ordenado desc)
      });
    }));
  }
  console.log("\n");

  const totalMovs = results.reduce((s, r) => s + r.movements.length, 0);
  console.log(`Andamentos novos encontrados: ${totalMovs} em ${results.length} processo(s)`);

  if (results.length === 0) {
    console.log("Nenhum andamento novo. Tudo atualizado.\n");
    // Mesmo sem novidades, avisar o servidor para atualizar timestamp
    await fetch(`${BASE_URL}/api/cron/sincronizar-datajud/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ items: [] }),
      signal: AbortSignal.timeout(15000),
    });
    process.exit(0);
  }

  // 3. Enviar ao servidor em lotes de 50 processos
  console.log("\nEnviando ao servidor...");
  const BATCH_SIZE = 50;
  let totalCreated = 0;

  for (let offset = 0; offset < results.length; offset += BATCH_SIZE) {
    const batch = results.slice(offset, offset + BATCH_SIZE);
    const res = await fetch(`${BASE_URL}/api/cron/sincronizar-datajud/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ items: batch }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await res.json();
    if (!res.ok) { console.error("ERRO do servidor:", data.error || res.status); process.exit(1); }
    totalCreated += data.movements || 0;
    console.log(`  Lote ${Math.floor(offset / BATCH_SIZE) + 1}: +${data.movements} andamentos em ${data.processes} processo(s)`);
  }

  console.log(`\nConcluído: ${totalCreated} andamentos novos registrados.\n`);
}

main().catch(err => { console.error("Falha:", err?.message || err); process.exit(1); });
