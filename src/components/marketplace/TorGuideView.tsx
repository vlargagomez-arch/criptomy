"use client";

import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Eye,
  Lock,
  Network,
  Terminal,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function TorGuideView() {
  const { user, setUser } = useApp();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          Guía de privacidad y Tor
        </h1>
        <p className="text-sm text-slate-400">
          Cómo maximizar su anonimato usando esta plataforma
        </p>
      </div>

      {/* Niveles de privacidad */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Niveles de privacidad recomendados
        </h3>
        <div className="space-y-3">
          {[
            {
              level: 1,
              title: "Básico (pseudónimo)",
              desc: "Usa la plataforma con un alias y wallet generada. Sin email, sin KYC. Equivalente a LocalBitcoins clásico.",
              color: "border-slate-700",
              badge: "bg-slate-700",
              features: ["Alias aleatorio", "Wallet sin KYC", "Chat cifrado E2E"],
            },
            {
              level: 2,
              title: "Medio (Tor Browser)",
              desc: "Accede a la plataforma desde Tor Browser. Su IP está oculta al servidor. Marque su perfil como Tor-only.",
              color: "border-cyan-700",
              badge: "bg-cyan-700",
              features: ["Tor Browser", "IP oculta", "Perfil Tor-only"],
            },
            {
              level: 3,
              title: "Alto (Tor + Monero)",
              desc: "Opera exclusivamente con Monero (XMR), que oculta remitente, destinatario y monto on-chain. Combine con Tor para máxima privacidad.",
              color: "border-emerald-700",
              badge: "bg-emerald-700",
              features: ["Tor + XMR", "Sin huella on-chain", "Recomendado para grandes montos"],
            },
          ].map((l) => (
            <div
              key={l.level}
              className={`p-3 rounded-md bg-slate-950 border ${l.color}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${l.badge}`}
                >
                  Nivel {l.level}
                </span>
                <span className="text-sm font-medium text-slate-100">
                  {l.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-2">{l.desc}</p>
              <div className="flex flex-wrap gap-1">
                {l.features.map((f) => (
                  <Badge
                    key={f}
                    variant="outline"
                    className="text-[10px] bg-slate-900 border-slate-700 text-slate-400"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-500" />
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Toggle Tor-only */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
          <Network className="w-4 h-4 text-emerald-400" />
          Mi configuración Tor
        </h3>
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md bg-slate-950 border border-slate-800">
              <div>
                <div className="text-sm text-slate-200">
                  Perfil Tor-only:{" "}
                  <strong className={user.torOnly ? "text-emerald-400" : "text-slate-500"}>
                    {user.torOnly ? "Activado" : "Desactivado"}
                  </strong>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Si activa esta opción, su perfil exigió a las contrapartes
                  comunicarse con usted vía Tor.
                </p>
              </div>
              <Button
                size="sm"
                variant={user.torOnly ? "default" : "outline"}
                onClick={async () => {
                  const res = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      walletAddress: user.walletAddress,
                      torOnly: !user.torOnly,
                    }),
                  });
                  const data = await res.json();
                  if (data.user) setUser(data.user);
                }}
                className={
                  user.torOnly
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }
              >
                {user.torOnly ? "Activado" : "Activar"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Conecte su billetera para cambiar esta configuración.
          </p>
        )}
      </Card>

      {/* Configurar Tor */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Cómo configurar Tor (Linux/macOS)
        </h3>
        <div className="space-y-3">
          <Step n={1} title="Instalar Tor">
            <CodeBlock lang="bash">
{`# Debian/Ubuntu
sudo apt install tor

# macOS (Homebrew)
brew install tor

# Arch
sudo pacman -S tor`}
            </CodeBlock>
          </Step>

          <Step n={2} title="Iniciar el servicio Tor">
            <CodeBlock lang="bash">
{`sudo systemctl start tor
sudo systemctl enable tor  # arranque automático

# Verificar
sudo systemctl status tor
# ✓ Active: active (running)`}
            </CodeBlock>
          </Step>

          <Step n={3} title="Configurar Hidden Service (.onion)">
            <p className="text-xs text-slate-400 mb-2">
              Edite <code className="text-emerald-400">/etc/tor/torrc</code> y
              agregue al final:
            </p>
            <CodeBlock lang="bash">
{`# Servicio oculto para NoKYCSwap
HiddenServiceDir /var/lib/tor/nokycswap/
HiddenServicePort 80 127.0.0.1:3000
HiddenServicePort 443 127.0.0.1:3000`}
            </CodeBlock>
          </Step>

          <Step n={4} title="Reiniciar Tor y obtener la dirección .onion">
            <CodeBlock lang="bash">
{`sudo systemctl restart tor
sudo cat /var/lib/tor/nokycswap/hostname
# => abc123def456ghi789jkl012mno345pqr678stu901vwx234yz.onion`}
            </CodeBlock>
          </Step>

          <Step n={5} title="Acceder vía Tor Browser">
            <p className="text-xs text-slate-400 mb-2">
              Descargue Tor Browser desde{" "}
              <a
                href="https://www.torproject.org/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                torproject.org <ExternalLink className="w-3 h-3" />
              </a>{" "}
              y visite su dirección .onion.
            </p>
          </Step>
        </div>
      </Card>

      {/* Monero */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-orange-400" />
          Por qué Monero (XMR) es la opción más privada
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {[
            {
              chain: "Bitcoin (BTC)",
              pros: ["Transparente", "Auditable"],
              cons: ["Sender visible", "Receiver visible", "Monto visible", "Trazable"],
              color: "border-orange-700",
            },
            {
              chain: "Ethereum (ETH)",
              pros: ["Smart contracts", "DeFi"],
              cons: ["Sender visible", "Receiver visible", "Monto visible", "Trazable"],
              color: "border-blue-700",
            },
            {
              chain: "Monero (XMR)",
              pros: ["Sender oculto", "Receiver oculto", "Monto oculto", "Fungible"],
              cons: ["Sin smart contracts", "Menor liquidez"],
              color: "border-emerald-700",
            },
          ].map((c) => (
            <div
              key={c.chain}
              className={`p-3 rounded-md bg-slate-950 border ${c.color}`}
            >
              <div className="text-sm font-medium text-slate-100 mb-2">
                {c.chain}
              </div>
              <div className="space-y-1">
                {c.pros.map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    {p}
                  </div>
                ))}
                {c.cons.map((con) => (
                  <div key={con} className="flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    {con}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">
          Recomendación: use Monero para trades de alto monto donde el anonimato
          sea crítico. Para montos pequeños, BTC o ETH con Tor son suficientes.
        </p>
      </Card>

      {/* Checklist */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          Checklist de privacidad
        </h3>
        <ul className="space-y-2 text-xs">
          {[
            "Usar Tor Browser (no navegador normal + VPN)",
            "No reutilizar alias vinculado a redes sociales",
            "Generar wallet nueva exclusivamente para esta plataforma",
            "No mencionar datos personales (nombre, ciudad, banco) en el chat",
            "Usar Monero para montos mayores a $1,000 USD",
            "Borrar cookies y localStorage de Tor Browser tras cada sesión",
            "Verificar reputación de la contraparte antes de aceptar trade",
            "Exigir siempre el depósito en escrow antes de enviar pago fiat",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 mb-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 text-[10px] text-slate-600 font-mono">
        {lang}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-12 top-1 h-6 w-6 text-slate-600 hover:text-slate-200"
        onClick={() => navigator.clipboard?.writeText(children)}
      >
        <Copy className="w-3 h-3" />
      </Button>
      <pre className="bg-slate-950 border border-slate-800 rounded-md p-3 pr-20 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed">
        {children}
      </pre>
    </div>
  );
}
