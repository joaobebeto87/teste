"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { getDeadlineStatus, deadlineRowClass, deadlineCellClass, deadlineBadgeClass, deadlineBadgeText, statusBadgeClass, statusLabel } from "@/lib/utils";

interface User { id: string; name: string; }
interface ProcessOption { id: string; number: string; subject: string; }
interface Task {
  id: string;
  title: string;
  description: string | null;
  clientName: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  assignedBy: { name: string };
  process: { id: string; number: string } | null;
  deadline: string;
  status: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  tasks: Task[];
  users: User[];
  processes: ProcessOption[];
  isStaff: boolean;     // ADMIN ou SOCIO — vê todas as tarefas e pode delegar
  currentUserId: string;
  initialAssignee?: string;
}

export default function InboxClient({ tasks, users, processes, isStaff, currentUserId, initialAssignee = "" }: Props) {
  const router = useRouter();
  const [filterAssignee, setFilterAssignee] = useState(initialAssignee);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [processId, setProcessId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editAssignedToId, setEditAssignedToId] = useState("");
  const [editProcessId, setEditProcessId] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const visibleTasks = filterAssignee ? tasks.filter((t) => t.assignedTo?.id === filterAssignee) : tasks;
  const filterName = users.find((u) => u.id === filterAssignee)?.name;

  function changeFilter(id: string) {
    setFilterAssignee(id);
    router.replace(id ? `/dashboard/consultivo?assignee=${id}` : "/dashboard/consultivo");
  }

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
    if (invalid) { setError(`O arquivo "${invalid.name}" não é um PDF, Word ou JPEG.`); return; }
    setError("");
    setFiles((prev) => [...prev, ...arr]);
  }

  async function createTask() {
    if (!title || !deadline) { setError("Título e prazo são obrigatórios."); return; }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("clientName", clientName);
    fd.append("assignedToId", assignedToId);
    fd.append("processId", processId);
    fd.append("deadline", deadline);
    files.forEach((f) => fd.append("files", f));
    const res = await fetch("/api/tarefas", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setTitle(""); setDescription(""); setClientName(""); setAssignedToId(""); setProcessId(""); setDeadline(""); setFiles([]);
    setShowForm(false);
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/tarefas/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function claimTask(id: string) {
    const res = await fetch(`/api/tarefas/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claim: true }),
    });
    if (!res.ok) { alert((await res.json()).error); return; }
    router.refresh();
  }

  async function deleteTask(id: string) {
    if (!confirm("Excluir esta tarefa?")) return;
    await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditClientName(task.clientName ?? "");
    setEditDeadline(task.deadline.split("T")[0]);
    setEditAssignedToId(task.assignedTo?.id ?? "");
    setEditProcessId(task.process?.id ?? "");
    setEditError("");
  }

  async function saveEdit() {
    if (!editingTask || !editTitle || !editDeadline) {
      setEditError("Título e prazo são obrigatórios.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    const res = await fetch(`/api/tarefas/${editingTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        clientName: editClientName,
        deadline: editDeadline,
        assignedToId: editAssignedToId,
        processId: editProcessId,
      }),
    });
    setEditLoading(false);
    if (!res.ok) { setEditError((await res.json()).error); return; }
    setEditingTask(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">{isStaff ? "Demandas do setor" : "Suas demandas"}</p>
          <h1 className="page-title">{isStaff ? "Consultivo" : "Meu Consultivo"}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {visibleTasks.length} tarefa(s)
            {filterAssignee && filterName && (
              <>
                {" · "}
                <span className="font-medium text-navy-700">{filterName}</span>{" "}
                <button onClick={() => changeFilter("")} className="text-gold-700 hover:text-gold-800 hover:underline">
                  (limpar filtro)
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isStaff && (
            <select
              value={filterAssignee}
              onChange={(e) => changeFilter(e.target.value)}
              className="input py-2 text-sm"
              title="Filtrar por responsável"
            >
              <option value="">Todos os responsáveis</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          {isStaff && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Delegar Tarefa
            </button>
          )}
        </div>
      </div>

      {showForm && isStaff && (
        <div className="card p-6 mb-6">
          <h2 className="section-title mb-4">Nova Tarefa Delegada</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="field-label">Título da Tarefa <span className="text-red-500">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full input" placeholder="Título da tarefa..." />
              </div>
              <div>
                <label className="field-label">Cliente</label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full input" placeholder="Nome do cliente..." />
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
              <div>
                <label className="field-label">Processo relacionado <span className="text-stone-400 font-normal">(opcional)</span></label>
                <select value={processId} onChange={(e) => setProcessId(e.target.value)} className="w-full input">
                  <option value="">Nenhum</option>
                  {processes.map((p) => (<option key={p.id} value={p.id}>{p.number} — {p.subject}</option>))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="field-label">Descrição</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full input resize-none" placeholder="Detalhes da tarefa (opcional)..." />
              </div>
              <div className="col-span-2">
                <label className="field-label">Anexar documentos <span className="text-stone-400 font-normal">(PDF, Word ou JPEG)</span></label>
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
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição de tarefa */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="section-title mb-4">Editar Tarefa</h2>
            <div className="space-y-4">
              <div>
                <label className="field-label">Título <span className="text-red-500">*</span></label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="field-label">Cliente</label>
                  <input type="text" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} className="w-full input" placeholder="Nome do cliente..." />
                </div>
                <div>
                  <label className="field-label">Prazo <span className="text-red-500">*</span></label>
                  <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className="w-full input" />
                </div>
                <div>
                  <label className="field-label">Responsável</label>
                  <select value={editAssignedToId} onChange={(e) => setEditAssignedToId(e.target.value)} className="w-full input">
                    <option value="">Disponível para reivindicar</option>
                    {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Processo relacionado</label>
                  <select value={editProcessId} onChange={(e) => setEditProcessId(e.target.value)} className="w-full input">
                    <option value="">Nenhum</option>
                    {processes.map((p) => (<option key={p.id} value={p.id}>{p.number} — {p.subject}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Descrição</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="w-full input resize-none" placeholder="Detalhes da tarefa (opcional)..." />
              </div>
              {editError && (<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{editError}</div>)}
              <div className="flex gap-3 pt-1">
                <button onClick={saveEdit} disabled={editLoading} className="btn-primary">{editLoading ? "Salvando..." : "Salvar"}</button>
                <button onClick={() => setEditingTask(null)} className="btn-ghost">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-3 font-medium">Tarefa</th>
                {isStaff && <th className="px-6 py-3 font-medium">Responsável</th>}
                <th className="px-6 py-3 font-medium">Delegado por</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Prazo</th>
                <th className="px-6 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 6 : 5} className="px-6 py-12 text-center text-stone-400">
                    {filterAssignee ? "Nenhuma tarefa para este responsável." : "Nenhuma tarefa consultiva."}
                  </td>
                </tr>
              )}
              {visibleTasks.map((task, i) => {
                const dlStatus = getDeadlineStatus(new Date(task.deadline));
                const isDone = task.status === "CONCLUIDA";
                const isUnassigned = !task.assignedTo;
                const canManage = isStaff || task.assignedTo?.id === currentUserId;
                const zebraClass = (isDone || dlStatus !== "expired") ? (i % 2 === 0 ? "bg-white" : "bg-[#f7f5ef]") : "";
                return (
                  <tr key={task.id} className={`border-b border-stone-100 hover:bg-stone-100 transition ${isDone ? "" : deadlineRowClass(dlStatus)} ${zebraClass}`}>
                    <td className={`px-6 py-3 ${isDone ? "text-stone-400" : deadlineCellClass(dlStatus)}`}>
                      <Link href={`/dashboard/consultivo/${task.id}`} className={`font-medium hover:text-gold-700 hover:underline ${isDone ? "line-through" : ""}`}>
                        {task.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {task.clientName && (
                          <span className="text-[0.7rem] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full">{task.clientName}</span>
                        )}
                        {isUnassigned && !isDone && (
                          <span className="text-[0.7rem] font-medium uppercase tracking-wide bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full">Disponível</span>
                        )}
                        {task.process && (
                          <Link href={`/dashboard/processos/${task.process.id}`} className="text-xs text-navy-600 hover:text-gold-700 hover:underline inline-flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Proc. {task.process.number}
                          </Link>
                        )}
                      </div>
                      {task.description && (<p className="text-xs text-stone-400 mt-0.5 truncate max-w-xs">{task.description}</p>)}
                    </td>
                    {isStaff && (
                      <td className="px-6 py-3 text-stone-600">
                        {task.assignedTo ? task.assignedTo.name : <span className="text-gold-700">Disponível</span>}
                      </td>
                    )}
                    <td className="px-6 py-3 text-stone-600">{task.assignedBy.name}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(task.status)}`}>{statusLabel(task.status)}</span>
                    </td>
                    <td className="px-6 py-3">
                      {!isDone ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${deadlineBadgeClass(dlStatus)}`}>
                          {format(new Date(task.deadline), "dd/MM/yyyy")}
                          <span className="opacity-70">· {deadlineBadgeText(dlStatus, new Date(task.deadline))}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">{format(new Date(task.deadline), "dd/MM/yyyy")}</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/consultivo/${task.id}`} className="text-xs font-medium text-gold-700 hover:text-gold-800 transition">Abrir →</Link>
                        {isUnassigned && !isDone && !isStaff && (
                          <button onClick={() => claimTask(task.id)} className="text-xs bg-gold-100 hover:bg-gold-200 text-gold-800 px-2.5 py-1 rounded-lg transition font-medium">
                            Reivindicar
                          </button>
                        )}
                        {!isDone && canManage && !isUnassigned && (
                          <>
                            {task.status === "PENDENTE" && (
                              <button onClick={() => updateStatus(task.id, "EM_ANDAMENTO")} className="text-xs bg-navy-50 hover:bg-navy-100 text-navy-700 px-2.5 py-1 rounded-lg transition">Iniciar</button>
                            )}
                            <button onClick={() => updateStatus(task.id, "CONCLUIDA")} className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg transition">Concluir</button>
                          </>
                        )}
                        {isStaff && (
                          <>
                            <button onClick={() => openEdit(task)} className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-lg transition">Editar</button>
                            <button onClick={() => deleteTask(task.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1 rounded-lg transition">Excluir</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
