"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NovoProcessoPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [otherCategory, setOtherCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const CATEGORIES = ["Parecer Jurídico", "Resposta a Ofício", "Pedido de Informações"];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const finalCategory = category === "Outro" ? otherCategory.trim() : category;
    if (category === "Outro" && !finalCategory) {
      setError("Especifique a categoria no campo \"Outro\".");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/processos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, description, deadline, category: finalCategory }),
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
        <Link href="/dashboard/processos" className="text-stone-400 transition hover:text-navy-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="page-title">Novo Processo</h1>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
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
            <label className="field-label">
              Categoria <span className="text-stone-400 font-normal">(opcional)</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              <option value="">Selecione uma categoria...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="Outro">Outro (especificar)</option>
            </select>
            {category === "Outro" && (
              <input
                type="text"
                value={otherCategory}
                onChange={(e) => setOtherCategory(e.target.value)}
                className="input mt-2"
                placeholder="Qual a categoria?"
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="field-label">
              Descrição / Observações
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input resize-none"
              placeholder="Informações adicionais sobre o processo (opcional)..."
            />
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
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Cadastrando..." : "Cadastrar Processo"}
            </button>
            <Link href="/dashboard/processos" className="btn-ghost">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
