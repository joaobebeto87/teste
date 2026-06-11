"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function NovoProcessoJudicialForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultClient = searchParams.get("defaultClient") || "";

  const [number, setNumber] = useState("");
  const [parties, setParties] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [client, setClient] = useState(defaultClient);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const backHref = defaultClient
    ? `/dashboard/processos-judiciais?client=${defaultClient}`
    : "/dashboard/processos-judiciais";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/processos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "JUDICIAL", number, parties, subject, description, deadline, client: client || null }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar processo");
      return;
    }
    const process = await res.json();
    router.push(`/dashboard/processos/${process.id}`);
    router.refresh();
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-stone-400 transition hover:text-navy-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="eyebrow mb-0.5">Nível 2</p>
          <h1 className="page-title">Novo Processo Judicial</h1>
        </div>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="field-label">
              Número do Processo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              className="input font-mono"
              placeholder="Ex.: 0000000-00.0000.0.00.0000"
            />
            <p className="text-xs text-stone-400 mt-1">Informe o número oficial do processo judicial.</p>
          </div>

          <div>
            <label className="field-label">Partes</label>
            <input
              type="text"
              value={parties}
              onChange={(e) => setParties(e.target.value)}
              className="input"
              placeholder="Ex.: João da Silva x Município de ..."
            />
            <p className="text-xs text-stone-400 mt-1">Partes envolvidas no processo (autor, réu, etc.).</p>
          </div>

          <div>
            <label className="field-label">
              Assunto / Do que se trata <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="input"
              placeholder="Descreva o assunto do processo..."
            />
          </div>

          <div>
            <label className="field-label">Descrição / Observações</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input resize-none"
              placeholder="Informações adicionais sobre o processo (opcional)..."
            />
          </div>

          <div>
            <label className="field-label">Marcador</label>
            <div className="flex gap-3">
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${client === "CIVEL" ? "border-blue-500 bg-blue-50" : "border-stone-200 hover:border-stone-300"}`}>
                <input type="radio" name="client" value="CIVEL" checked={client === "CIVEL"} onChange={(e) => setClient(e.target.value)} className="sr-only" />
                <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></span>
                <span className="text-sm font-medium text-blue-700">Cível</span>
              </label>
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${client === "TRABALHISTA" ? "border-red-500 bg-red-50" : "border-stone-200 hover:border-stone-300"}`}>
                <input type="radio" name="client" value="TRABALHISTA" checked={client === "TRABALHISTA"} onChange={(e) => setClient(e.target.value)} className="sr-only" />
                <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></span>
                <span className="text-sm font-medium text-red-700">Trabalhista</span>
              </label>
              {client && (
                <button type="button" onClick={() => setClient("")} className="text-xs text-stone-400 hover:text-stone-600 transition">
                  Limpar
                </button>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-1">Opcional — identifica a origem do processo.</p>
          </div>

          <div>
            <label className="field-label">
              Prazo Fatal <span className="text-stone-400 font-normal">(opcional)</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={today}
              className="input"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Cadastrando..." : "Cadastrar Processo"}
            </button>
            <Link href={backHref} className="btn-ghost">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NovoProcessoJudicialPage() {
  return (
    <Suspense fallback={null}>
      <NovoProcessoJudicialForm />
    </Suspense>
  );
}
