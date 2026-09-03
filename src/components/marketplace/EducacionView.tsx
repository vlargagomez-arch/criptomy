"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/store";
import {
  BookOpen, Loader2, Shield, Wallet, TrendingUp, Calculator, Globe2,
  Lock, CheckCircle2, PlayCircle, Award, Info, Clock,
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  durationMin: number;
  content: string;
  imageUrl?: string;
  order: number;
  active: boolean;
}

const CATEGORIES = [
  { id: "", label: "Todos", icon: "📚" },
  { id: "BASICS", label: "Conceptos básicos", icon: "💡" },
  { id: "WALLET", label: "Wallets", icon: "👛" },
  { id: "SECURITY", label: "Seguridad", icon: "🛡️" },
  { id: "TRADING", label: "Trading", icon: "📊" },
  { id: "TAXES", label: "Impuestos", icon: "🧮" },
  { id: "REMESAS", label: "Remesas", icon: "🌐" },
];

// Cursos pre-cargados (datos estáticos en español, no requieren DB)
const STATIC_COURSES: Course[] = [
  {
    id: "static-basics-1",
    title: "¿Qué es Bitcoin y por qué importa?",
    description: "Aprende qué es Bitcoin, cómo funciona la blockchain, y por qué millones de personas en Latinoamérica la usan como refugio contra la inflación.",
    category: "BASICS",
    level: "BEGINNER",
    durationMin: 10,
    content: "Bitcoin es una moneda digital descentralizada...",
    order: 1,
    active: true,
  },
  {
    id: "static-basics-2",
    title: "USDT y USDC: Las stablecoins que no cambian de precio",
    description: "Qué son las stablecoins, por qué valen lo mismo que el dólar, y cómo usarlas para enviar dinero sin que el valor cambie.",
    category: "BASICS",
    level: "BEGINNER",
    durationMin: 8,
    content: "Las stablecoins son criptomonedas...",
    order: 2,
    active: true,
  },
  {
    id: "static-wallet-1",
    title: "Cómo crear tu primera wallet con MetaMask",
    description: "Paso a paso: instalar MetaMask, crear tu wallet, guardar tu seed phrase, y conectarla a CriptoMy. Sin KYC, sin dar datos personales.",
    category: "WALLET",
    level: "BEGINNER",
    durationMin: 15,
    content: "MetaMask es la wallet más popular...",
    order: 3,
    active: true,
  },
  {
    id: "static-wallet-2",
    title: "Cómo proteger tu wallet para siempre perder tus fondos",
    description: "Las 5 reglas de oro: nunca compartir tu seed phrase, verificar URLs, usar 2FA, no hacer click en links sospechosos, y hacer backup.",
    category: "WALLET",
    level: "INTERMEDIATE",
    durationMin: 12,
    content: "La seguridad de tu wallet es lo más importante...",
    order: 4,
    active: true,
  },
  {
    id: "static-security-1",
    title: "Cómo identificar un scam cripto antes de que te estafen",
    description: "Señales de alarma: promesas de ganancias, presión de tiempo, links falsos, proyectos sin equipo público, y 'doble tu cripto'.",
    category: "SECURITY",
    level: "BEGINNER",
    durationMin: 10,
    content: "Los scams cripto son cada vez más sofisticados...",
    order: 5,
    active: true,
  },
  {
    id: "static-security-2",
    title: "Phishing: cómo no perder tus fondos por un link falso",
    description: "Qué es phishing, cómo identificar sitios falsos que imitan exchanges, y cómo verificar que estás en el sitio correcto antes de conectar tu wallet.",
    category: "SECURITY",
    level: "INTERMEDIATE",
    durationMin: 8,
    content: "El phishing es la forma más común...",
    order: 6,
    active: true,
  },
  {
    id: "static-remesas-1",
    title: "Cómo enviar dinero a otro país con cripto (sin bancos)",
    description: "Usa USDT para enviar dinero a familiares en otro país en minutos, con comisión de $1-5, sin bancos, sin KYC. Ejemplos reales Colombia-México.",
    category: "REMESAS",
    level: "BEGINNER",
    durationMin: 12,
    content: "Las remesas cripto son la revolución...",
    order: 7,
    active: true,
  },
  {
    id: "static-taxes-1",
    title: "Impuestos cripto en Colombia: lo que necesitas saber",
    description: "Cómo declarar cripto en la DIAN, qué impuestos aplican, cómo calcular ganancias/pérdidas, y qué documentación necesitas.",
    category: "TAXES",
    level: "INTERMEDIATE",
    durationMin: 15,
    content: "En Colombia, las criptomonedas están sujetas...",
    order: 8,
    active: true,
  },
  {
    id: "static-trading-1",
    title: "P2P vs Exchange: cuál usar y cuándo",
    description: "Diferencia entre comprar en un exchange (Binance, Coinbase) vs P2P (persona-a-persona). Ventajas, desventajas, y riesgos de cada uno.",
    category: "TRADING",
    level: "BEGINNER",
    durationMin: 10,
    content: "Comprar cripto puede hacerse de dos formas...",
    order: 9,
    active: true,
  },
];

export default function EducacionView() {
  const { user } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, { progress: number; completed: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (user) params.append("address", user.walletAddress);
      const res = await fetch(`/api/courses?${params}`);
      if (res.ok) {
        const data = await res.json();
        // Combinar cursos de la DB con cursos estáticos
        const dbCourses = (data.courses || []).map((c: Course) => ({ ...c, id: c.id }));
        const allCourses = [...STATIC_COURSES, ...dbCourses];
        // Filtrar por categoría si hay
        const filtered = category ? allCourses.filter((c) => c.category === category) : allCourses;
        // Ordenar por order
        filtered.sort((a, b) => a.order - b.order);
        setCourses(filtered);
        setEnrollments(data.enrollments || {});
      } else {
        // Si la DB no responde, usar solo cursos estáticos
        const filtered = category ? STATIC_COURSES.filter((c) => c.category === category) : STATIC_COURSES;
        setCourses(filtered);
      }
    } catch {
      // Fallback a cursos estáticos
      const filtered = category ? STATIC_COURSES.filter((c) => c.category === category) : STATIC_COURSES;
      setCourses(filtered);
    } finally {
      setLoading(false);
    }
  }, [category, user]);

  useEffect(() => {
    load();
  }, [load]);

  const markCompleted = async (courseId: string) => {
    if (!user) return;
    try {
      await fetch("/api/courses?op=progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: user.walletAddress, courseId, progress: 100 }),
      });
      setEnrollments((prev) => ({ ...prev, [courseId]: { progress: 100, completed: true } }));
    } catch {}
  };

  const completedCount = Object.values(enrollments).filter((e) => e.completed).length;
  const totalDuration = courses.reduce((sum, c) => sum + c.durationMin, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-yellow-400" />
          Educación Financiera Cripto
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cursos gratuitos en español. Aprende a usar cripto de forma segura, proteger tu wallet,
          enviar remesas, y declarar impuestos. Sin KYC, sin registro.
        </p>
      </div>

      {/* Panel explicativo */}
      <div className="mb-6 bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-yellow-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
            ¿Por qué educación cripto?
          </h3>
        </div>
        <p className="text-[12px] text-slate-400">
          En Latinoamérica, millones de personas usan cripto por <b className="text-slate-200">necesidad</b>,
          no por inversión. Para enviar remesas, protegerse de la inflación, o acceder a servicios
          financieros sin banco. Pero muchas pierden fondos por falta de educación: scams, phishing,
          claves comprometidas. <b className="text-yellow-300">Nuestra misión: que nadie pierda dinero
          por no saber cómo funciona la cripto.</b>
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Cursos disponibles</div>
          <div className="text-xl font-bold text-yellow-400">{courses.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Tiempo total</div>
          <div className="text-xl font-bold text-slate-100">{totalDuration} min</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase">Completados</div>
          <div className="text-xl font-bold text-emerald-400">{completedCount}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              category === c.id
                ? "bg-yellow-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Cursos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const enrolled = enrollments[course.id];
            const completed = enrolled?.completed;
            const progress = enrolled?.progress || 0;
            return (
              <div
                key={course.id}
                className={`bg-slate-900 border rounded-xl p-4 hover:border-yellow-600/30 transition ${
                  completed ? "border-emerald-800/50" : "border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{CATEGORIES.find((c) => c.id === course.category)?.icon || "📚"}</span>
                    <div>
                      <h3 className="font-semibold text-slate-100 text-sm">{course.title}</h3>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <Clock className="w-2.5 h-2.5" /> {course.durationMin} min
                        <span>·</span>
                        <span>{course.level === "BEGINNER" ? "Principiante" : course.level === "INTERMEDIATE" ? "Intermedio" : "Avanzado"}</span>
                      </div>
                    </div>
                  </div>
                  {completed && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                </div>

                <p className="text-xs text-slate-400 line-clamp-3 mb-3">{course.description}</p>

                {/* Progreso */}
                {progress > 0 && !completed && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-500" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1">{progress}% completado</div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedCourse(course)}
                  className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition ${
                    completed
                      ? "bg-emerald-900/50 text-emerald-300"
                      : "bg-yellow-600 hover:bg-yellow-500 text-white"
                  }`}
                >
                  {completed ? (
                    <><Award className="w-4 h-4" /> Completado</>
                  ) : progress > 0 ? (
                    <><PlayCircle className="w-4 h-4" /> Continuar</>
                  ) : (
                    <><PlayCircle className="w-4 h-4" /> Ver curso</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de curso */}
      {selectedCourse && (
        <CourseModal
          course={selectedCourse}
          user={user}
          onClose={() => setSelectedCourse(null)}
          onComplete={() => {
            markCompleted(selectedCourse.id);
            setSelectedCourse(null);
          }}
        />
      )}
    </div>
  );
}

function CourseModal({
  course, user, onClose, onComplete,
}: {
  course: Course;
  user: { walletAddress: string } | null;
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="text-2xl">{CATEGORIES.find((c) => c.id === course.category)?.icon || "📚"}</span>
            {course.title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {course.durationMin} min</span>
          <span>·</span>
          <span>{course.level === "BEGINNER" ? "Principiante" : course.level === "INTERMEDIATE" ? "Intermedio" : "Avanzado"}</span>
        </div>

        <p className="text-sm text-slate-300 mb-4">{course.description}</p>

        <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400 mb-6">
          {course.content || "Contenido del curso disponible próximamente. Mientras tanto, puedes consultar recursos externos sobre este tema."}
        </div>

        {/* Recursos externos */}
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-3 mb-6">
          <div className="text-[10px] uppercase text-blue-400 mb-2">📚 Recursos recomendados</div>
          <div className="space-y-1 text-xs text-slate-400">
            <div>• Binance Academy (español): https://academy.binance.com/es</div>
            <div>• Ethereum.org (español): https://ethereum.org/es/learn</div>
            <div>• CriptoNoticias (guías LATAM): https://www.criptonoticias.com</div>
          </div>
        </div>

        {/* Botón completar */}
        {user && (
          <button
            onClick={onComplete}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            Marcar como completado
          </button>
        )}
        {!user && (
          <div className="text-center text-xs text-slate-500">
            Conecta tu wallet para guardar tu progreso
          </div>
        )}
      </div>
    </div>
  );
}
