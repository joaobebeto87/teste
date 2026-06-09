import { promises as fs } from "fs";
import path from "path";
import { format } from "date-fns";

/**
 * Resolve o caminho físico do arquivo SQLite a partir do DATABASE_URL.
 * Aceita "file:/data/gestao.db" (absoluto, produção) e "file:./dev.db"
 * (relativo ao diretório prisma/, desenvolvimento).
 */
export function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const raw = url.replace(/^file:/, "");
  // Absoluto: começa com / (Linux) ou tem letra de drive (C:\) no Windows
  const isAbsolute = raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw);
  if (isAbsolute) return raw;
  // Relativo: o Prisma resolve a partir do diretório do schema (prisma/)
  return path.resolve(process.cwd(), "prisma", raw);
}

/** Diretório onde os backups são guardados (ao lado do banco por padrão). */
export function backupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  return path.join(path.dirname(resolveDbPath()), "backups");
}

/** Quantidade de backups mantidos antes de podar os mais antigos. */
function retention(): number {
  const n = Number(process.env.BACKUP_RETENTION);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

const PREFIX = "gestao-";
const SUFFIX = ".db";

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: Date;
}

/** Lista os backups existentes, do mais recente para o mais antigo. */
export async function listBackups(): Promise<BackupFile[]> {
  const dir = backupDir();
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const files = names.filter((n) => n.startsWith(PREFIX) && n.endsWith(SUFFIX));
  const result: BackupFile[] = [];
  for (const name of files) {
    try {
      const stat = await fs.stat(path.join(dir, name));
      result.push({ filename: name, size: stat.size, createdAt: stat.mtime });
    } catch {
      /* ignora arquivos que sumiram entre o readdir e o stat */
    }
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Cria um novo backup copiando o arquivo SQLite com um carimbo de data/hora,
 * depois remove os backups que excedem a janela de retenção.
 */
export async function createBackup(): Promise<BackupFile> {
  const dbPath = resolveDbPath();
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });

  const stamp = format(new Date(), "yyyy-MM-dd-HHmmss");
  const filename = `${PREFIX}${stamp}${SUFFIX}`;
  const dest = path.join(dir, filename);

  await fs.copyFile(dbPath, dest);
  const stat = await fs.stat(dest);

  await pruneOldBackups();

  return { filename, size: stat.size, createdAt: stat.mtime };
}

/** Remove os backups além da janela de retenção (mantém os N mais recentes). */
async function pruneOldBackups(): Promise<void> {
  const all = await listBackups();
  const toDelete = all.slice(retention());
  await Promise.all(
    toDelete.map((b) => fs.unlink(path.join(backupDir(), b.filename)).catch(() => {}))
  );
}

/**
 * Valida um nome de arquivo de backup e retorna seu caminho absoluto.
 * Protege contra path traversal — só aceita nomes no padrão esperado.
 */
export function resolveBackupFile(name: string): string | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) return null;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return path.join(backupDir(), name);
}

export function retentionCount(): number {
  return retention();
}
