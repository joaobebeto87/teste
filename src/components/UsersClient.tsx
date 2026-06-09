"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: number;
  createdAt: string;
}

interface Props { users: User[]; currentUserId: string; }

type Perfil = "N1" | "N2" | "ADMIN";

function perfilOf(u: User): Perfil {
  if (u.role === "ADMIN") return "ADMIN";
  return u.accessLevel >= 2 ? "N2" : "N1";
}
function perfilLabel(p: Perfil): string {
  return p === "ADMIN" ? "Administrador" : p === "N2" ? "Assessor · Nível 2" : "Assessor · Nível 1";
}
function perfilPayload(p: Perfil) {
  return { role: p === "ADMIN" ? "ADMIN" : "ASSESSOR", accessLevel: p === "N2" ? 2 : 1 };
}

export default function UsersClient({ users: initial, currentUserId }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("N1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function createUser() {
    if (!name || !email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, ...perfilPayload(perfil) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess(`Usuário "${data.name}" criado com sucesso!`);
    setName(""); setEmail(""); setPassword(""); setPerfil("N1");
    setShowForm(false);
    router.refresh();
  }

  async function changePerfil(id: string, p: Perfil) {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(perfilPayload(p)),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    router.refresh();
  }

  async function deleteUser(id: string, userName: string) {
    if (!confirm(`Excluir o usuário "${userName}"?`)) return;
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Equipe</p>
          <h1 className="page-title">Usuários do Sistema</h1>
          <p className="text-stone-500 text-sm mt-1">{initial.length} usuário(s) cadastrado(s)</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Usuário
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg mb-4">{success}</div>
      )}

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="section-title mb-4">Cadastrar Novo Usuário</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Nome Completo <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full input" placeholder="Nome do assessor..." />
            </div>
            <div>
              <label className="field-label">E-mail <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full input" placeholder="email@prefeitura.gov.br" />
            </div>
            <div>
              <label className="field-label">Senha Inicial <span className="text-red-500">*</span></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full input" placeholder="••••••••" />
            </div>
            <div>
              <label className="field-label">Perfil de acesso</label>
              <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)} className="w-full input">
                <option value="N1">Assessor — Nível 1 (administrativos + tarefas)</option>
                <option value="N2">Assessor — Nível 2 (também processos judiciais)</option>
                <option value="ADMIN">Administrador (acesso total)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mt-4">{error}</div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={createUser} disabled={loading} className="btn-primary">{loading ? "Salvando..." : "Cadastrar"}</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
              <th className="px-6 py-3 font-medium">Nome</th>
              <th className="px-6 py-3 font-medium">E-mail</th>
              <th className="px-6 py-3 font-medium">Perfil de acesso</th>
              <th className="px-6 py-3 font-medium">Cadastrado em</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                  <td className="px-6 py-3 font-medium text-navy-800">{user.name}
                    {isSelf && (<span className="ml-2 text-xs bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-full">você</span>)}
                  </td>
                  <td className="px-6 py-3 text-stone-600">{user.email}</td>
                  <td className="px-6 py-3">
                    {isSelf ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-navy-100 text-navy-700">
                        {perfilLabel(perfilOf(user))}
                      </span>
                    ) : (
                      <select
                        value={perfilOf(user)}
                        onChange={(e) => changePerfil(user.id, e.target.value as Perfil)}
                        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-navy-800 focus:outline-none focus:ring-2 focus:ring-gold-300/70"
                      >
                        <option value="N1">Assessor · Nível 1</option>
                        <option value="N2">Assessor · Nível 2</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-3 text-stone-500">{format(new Date(user.createdAt), "dd/MM/yyyy")}</td>
                  <td className="px-6 py-3">
                    {!isSelf && (
                      <button onClick={() => deleteUser(user.id, user.name)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
