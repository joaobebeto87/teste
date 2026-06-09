"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; }

interface Props {
  processId: string;
  processNumber: string;
  users: User[];
}

export default function ProcessTaskDelegate({ processId, processNumber, users }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

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

  function resetForm() {
    setTitle(""); setDescription(""); setAssignedToId(""); setDeadline(""); setFiles([]); setError("");
  }

  async function createTask() {
    if (!title || !deadline) {
      setError("Título e prazo são obrigatórios.");
      return;
    }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("assignedToId", assignedToId); // vazio = disponível para reivindicar
    fd.append("processId", processId);
    fd.append("deadline", deadline);
    files.forEach((f) => fd.append("files", f));
    const res = await fetch("/api/tarefas", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    resetForm();
    setShowForm(false);
    router.refresh();
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Delegar Tarefa
      </button>
    );
  }

  return (
    <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-4">
      <p className="text-sm text-stone-500">
        Tarefa vinculada ao <span className="font-medium text-navy-700">Processo {processNumber}</span>
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="field-label">Título da Tarefa <span className="text-red-500">*</span></label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full input" placeholder="O que precisa ser feito..." autoFocus />
        </div>
        <div>
          <label className="field-label">Responsável <span className="text-stone-400 font-normal">(opcional)</span></label>
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full input">
            <option value="">Sem responsável — disponível para reivindicar</option>
            {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
          </select>
        </div>
        <div>
          <label className="field-label">Prazo <span className="text-red-500">*</span></label>
          <input type="date" value={deadline} min={today} onChange={(e) => setDeadline(e.target.value)} className="w-full input" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Descrição</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full input resize-none" placeholder="Detalhes da tarefa (opcional)..." />
        </div>
        <div className="col-span-2">
          <label className="field-label">Anexar documentos (PDF ou Word) <span className="text-stone-400 font-normal">(opcional)</span></label>
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
      </div>

      {error && (<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>)}

      <div className="flex gap-3">
        <button onClick={createTask} disabled={loading} className="btn-primary">{loading ? "Enviando..." : "Delegar Tarefa"}</button>
        <button onClick={() => { resetForm(); setShowForm(false); }} className="btn-ghost">Cancelar</button>
      </div>
    </div>
  );
}
