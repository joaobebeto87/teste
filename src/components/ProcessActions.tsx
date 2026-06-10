"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  processId: string;
  isAdmin: boolean;
  canEdit: boolean;
  canEditMarker: boolean;
  processType: string;
  isJudicial: boolean;
  currentStatus: string;
  currentDeadline: string | null;
  currentClient: string | null;
  currentClientName: string | null;
  currentParties: string | null;
  currentSubject: string;
  currentDescription: string;
}

export default function ProcessActions({ processId, isAdmin, canEdit, canEditMarker, processType, isJudicial, currentStatus, currentDeadline, currentClient, currentClientName, currentParties, currentSubject, currentDescription }: Props) {
  const router = useRouter();
  const [showMovement, setShowMovement] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMarker, setShowMarker] = useState(false);
  const [movDesc, setMovDesc] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [markerLoading, setMarkerLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [deadline, setDeadline] = useState(currentDeadline);
  const [client, setClient] = useState(currentClient ?? "");
  const [clientName, setClientName] = useState(currentClientName ?? "");
  const [parties, setParties] = useState(currentParties ?? "");
  const [subject, setSubject] = useState(currentSubject);
  const [description, setDescription] = useState(currentDescription);
  const [error, setError] = useState("");

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const arr = Array.from(selected);
    const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const invalid = arr.find((f) => {
      const name = f.name.toLowerCase();
      return (
        f.type !== "application/pdf" &&
        f.type !== DOCX_MIME &&
        f.type !== "image/jpeg" &&
        !name.endsWith(".pdf") &&
        !name.endsWith(".docx") &&
        !name.endsWith(".jpg") &&
        !name.endsWith(".jpeg")
      );
    });
    if (invalid) {
      setError(`O arquivo "${invalid.name}" não é um PDF, Word ou JPEG.`);
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function addMovement() {
    if (!movDesc.trim()) return;
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("description", movDesc);
    if (notifyEmail.trim()) fd.append("notifyEmail", notifyEmail.trim());
    files.forEach((f) => fd.append("files", f));

    const res = await fetch(`/api/processos/${processId}/movimentacoes`, {
      method: "POST",
      body: fd,
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error);
      return;
    }
    setMovDesc("");
    setNotifyEmail("");
    setFiles([]);
    setShowMovement(false);
    router.refresh();
  }

  async function updateProcess() {
    if (!subject.trim()) { setError("O assunto não pode ser vazio."); return; }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/processos/${processId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: subject.trim(),
        description: description.trim() || null,
        clientName: clientName.trim() || null,
        deadline: deadline || null,
        ...(isAdmin && { status }),
        ...(isJudicial && { parties: parties || null }),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error);
      return;
    }
    setShowEdit(false);
    router.refresh();
  }

  async function saveMarker() {
    setMarkerLoading(true);
    setError("");
    const res = await fetch(`/api/processos/${processId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client: client || null }),
    });
    setMarkerLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error);
      return;
    }
    setShowMarker(false);
    router.refresh();
  }

  async function changeStatus(newStatus: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/processos/${processId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    const listHref = isJudicial ? "/dashboard/processos-judiciais" : "/dashboard/processos";
    router.push(newStatus === "ARQUIVADO" ? "/dashboard/arquivados" : listHref);
    router.refresh();
  }

  async function deleteProcess() {
    if (!confirm("Excluir este processo? Esta ação não pode ser desfeita.")) return;
    await fetch(`/api/processos/${processId}`, { method: "DELETE" });
    router.push(isJudicial ? "/dashboard/processos-judiciais" : "/dashboard/processos");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setShowMovement(!showMovement); setShowEdit(false); setShowMarker(false); }}
          className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Movimentação
        </button>

        {canEditMarker && (
          <button
            onClick={() => { setShowMarker(!showMarker); setShowEdit(false); setShowMovement(false); }}
            className="flex items-center gap-1.5 border border-stone-300 bg-white hover:bg-stone-50 text-navy-700 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {client === "ESCRITORIO" && <span className="w-2.5 h-2.5 rounded-full bg-navy-700 flex-shrink-0"></span>}
            {client === "PREFEITURA" && <span className="w-2.5 h-2.5 rounded-full bg-sky-400 flex-shrink-0"></span>}
            {!client && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            )}
            Marcador
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => { setShowEdit(!showEdit); setShowMovement(false); setShowMarker(false); }}
            className="flex items-center gap-1.5 border border-stone-300 bg-white hover:bg-stone-50 text-navy-700 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
        )}

        {isAdmin && (
          <>
            {currentStatus === "ARQUIVADO" ? (
              <button
                onClick={() => changeStatus("ATIVO")}
                disabled={loading}
                className="flex items-center gap-1.5 border border-stone-300 bg-white hover:bg-stone-50 text-navy-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Desarquivar
              </button>
            ) : (
              <button
                onClick={() => changeStatus("ARQUIVADO")}
                disabled={loading}
                className="flex items-center gap-1.5 border border-gold-200 bg-gold-50 hover:bg-gold-100 text-gold-700 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Arquivar
              </button>
            )}
            <button
              onClick={deleteProcess}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Excluir
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
      )}

      {showMovement && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 space-y-3">
          <div>
            <label className="field-label">Descrição da Movimentação</label>
            <textarea
              value={movDesc}
              onChange={(e) => setMovDesc(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Descreva a movimentação do processo..."
            />
          </div>

          <div>
            <label className="field-label">Anexar documentos (PDF, Word ou JPEG)</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-stone-300 rounded-lg px-4 py-3 text-sm text-stone-500 cursor-pointer hover:border-gold-400 hover:text-gold-700 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Clique para selecionar arquivos
              <input
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/jpeg,.jpg,.jpeg"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              />
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
                    <button onClick={() => removeFile(i)} className="text-stone-400 hover:text-red-600 flex-shrink-0 ml-2">
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
            <label className="field-label">
              E-mail para envio dos documentos
              <span className="text-stone-400 font-normal"> (opcional)</span>
            </label>
            <input
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              className="w-full input"
              placeholder="destinatario@email.com"
            />
            <p className="text-xs text-stone-400 mt-1">
              Os PDFs anexados serão enviados a este endereço. Os demais usuários recebem aviso da movimentação.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={addMovement}
              disabled={loading || !movDesc.trim()}
              className="bg-navy-700 hover:bg-navy-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => { setShowMovement(false); setFiles([]); setNotifyEmail(""); }}
              className="bg-white border border-stone-300 text-navy-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showEdit && canEdit && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 space-y-4">
          <div>
            <label className="field-label">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full input"
            />
          </div>
          <div>
            <label className="field-label">
              Cliente
              <span className="text-stone-400 font-normal"> (padrão = réu)</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full input"
              placeholder="Nome do cliente identificado..."
            />
          </div>
          <div>
            <label className="field-label">
              Descrição
              <span className="text-stone-400 font-normal"> (opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input resize-none"
            />
          </div>
          {isJudicial && (
            <div>
              <label className="field-label">Partes</label>
              <input
                type="text"
                value={parties}
                onChange={(e) => setParties(e.target.value)}
                className="w-full input"
                placeholder="Ex.: João da Silva x Município de ..."
              />
            </div>
          )}
          <div className={`grid gap-4 ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
            {isAdmin && (
              <div>
                <label className="field-label">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full input"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="ARQUIVADO">Arquivado</option>
                </select>
              </div>
            )}
            <div>
              <label className="field-label">Prazo Fatal</label>
              <input
                type="date"
                value={deadline ?? ""}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={updateProcess}
              disabled={loading}
              className="bg-navy-700 hover:bg-navy-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
            <button
              onClick={() => setShowEdit(false)}
              className="bg-white border border-stone-300 text-navy-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showMarker && canEditMarker && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-navy-800">Marcador do processo</h3>
          <div className="flex gap-3 flex-wrap">
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${client === "ESCRITORIO" ? "border-navy-700 bg-navy-50" : "border-stone-200 hover:border-stone-300 bg-white"}`}>
              <input type="radio" name="marker-client" value="ESCRITORIO" checked={client === "ESCRITORIO"} onChange={(e) => setClient(e.target.value)} className="sr-only" />
              <span className="w-3 h-3 rounded-full bg-navy-700 flex-shrink-0"></span>
              <span className="text-sm font-medium text-navy-800">Escritório</span>
            </label>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${client === "PREFEITURA" ? "border-sky-400 bg-sky-50" : "border-stone-200 hover:border-stone-300 bg-white"}`}>
              <input type="radio" name="marker-client" value="PREFEITURA" checked={client === "PREFEITURA"} onChange={(e) => setClient(e.target.value)} className="sr-only" />
              <span className="w-3 h-3 rounded-full bg-sky-400 flex-shrink-0"></span>
              <span className="text-sm font-medium text-sky-700">Prefeitura</span>
            </label>
            {client && (
              <button type="button" onClick={() => setClient("")} className="text-xs text-stone-400 hover:text-stone-600 transition px-2">
                Sem marcador
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveMarker}
              disabled={markerLoading}
              className="bg-navy-700 hover:bg-navy-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60"
            >
              {markerLoading ? "Salvando..." : "Salvar Marcador"}
            </button>
            <button
              onClick={() => setShowMarker(false)}
              className="bg-white border border-stone-300 text-navy-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
