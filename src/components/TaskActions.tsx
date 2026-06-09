"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  taskId: string;
  status: string;
  isAdmin: boolean;
  canManage: boolean;
  canClaim: boolean;
}

export default function TaskActions({ taskId, status, isAdmin, canManage, canClaim }: Props) {
  const router = useRouter();
  const [showMovement, setShowMovement] = useState(false);
  const [desc, setDesc] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const arr = Array.from(selected);
    const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const invalid = arr.find((f) => {
      const name = f.name.toLowerCase();
      return f.type !== "application/pdf" && f.type !== DOCX_MIME && !name.endsWith(".pdf") && !name.endsWith(".docx");
    });
    if (invalid) { setError(`O arquivo "${invalid.name}" não é um PDF nem um Word (.docx).`); return; }
    setError("");
    setFiles((prev) => [...prev, ...arr]);
  }

  async function addMovement() {
    if (!desc.trim()) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("description", desc);
    if (notifyEmail.trim()) fd.append("notifyEmail", notifyEmail.trim());
    files.forEach((f) => fd.append("files", f));
    const res = await fetch(`/api/tarefas/${taskId}/movimentacoes`, { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setDesc(""); setNotifyEmail(""); setFiles([]); setShowMovement(false);
    router.refresh();
  }

  async function updateStatus(newStatus: string) {
    await fetch(`/api/tarefas/${taskId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  async function claim() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/tarefas/${taskId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claim: true }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    router.refresh();
  }

  async function deleteTask() {
    if (!confirm("Excluir esta tarefa? Esta ação não pode ser desfeita.")) return;
    await fetch(`/api/tarefas/${taskId}`, { method: "DELETE" });
    router.push("/dashboard/caixa-entrada");
    router.refresh();
  }

  const isDone = status === "CONCLUIDA";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canClaim && (
          <button onClick={claim} disabled={loading} className="flex items-center gap-1.5 bg-gold-100 hover:bg-gold-200 text-gold-800 border border-gold-200 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Reivindicar esta tarefa
          </button>
        )}

        {canManage && (
          <button
            onClick={() => setShowMovement(!showMovement)}
            className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registrar Movimentação
          </button>
        )}

        {canManage && !isDone && status === "PENDENTE" && (
          <button onClick={() => updateStatus("EM_ANDAMENTO")} className="bg-navy-50 hover:bg-navy-100 text-navy-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            Iniciar
          </button>
        )}
        {canManage && !isDone && (
          <button onClick={() => updateStatus("CONCLUIDA")} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            Concluir
          </button>
        )}
        {canManage && isDone && (
          <button onClick={() => updateStatus("EM_ANDAMENTO")} className="border border-stone-300 bg-white hover:bg-stone-50 text-navy-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            Reabrir
          </button>
        )}
        {isAdmin && (
          <button onClick={deleteTask} className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showMovement && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 space-y-3">
          <div>
            <label className="field-label">Descrição da Movimentação</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="input resize-none" placeholder="Descreva o andamento da tarefa..." />
          </div>
          <div>
            <label className="field-label">Anexar documentos (PDF ou Word)</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-lg px-4 py-3 text-sm text-stone-500 cursor-pointer hover:border-gold-400 hover:text-gold-700 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Clique para selecionar arquivos (PDF ou Word)
              <input type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2 text-stone-700 truncate">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate">{f.name}</span>
                      <span className="text-stone-400 text-xs flex-shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-600 flex-shrink-0 ml-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="field-label">E-mail para envio dos documentos <span className="text-stone-400 font-normal">(opcional)</span></label>
            <input type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} className="input" placeholder="destinatario@email.com" />
            <p className="text-xs text-stone-400 mt-1">O responsável e quem delegou a tarefa são avisados a cada movimentação. Informe um e-mail extra se quiser.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={addMovement} disabled={loading || !desc.trim()} className="bg-navy-700 hover:bg-navy-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60">
              {loading ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setShowMovement(false); setFiles([]); setNotifyEmail(""); }} className="bg-white border border-stone-300 text-navy-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
