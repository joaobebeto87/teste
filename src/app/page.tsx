"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("E-mail ou senha inválidos.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Painel da marca */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-navy-800 px-8 py-14 text-center text-white lg:py-0">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #c4a44a 0, transparent 45%), radial-gradient(circle at 80% 80%, #c4a44a 0, transparent 45%)",
          }}
        />
        <div className="relative">
          {/* Logo CPA — triângulos dourados */}
          <svg width="96" height="84" viewBox="0 0 96 84" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-6">
            <polygon points="48,2 94,82 2,82" fill="none" stroke="#c4a44a" strokeWidth="2.5"/>
            <polygon points="28,54 48,16 68,54" fill="none" stroke="#c4a44a" strokeWidth="2"/>
          </svg>
          <div className="mx-auto my-4 h-px w-16 bg-gold-500/60" />
          <h1 className="font-display text-2xl font-semibold tracking-wide text-white">
            Cavalcanti &amp; Pinto de Azevedo
          </h1>
          <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold-400">
            · Advogados ·
          </p>
          <p className="eyebrow mt-6 text-gold-300">Gestão de Processos</p>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-navy-300">
            Controle de processos, prazos e publicações do escritório com
            organização e eficiência.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-cream px-6 py-14">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="eyebrow mb-2">Acesso restrito</p>
            <h2 className="font-display text-3xl font-semibold text-navy-800">Bem-vindo</h2>
            <p className="mt-1 text-sm text-stone-500">Entre com suas credenciais para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="seu@cpaadvogados.com.br"
              />
            </div>
            <div>
              <label className="field-label">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-10 text-center text-xs tracking-wider text-stone-400">
            CPA · SISTEMA DE GESTÃO INTERNA
          </p>
        </div>
      </div>
    </div>
  );
}
