"use client";

import { useState, useEffect } from "react";
import {
  Building2, Plus, Loader2, ExternalLink, AlertTriangle,
  ShieldCheck, Globe2, Sparkles, Database,
} from "lucide-react";
import { PROVIDER_REGISTRY } from "@/lib/providers/registry";

const ADMIN_TOKEN_KEY = "criptomy_admin_token";

const COUNTRIES = [
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "MX", name: "México", currency: "MXN" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "BR", name: "Brasil", currency: "BRL" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "PE", name: "Perú", currency: "PEN" },
  { code: "EC", name: "Ecuador", currency: "USD" },
  { code: "VE", name: "Venezuela", currency: "VES" },
];

const CATEGORIES = [
  { id: "LEARN_EARN", label: "Aprende y gana", icon: "🎓" },
  { id: "AIRDROP", label: "Airdrop", icon: "🪂" },
  { id: "JOB_WEB3", label: "Trabajo Web3", icon: "💼" },
  { id: "CREATE", label: "Crear en Web3", icon: "🛠️" },
  { id: "MINING", label: "Minería", icon: "⛏️" },
  { id: "STAKING", label: "Staking", icon: "📈" },
];

export default function AdminView() {
  const [token, setToken] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<"providers" | "opportunities" | "paises">("providers");

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (saved) {
      setToken(saved);
      setAuthorized(true);
    }
  }, []);

  const login = () => {
    if (!token.trim()) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    setAuthorized(true);
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAuthorized(false);
    setToken("");
  };

  if (!authorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h1 className="text-xl font-bold text-slate-100 mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Panel administrativo
          </h1>
          <p className="text-xs text-slate-400 mb-4">
            Necesitas el token administrativo para acceder. Definido en{" "}
            <code className="text-slate-300">OPPORTUNITIES_ADMIN_TOKEN</code> (env var de Vercel).
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token admin"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm mb-3"
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <button
            onClick={login}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded"
          >
            Acceder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Panel administrativo
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestiona providers, oportunidades, países. El admin NO tiene acceso a fondos de usuarios.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-400 hover:text-red-400"
        >
          Salir
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        {[
          { id: "providers", label: "Proveedores", icon: Building2 },
          { id: "opportunities", label: "Oportunidades", icon: Sparkles },
          { id: "paises", label: "Países y redes", icon: Globe2 },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as never)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition ${
                active
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "providers" && <ProvidersTab token={token} />}
      {activeTab === "opportunities" && <OpportunitiesTab token={token} />}
      {activeTab === "paises" && <PaisesTab />}
    </div>
  );
}

// ============================================================
// Providers tab — solo lectura (registry es código, no DB)
// ============================================================
function ProvidersTab({ token: _token }: { token: string }) {
  return (
    <div>
      <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3 text-xs text-blue-300 mb-4 flex gap-2">
        <Database className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          El registry de providers está en <code>src/lib/providers/registry.ts</code> (código,
          no DB). Activar o desactivar un provider requiere cambio de código + redeploy. Para
          agregar API keys, ve a <b>Vercel → Settings → Environment Variables</b>.
        </div>
      </div>

      <div className="space-y-3">
        {PROVIDER_REGISTRY.map((p) => (
          <div
            key={p.id}
            className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.logoUrl || "•"}</span>
              <div>
                <div className="font-medium text-slate-100 text-sm">{p.name}</div>
                <div className="text-[11px] text-slate-500">
                  {p.category} · {p.integrationType}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {p.isLive && p.isReal && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                  Activo
                </span>
              )}
              {!p.isLive && p.isReal && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300">
                  API key faltante
                </span>
              )}
              {!p.isReal && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                  MOCK
                </span>
              )}
              <a
                href={p.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-100"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Opportunities tab — crear nuevas (POST a /api/opportunities)
// ============================================================
function OpportunitiesTab({ token }: { token: string }) {
  const [form, setForm] = useState({
    category: "LEARN_EARN",
    name: "",
    description: "",
    difficulty: "BEGINNER",
    initialInvestment: "",
    riskLevel: "LOW",
    potentialReward: "",
    countries: "ALL",
    sourceUrl: "",
    sourceName: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    if (!form.name || !form.description || !form.sourceUrl) {
      setError("name, description y sourceUrl son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          initialInvestment: form.initialInvestment ? parseFloat(form.initialInvestment) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error");
        return;
      }
      setSuccess(`Oportunidad creada: ${data.opportunity.id}`);
      setForm((f) => ({ ...f, name: "", description: "", sourceUrl: "", sourceName: "" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-3">
        Crear nueva oportunidad
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Solo se publican oportunidades con fuente verificable. No prometemos rentabilidad.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Field label="Nombre">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          />
        </Field>
        <Field label="Categoría">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción" full>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          />
        </Field>
        <Field label="URL fuente oficial">
          <input
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-xs"
          />
        </Field>
        <Field label="Nombre fuente">
          <input
            value={form.sourceName}
            onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          />
        </Field>
        <Field label="Dificultad">
          <select
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            <option value="BEGINNER">Principiante</option>
            <option value="INTERMEDIATE">Intermedio</option>
            <option value="ADVANCED">Avanzado</option>
          </select>
        </Field>
        <Field label="Riesgo">
          <select
            value={form.riskLevel}
            onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          >
            <option value="LOW">Bajo</option>
            <option value="MEDIUM">Medio</option>
            <option value="HIGH">Alto</option>
            <option value="VERY_HIGH">Muy alto</option>
          </select>
        </Field>
        <Field label="Inversión inicial (USD, vacío = gratis)">
          <input
            value={form.initialInvestment}
            onChange={(e) => setForm({ ...form, initialInvestment: e.target.value })}
            type="number"
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          />
        </Field>
        <Field label="Países (CSV o ALL)">
          <input
            value={form.countries}
            onChange={(e) => setForm({ ...form, countries: e.target.value })}
            placeholder="CO,MX,AR o ALL"
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          />
        </Field>
        <Field label="Recompensa potencial" full>
          <input
            value={form.potentialReward}
            onChange={(e) => setForm({ ...form, potentialReward: e.target.value })}
            placeholder="Ej: Tokens, $10-50, etc."
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
          />
        </Field>
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm flex items-center justify-center gap-2"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Plus className="w-4 h-4" /> Crear oportunidad
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded p-2">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 rounded p-2">
          {success}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-[11px] text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

// ============================================================
// Países tab — solo visualización
// ============================================================
function PaisesTab() {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Países soportados (LATAM)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COUNTRIES.map((c) => (
            <div
              key={c.code}
              className="bg-slate-800 rounded p-2 text-center"
            >
              <div className="text-xs font-medium text-slate-100">{c.name}</div>
              <div className="text-[10px] text-slate-500">
                {c.code} · {c.currency}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Redes blockchain soportadas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { name: "Ethereum", id: "ETH", status: "✓ Activo" },
            { name: "Polygon", id: "POL", status: "✓ Activo" },
            { name: "BNB Chain", id: "BSC", status: "✓ Activo" },
            { name: "Base", id: "BASE", status: "✓ Activo" },
            { name: "Arbitrum", id: "ARB", status: "✓ Activo" },
            { name: "Solana", id: "SOL", status: "Planeado (Fase 2)" },
            { name: "Bitcoin", id: "BTC", status: "Via on-ramp" },
            { name: "Tron", id: "TRX", status: "Activo (USDT Retos)" },
          ].map((n) => (
            <div
              key={n.id}
              className="bg-slate-800 rounded p-2 text-center"
            >
              <div className="text-xs font-medium text-slate-100">{n.name}</div>
              <div className="text-[10px] text-slate-500">{n.status}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-xs text-amber-300 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Regla:</b> No asumimos disponibilidad de proveedores en cada país. El registry
          tiene configuración por país para cada provider. Antes de activar uno en producción,
          se verifica con la documentación oficial del proveedor.
        </div>
      </div>
    </div>
  );
}
