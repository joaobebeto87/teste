// DJEN / Comunica API (CNJ) — sincronização de publicações por OAB.
// Consulta a fonte oficial diretamente, por número de OAB,
// cria movimentações nos processos e cadastra os que faltam.
// Enriquece a capa via Datajud (best-effort) no momento da criação.

import { prisma } from "./db";
import { fetchDatajudCapa, type DatajudCapa } from "./datajud";

const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---- OABs monitoradas — CPA Advogados --------------------------------------
export interface MonitoredOab {
  numero: string;
  uf: string;
  owner: string;
  label: string;
}

export const MONITORED_OABS: MonitoredOab[] = [
  { numero: "22412", uf: "PE", owner: "WALDEMAR", label: "Waldemar Cavalcanti" },
  { numero: "51184", uf: "PE", owner: "JOAO",     label: "João Roberto" },
];

const OWNER_BY_OAB_DIGITS: Record<string, string> = {};
for (const o of MONITORED_OABS) {
  OWNER_BY_OAB_DIGITS[o.numero.replace(/\D/g, "")] = o.owner;
}

const PROCESSED_KEY  = "djen_processed_ids";
const LAST_SYNC_KEY  = "pje_last_sync_at";
const LAST_RESULT_KEY = "djen_last_result";

const MAX_PER_RUN = 200;

// ---- Tipos da API ----------------------------------------------------------
interface DjenAdvogado {
  numero_oab?: string;
  uf_oab?: string;
  nome?: string;
}
export interface DjenItem {
  id: number;
  hash?: string;
  numero_processo?: string;
  numeroprocessocommascara?: string;
  siglaTribunal?: string;
  nomeOrgao?: string;
  tipoComunicacao?: string;
  data_disponibilizacao?: string;
  datadisponibilizacao?: string;
  texto?: string;
  link?: string;
  nomeClasse?: string;
  destinatarios?: { nome?: string; polo?: string }[];
  destinatarioadvogados?: { advogado?: DjenAdvogado }[];
}

// ---- Helpers ---------------------------------------------------------------
function canonicalCnj(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function dedupKey(item: DjenItem): string {
  return item.hash || String(item.id);
}

function ownersOf(item: DjenItem): Set<string> {
  const owners = new Set<string>();
  for (const da of item.destinatarioadvogados ?? []) {
    const digits = canonicalCnj(da.advogado?.numero_oab);
    const uf = (da.advogado?.uf_oab ?? "").toUpperCase();
    const owner = OWNER_BY_OAB_DIGITS[digits];
    if (owner && uf === "PE") owners.add(owner);
  }
  return owners;
}

function mergeOabs(existing: string | null | undefined, owners: Set<string>): string {
  const set = new Set<string>((existing ?? "").split(",").filter(Boolean));
  owners.forEach((o) => set.add(o));
  return Array.from(set).sort().join(",");
}

function ownerLabels(owners: Set<string>): string {
  const labels = new Set<string>();
  for (const o of MONITORED_OABS) {
    if (owners.has(o.owner)) labels.add(o.label);
  }
  return Array.from(labels).join(" e ");
}

function buildMovementDescription(item: DjenItem, owners: Set<string>): string {
  const lines: string[] = ["[Publicação automática — DJEN]", ""];
  const meta: string[] = [];
  if (item.siglaTribunal) meta.push(item.siglaTribunal);
  if (item.nomeOrgao) meta.push(item.nomeOrgao);
  if (meta.length) lines.push(meta.join(" · "));
  const tipoLinha: string[] = [];
  if (item.tipoComunicacao) tipoLinha.push(item.tipoComunicacao);
  const data = item.datadisponibilizacao || item.data_disponibilizacao;
  if (data) tipoLinha.push(`Disponibilizado em ${data}`);
  if (tipoLinha.length) lines.push(tipoLinha.join(" · "));
  const destino = ownerLabels(owners);
  if (destino) lines.push(`Destinatário: ${destino}`);
  lines.push("");
  if (item.texto) lines.push(item.texto.trim());
  if (item.link) { lines.push(""); lines.push(`Documento: ${item.link}`); }
  return lines.join("\n");
}

function buildDatajudMovement(capa: DatajudCapa): string {
  const lines: string[] = ["[Capa e andamentos — Datajud/CNJ]", ""];
  if (capa.classe) lines.push(`Classe: ${capa.classe}`);
  if (capa.assunto) lines.push(`Assunto: ${capa.assunto}`);
  if (capa.orgaoJulgador) lines.push(`Órgão julgador: ${capa.orgaoJulgador}`);
  if (capa.dataAjuizamento) lines.push(`Ajuizamento: ${capa.dataAjuizamento.substring(0, 10)}`);
  if (capa.movimentos.length) {
    lines.push("");
    lines.push("Últimos andamentos oficiais:");
    for (const m of capa.movimentos.slice(0, 15)) {
      const d = m.data ? m.data.substring(0, 10) : "";
      lines.push(`• ${d} — ${m.nome}`);
    }
  }
  return lines.join("\n");
}

function parseCnjParts(digits: string): { year: number; sequence: number } {
  const sequence = parseInt(digits.substring(0, 7), 10) || 0;
  const year = parseInt(digits.substring(9, 13), 10) || new Date().getFullYear();
  return { year, sequence };
}

// ---- Busca paginada na API -------------------------------------------------
async function fetchAllForOab(oab: MonitoredOab): Promise<DjenItem[]> {
  const itensPorPagina = 200;
  const all: DjenItem[] = [];
  let pagina = 1;
  for (let guard = 0; guard < 25; guard++) {
    const url = new URL(DJEN_URL);
    url.searchParams.set("numeroOab", oab.numero);
    url.searchParams.set("ufOab", oab.uf);
    url.searchParams.set("itensPorPagina", String(itensPorPagina));
    url.searchParams.set("pagina", String(pagina));
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": BROWSER_UA,
      },
    });
    if (!res.ok) throw new Error(`DJEN HTTP ${res.status} (OAB ${oab.numero}/${oab.uf})`);
    const data = await res.json();
    const items: DjenItem[] = data?.items ?? [];
    all.push(...items);
    const count: number = data?.count ?? all.length;
    if (all.length >= count || items.length === 0) break;
    pagina++;
  }
  return all;
}

// ---- Tipos de resultado ----------------------------------------------------
export interface DjenPerOab { oab: string; label: string; total: number; }
export interface DjenPreviewItem {
  number: string; tribunal: string; owner: string;
  action: "movimentar" | "criar";
}
export interface DjenSyncResult {
  dryRun: boolean;
  perOab: DjenPerOab[];
  found: number;
  synced: number;
  created: number;
  skipped: number;
  remaining: number;
  preview: DjenPreviewItem[];
  errors: string[];
}

export interface CollectResult {
  collected: Map<string, DjenItem>;
  perOab: DjenPerOab[];
  errors: string[];
}

export async function collectFromDjenApi(): Promise<CollectResult> {
  const perOab: DjenPerOab[] = [];
  const errors: string[] = [];
  const collected = new Map<string, DjenItem>();
  for (const oab of MONITORED_OABS) {
    try {
      const items = await fetchAllForOab(oab);
      perOab.push({ oab: `${oab.numero}/${oab.uf}`, label: oab.label, total: items.length });
      for (const it of items) {
        const k = dedupKey(it);
        if (!collected.has(k)) collected.set(k, it);
      }
    } catch (err: any) {
      perOab.push({ oab: `${oab.numero}/${oab.uf}`, label: oab.label, total: 0 });
      errors.push(err?.message ?? String(err));
    }
  }
  return { collected, perOab, errors };
}

export type CapaResolver = (cnjDigits: string, sigla?: string) => Promise<DatajudCapa | null>;

// ---- Núcleo da sincronização -----------------------------------------------
export async function syncDjenCore(
  collected: Map<string, DjenItem>,
  perOab: DjenPerOab[],
  baseErrors: string[],
  opts: { dryRun?: boolean; getCapa: CapaResolver; maxPerRun?: number }
): Promise<DjenSyncResult> {
  const dryRun = !!opts.dryRun;
  const runAt = new Date();
  const errors = [...baseErrors];

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("Nenhum usuário ADMIN encontrado no sistema.");

  const processedRow = await prisma.appConfig.findUnique({ where: { key: PROCESSED_KEY } });
  const processedIds = new Set<string>(processedRow?.value ? JSON.parse(processedRow.value) : []);

  const existing = await prisma.process.findMany({
    select: { id: true, number: true, publicacaoOabs: true },
  });
  const byCnj = new Map<string, { id: string; publicacaoOabs: string | null }>();
  for (const p of existing) {
    const key = canonicalCnj(p.number);
    if (key.length === 20) byCnj.set(key, { id: p.id, publicacaoOabs: p.publicacaoOabs });
  }

  const novas: DjenItem[] = [];
  let skipped = 0;
  for (const [k, it] of Array.from(collected.entries())) {
    if (processedIds.has(k)) skipped++;
    else novas.push(it);
  }
  novas.sort((a, b) => {
    const da = a.data_disponibilizacao ?? "";
    const db = b.data_disponibilizacao ?? "";
    return da.localeCompare(db);
  });

  const found = novas.length;
  const batch = novas.slice(0, opts.maxPerRun ?? MAX_PER_RUN);
  const remaining = found - batch.length;

  let synced = 0;
  let created = 0;
  const preview: DjenPreviewItem[] = [];
  const newProcessedIds = Array.from(processedIds);

  interface DryAgg {
    number: string; tribunal: string; owners: Set<string>;
    action: "criar" | "movimentar";
  }
  const dryAgg = new Map<string, DryAgg>();

  for (const it of batch) {
    const cnjDigits = canonicalCnj(it.numero_processo || it.numeroprocessocommascara);
    if (cnjDigits.length !== 20) {
      if (!dryRun) newProcessedIds.push(dedupKey(it));
      continue;
    }
    const owners = ownersOf(it);
    const tribunal = it.siglaTribunal ?? "";
    const numeroMasc = it.numeroprocessocommascara || it.numero_processo || cnjDigits;

    try {
      let target = byCnj.get(cnjDigits);
      const action: "movimentar" | "criar" = target ? "movimentar" : "criar";

      if (dryRun) {
        let agg = dryAgg.get(cnjDigits);
        if (!agg) {
          agg = { number: numeroMasc, tribunal, owners: new Set<string>(), action };
          dryAgg.set(cnjDigits, agg);
        }
        owners.forEach((o) => agg!.owners.add(o));
        synced++;
        continue;
      }

      if (!target) {
        const capa = await opts.getCapa(cnjDigits, tribunal);
        const { year, sequence } = parseCnjParts(cnjDigits);
        const subject =
          capa?.classe || capa?.assunto || it.nomeClasse || it.tipoComunicacao || numeroMasc;
        const parties =
          (it.destinatarios ?? []).map((d) => d.nome).filter(Boolean).join(", ") || null;
        const publicacaoOabs = mergeOabs(null, owners);

        const proc = await prisma.process.create({
          data: {
            number: numeroMasc,
            subject,
            parties,
            type: "JUDICIAL",
            status: "ATIVO",
            year,
            sequence,
            createdById: admin.id,
            syncCreatedAt: runAt,
            publicacaoOabs,
          },
        });
        created++;
        target = { id: proc.id, publicacaoOabs };
        byCnj.set(cnjDigits, target);

        if (capa) {
          await prisma.movement.create({
            data: { processId: proc.id, description: buildDatajudMovement(capa), userId: admin.id },
          });
        }
      } else {
        const merged = mergeOabs(target.publicacaoOabs, owners);
        if (merged !== (target.publicacaoOabs ?? "")) {
          await prisma.process.update({ where: { id: target.id }, data: { publicacaoOabs: merged } });
          target.publicacaoOabs = merged;
        }
      }

      await prisma.movement.create({
        data: { processId: target.id, description: buildMovementDescription(it, owners), userId: admin.id },
      });
      await prisma.process.update({ where: { id: target.id }, data: { lastSyncMovementAt: runAt } });

      newProcessedIds.push(dedupKey(it));
      synced++;
    } catch (err: any) {
      errors.push(`Processo ${numeroMasc}: ${err?.message ?? String(err)}`);
    }
  }

  if (dryRun) {
    for (const a of Array.from(dryAgg.values())) {
      if (a.action === "criar") created++;
      preview.push({
        number: a.number,
        tribunal: a.tribunal,
        owner: ownerLabels(a.owners) || "—",
        action: a.action,
      });
    }
  }

  if (!dryRun) {
    const toStore = newProcessedIds.slice(-5000);
    await prisma.appConfig.upsert({
      where: { key: PROCESSED_KEY },
      update: { value: JSON.stringify(toStore) },
      create: { key: PROCESSED_KEY, value: JSON.stringify(toStore) },
    });
    await prisma.appConfig.upsert({
      where: { key: LAST_SYNC_KEY },
      update: { value: runAt.toISOString() },
      create: { key: LAST_SYNC_KEY, value: runAt.toISOString() },
    });
    const summary = { at: runAt.toISOString(), found, synced, created, skipped, remaining, perOab, errors };
    await prisma.appConfig.upsert({
      where: { key: LAST_RESULT_KEY },
      update: { value: JSON.stringify(summary) },
      create: { key: LAST_RESULT_KEY, value: JSON.stringify(summary) },
    });
  }

  return { dryRun, perOab, found, synced, created, skipped, remaining, preview: preview.slice(0, 100), errors };
}

export async function fetchAndSyncDjen(opts: { dryRun?: boolean } = {}): Promise<DjenSyncResult> {
  const { collected, perOab, errors } = await collectFromDjenApi();
  return syncDjenCore(collected, perOab, errors, { dryRun: opts.dryRun, getCapa: (d, s) => fetchDatajudCapa(d, s) });
}

export async function ingestDjen(
  items: DjenItem[],
  perOab: DjenPerOab[],
  capas: Record<string, DatajudCapa | null> = {}
): Promise<DjenSyncResult> {
  const collected = new Map<string, DjenItem>();
  for (const it of items) {
    const k = dedupKey(it);
    if (!collected.has(k)) collected.set(k, it);
  }
  return syncDjenCore(collected, perOab, [], {
    dryRun: false,
    getCapa: (d, s) => (d in capas ? Promise.resolve(capas[d]) : fetchDatajudCapa(d, s)),
  });
}
