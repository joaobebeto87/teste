"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Hearing = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  location: string | null;
  dateTime: string;
  googleEventId: string | null;
  createdById: string;
  createdBy: { name: string };
};

interface Props {
  processId: string;
  canAdd: boolean;
  hearings: Hearing[];
  currentUserId: string;
  isAdmin: boolean;
}

const TYPE_OPTIONS = [
  { value: "AUDIENCIA", label: "Audiência" },
  { value: "REUNIAO", label: "Reunião" },
  { value: "PRAZO", label: "Prazo" },
  { value: "DILIGENCIA", label: "Diligência" },
  { value: "OUTRO", label: "Outro" },
];

const TYPE_COLORS: Record<string, string> = {
  AUDIENCIA: "bg-navy-100 text-navy-700",
  REUNIAO: "bg-gold-100 text-gold-700",
  PRAZO: "bg-red-100 text-red-700",
  DILIGENCIA: "bg-amber-100 text-amber-700",
  OUTRO: "bg-stone-100 text-stone-600",
};

const TYPE_LABELS: Record<string, string> = {
  AUDIENCIA: "Audiência",
  REUNIAO: "Reunião",
  PRAZO: "Prazo",
  DILIGENCIA: "Diligência",
  OUTRO: "Outro",
};

export default function HearingActions({ processId, canAdd, hearings, currentUserId, isAdmin }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("AUDIENCIA");
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSubmit() {
    if (!title.trim() || !dateTime) return;
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const res = await fetch(`/api/processos/${processId}/audiencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, dateTime, location, description }),
    });
    setLoading(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao salvar.");
      return;
    }

    const data = await res.json();
    setSuccessMsg(
      data.googleEventCreated
        ? "Compromisso agendado! Evento criado no Google Agenda com lembretes."
        : "Compromisso agendado! (Google Agenda não configurado — sem evento criado)"
    );
    setTitle("");
    setDateTime("");
    setLocation("");
    setDescription("");
    setType("AUDIENCIA");
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(hearing: Hearing) {
    const hasGoogle = Boolean(hearing.googleEventId);
    const msg = hasGoogle
      ? "Apagar este compromisso? O evento correspondente no Google Agenda também será removido."
      : "Apagar este compromisso?";
    if (!confirm(msg)) return;

    setDeletingId(hearing.id);
    setError("");
    const res = await fetch(`/api/processos/${processId}/audiencias/${hearing.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Erro ao apagar compromisso.");
      return;
    }

    router.refresh();
  }

  const now = new Date();
  const upcoming = hearings.filter((h) => new Date(h.dateTime) >= now);
  const past = hearings.filter((h) => new Date(h.dateTime) < now);

  return (
    <div className="space-y-4">
      {canAdd && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowForm(!showForm); setError(""); setSuccessMsg(""); }}
            className="flex items-center gap-1.5 bg-navy-700 hover:bg-navy-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Agendar Audiência / Compromisso
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
      )}

      {showForm && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-navy-800">Novo Compromisso</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full input"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Data e Hora</label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Título / Descrição breve</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full input"
              placeholder="Ex: Audiência de instrução — Vara Cível"
            />
          </div>

          <div>
            <label className="field-label">Local <span className="text-stone-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full input"
              placeholder="Ex: Fórum Municipal, Sala 3"
            />
          </div>

          <div>
            <label className="field-label">Observações <span className="text-stone-400 font-normal">(opcional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Informações adicionais sobre o compromisso..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={loading || !title.trim() || !dateTime}
              className="bg-navy-700 hover:bg-navy-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-60"
            >
              {loading ? "Agendando..." : "Agendar"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="bg-white border border-stone-300 text-navy-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-stone-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {hearings.length === 0 ? (
        <p className="text-stone-400 text-sm text-center py-6">Nenhum compromisso agendado.</p>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Próximos</p>
              {upcoming.map((h) => (
                <HearingCard
                  key={h.id}
                  hearing={h}
                  canDelete={isAdmin || h.createdById === currentUserId}
                  deleting={deletingId === h.id}
                  onDelete={() => handleDelete(h)}
                />
              ))}
            </>
          )}
          {past.length > 0 && (
            <>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mt-2">Realizados</p>
              {past.map((h) => (
                <HearingCard
                  key={h.id}
                  hearing={h}
                  past
                  canDelete={isAdmin || h.createdById === currentUserId}
                  deleting={deletingId === h.id}
                  onDelete={() => handleDelete(h)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HearingCard({
  hearing,
  past,
  canDelete,
  deleting,
  onDelete,
}: {
  hearing: Hearing;
  past?: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${past ? "border-stone-100 bg-stone-50/50 opacity-70" : "border-navy-100 bg-white"}`}>
      <div className="flex-shrink-0 mt-0.5">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${TYPE_COLORS[hearing.type] ?? "bg-stone-100 text-stone-600"}`}>
          {hearing.type === "AUDIENCIA" ? "A" :
           hearing.type === "REUNIAO" ? "R" :
           hearing.type === "PRAZO" ? "P" :
           hearing.type === "DILIGENCIA" ? "D" : "O"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[hearing.type] ?? "bg-stone-100 text-stone-600"}`}>
              {TYPE_LABELS[hearing.type] ?? hearing.type}
            </span>
            <p className="text-sm font-semibold text-navy-800 mt-1">{hearing.title}</p>
          </div>
          <div className="flex items-start gap-2 flex-shrink-0">
            <div className="text-right">
              <p className={`text-sm font-bold tabular-nums ${past ? "text-stone-400" : "text-navy-700"}`}>
                {format(new Date(hearing.dateTime), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              <p className="text-xs text-stone-400">
                {format(new Date(hearing.dateTime), "HH:mm", { locale: ptBR })}
              </p>
            </div>
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={deleting}
                title="Apagar compromisso"
                className="mt-0.5 p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
              >
                {deleting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        {hearing.location && (
          <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {hearing.location}
          </p>
        )}
        {hearing.description && (
          <p className="text-xs text-stone-500 mt-1">{hearing.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-xs text-stone-400">por {hearing.createdBy.name}</p>
          {hearing.googleEventId && (
            <span className="text-xs text-emerald-600 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Google Agenda
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
