"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User { id: string; name: string; }

export default function NovaDemandaPage() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/processos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        description,
        deadline,
        parties: client,
        category: responsible,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao criar demanda");
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
        <h1 className="page-title">Nova demanda</h1>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="field-label">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              className="input"
              placeholder="Nome do cliente..."
            />
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
              placeholder="Descreva o assunto da demanda..."
            />
          </div>

          <div>
            <label className="field-label">
              Responsável <span className="text-stone-400 font-normal">(opcional)</span>
            </label>
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="input"
            >
              <option value="">Selecione o responsável...</option>
              {users.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
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
              placeholder="Informações adicionais sobre a demanda (opcional)..."
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
              {loading ? "Cadastrando..." : "Cadastrar Demanda"}
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
