// Datajud — enriquecimento de processos pela API Pública do CNJ.
// Dado um número CNJ, busca a capa estruturada (classe, assunto, órgão julgador)
// e o histórico oficial de movimentos. É BEST-EFFORT: qualquer falha retorna null
// e a sincronização DJEN segue normalmente.

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";

// Chave pública do Datajud (publicada na wiki do CNJ). Pode ser sobrescrita por env.
const DEFAULT_API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

function apiKey(): string {
  return process.env.DATAJUD_API_KEY || DEFAULT_API_KEY;
}

// Códigos de tribunal estadual (segmento J=8) -> UF, conforme tabela CNJ.
const TJ_TT_TO_UF: Record<string, string> = {
  "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce",
  "07": "df", "08": "es", "09": "go", "10": "ma", "11": "mt", "12": "ms",
  "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi",
  "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc",
  "25": "se", "26": "sp", "27": "to",
};

// Deriva o alias do índice Datajud a partir dos dígitos do CNJ.
// CNJ: NNNNNNN DD AAAA J TT OOOO  -> usamos J (segmento) e TT (tribunal).
export function cnjToDatajudAlias(cnjDigits: string): string | null {
  const digits = cnjDigits.replace(/\D/g, "");
  if (digits.length !== 20) return null;
  const j = digits.substring(13, 14); // segmento do judiciário
  const tt = digits.substring(14, 16); // tribunal dentro do segmento
  const ttNum = parseInt(tt, 10);

  switch (j) {
    case "8": {
      // Justiça Estadual
      const uf = TJ_TT_TO_UF[tt];
      return uf ? `api_publica_tj${uf}` : null;
    }
    case "5": // Justiça do Trabalho -> TRT da região
      return ttNum >= 1 ? `api_publica_trt${ttNum}` : null;
    case "4": // Justiça Federal -> TRF da região
      return ttNum >= 1 ? `api_publica_trf${ttNum}` : null;
    case "3": // Tribunais Superiores
      return tt === "00" ? "api_publica_stj" : null;
    case "6": // Justiça Eleitoral
      return tt === "00" ? "api_publica_tse" : `api_publica_tre${uf2(tt)}`;
    case "7": // Justiça Militar da União
      return "api_publica_stm";
    case "9": // Justiça Militar Estadual
      return ttNum >= 1 ? `api_publica_tjm${ttNum}` : null;
    default:
      return null;
  }
}

function uf2(tt: string): string {
  return TJ_TT_TO_UF[tt] ?? "";
}

export interface DatajudMovimento {
  data: string; // ISO
  nome: string;
}

export interface DatajudCapa {
  classe?: string;
  assunto?: string;
  orgaoJulgador?: string;
  dataAjuizamento?: string;
  movimentos: DatajudMovimento[];
}

// Consulta o Datajud por número CNJ (com ou sem máscara) e devolve a capa.
// Retorna null em qualquer falha (índice inexistente, processo não encontrado, rede).
export async function fetchDatajudCapa(
  cnj: string,
  siglaTribunal?: string
): Promise<DatajudCapa | null> {
  const digits = cnj.replace(/\D/g, "");
  if (digits.length !== 20) return null;

  let alias = cnjToDatajudAlias(digits);
  // Fallback pela sigla quando o CNJ não mapeia (raro).
  if (!alias && siglaTribunal) {
    const s = siglaTribunal.toLowerCase();
    if (/^tj[a-z]{2}$/.test(s) || /^tr[tf]\d+$/.test(s) || s === "stj" || s === "tst") {
      alias = `api_publica_${s}`;
    }
  }
  if (!alias) return null;

  try {
    const res = await fetch(`${DATAJUD_BASE}/${alias}/_search`, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${apiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: digits } },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.hits?.hits?.[0]?._source;
    if (!hit) return null;

    const movimentos: DatajudMovimento[] = Array.isArray(hit.movimentos)
      ? hit.movimentos
          .map((m: any) => ({
            data: m?.dataHora ?? "",
            nome: m?.nome ?? "",
          }))
          .filter((m: DatajudMovimento) => m.nome)
          .sort(
            (a: DatajudMovimento, b: DatajudMovimento) =>
              new Date(b.data).getTime() - new Date(a.data).getTime()
          )
      : [];

    const assuntos = Array.isArray(hit.assuntos) ? hit.assuntos : [];
    return {
      classe: hit.classe?.nome,
      assunto: assuntos[0]?.nome,
      orgaoJulgador: hit.orgaoJulgador?.nome,
      dataAjuizamento: hit.dataAjuizamento,
      movimentos,
    };
  } catch {
    return null;
  }
}
