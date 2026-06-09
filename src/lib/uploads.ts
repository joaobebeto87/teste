import { unlink } from "fs/promises";
import path from "path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

/**
 * Remove arquivos físicos da pasta uploads/ a partir dos nomes armazenados.
 * Best-effort: ignora arquivos que já não existam.
 */
export async function deleteUploadFiles(storedNames: string[]) {
  await Promise.all(
    storedNames.map((name) => unlink(path.join(UPLOAD_DIR, name)).catch(() => {}))
  );
}
