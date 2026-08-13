import { useState } from "react";
import { Link } from "react-router-dom";
import { steps, services, stats, testimonials, faqs } from "@/data/content";
import { useMarket } from "@/context/MarketContext";
import { useArtworks } from "@/hooks/useArtworks";
import { formatChf, formatPercent, formatPrice, formatSigned } from "@/utils/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import Reveal from "@/components/ui/Reveal";

function sparkline(symbol: string, up: boolean): string {
  let seed = 0;
  for (const ch of symbol) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  const points: number[] = [];
  for (let i = 0; i < 24; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const r = (seed % 100) / 100;
    points.push(i === 0 ? 14 : points[i - 1] + (r - (up ? 0.48 : 0.52)) * 4);
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / 23) * 100} ${28 - ((p - min) / range) * 24 - 2}`)
    .join(" ");
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="max-w-2xl mb-12">
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="text-ink text-30 sm:text-36 font-bold tracking-tight mt-4">{title}</h2>
      <p className="text-muted text-17 mt-3">{sub}</p>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto">
      {faqs.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={`border rounded-xl bg-white overflow-hidden transition ${
              isOpen ? "border-primary/40 shadow-md" : "border-dark_border/25"
            }`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`shrink-0 grid place-items-center w-9 h-9 rounded-lg text-14 font-extrabold transition ${
                    isOpen
                      ? "bg-gradient-to-br from-primary to-primary-dark text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-ink text-17 font-semibold">{item.q}</span>
              </div>
              <span
                className={`shrink-0 w-7 h-7 rounded-full border border-dark_border/30 grid place-items-center text-18 transition ${
                  isOpen ? "rotate-45 text-primary" : "text-muted"
                }`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <p
                id={`faq-panel-${i}`}
                className="px-5 sm:px-6 pb-5 pt-4 pl-5 sm:pl-[76px] text-muted text-16 border-t border-dark_border/15"
              >
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  useDocumentTitle("Bourse&Art | Actualités boursières & tableaux d'art");

  const { stocks, indices, commodities, news, lastUpdate } = useMarket();
  const { artworks, loading } = useArtworks();

  const topGainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
  const topLosers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);

  return (
    <main className="overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="relative min-h-[88vh] flex items-center py-16 lg:py-24">
        <div className="absolute inset-0 bg-grid" />
        <div className="orb w-[420px] h-[420px] bg-primary/20 top-[-120px] left-[-100px] animate-float" />
        <div className="orb w-[380px] h-[380px] bg-secondary/20 bottom-[-120px] right-[-80px] animate-pulse-glow" />

        <div className="relative container mx-auto lg:max-w-screen-xl px-4 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <div>
              <span className="chip !text-primary !border-primary/40">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Marchés en direct
              </span>
              <h1 className="text-ink text-36 sm:text-40 lg:text-54 font-extrabold tracking-tight leading-[1.05] mt-6 mb-6">
                Suivez la bourse,{" "}
                <span className="text-gradient">commandez</span> vos tableaux
              </h1>
              <p className="text-muted text-18 max-w-xl mb-10">
                Les actualités du marché, les cours des actions, et la
                possibilité de commander des tableaux d'art personnalisés auprès
                d'artistes passionnés.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/commandes" className="btn-grad">
                  Commander un tableau
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link to="/connexion" className="btn-ghost">
                  Espace artiste
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-6 mt-10">
                {stats.map((s) => (
                  <div key={s.label}>
                    <p className="text-ink text-24 font-extrabold">{s.value}</p>
                    <p className="text-muted text-14">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative">
              <div className="border border-dark_border/30 rounded-2xl bg-white/70 backdrop-blur p-5 sm:p-8 shadow-[0_30px_80px_-30px_rgba(19,40,83,0.35)]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div>
                    <p className="text-muted text-16">Portefeuille de démonstration</p>
                    <p className="text-ink text-24 sm:text-36 font-bold">
                      1 428 640,50 <span className="text-18 text-muted">CHF</span>
                    </p>
                  </div>
                  <span className="chip !text-success !border-success/40">+12,4 %</span>
                </div>
                <svg viewBox="0 0 320 120" className="w-full h-auto" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 100 C20 92 40 96 60 80 S100 84 120 62 S160 70 180 44 S220 54 240 30 S290 24 320 10 L320 120 L0 120 Z"
                    fill="url(#chartFill)"
                  />
                  <path
                    d="M0 100 C20 92 40 96 60 80 S100 84 120 62 S160 70 180 44 S220 54 240 30 S290 24 320 10"
                    fill="none"
                    stroke="#C9A84C"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  {[
                    { label: "Gains", value: "+158 240 CHF", color: "text-success" },
                    { label: "Positions", value: "12", color: "text-ink" },
                    { label: "Volatilité", value: "8,2 %", color: "text-ink" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className={`text-18 font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-muted text-14">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden lg:block absolute -bottom-8 -left-10 border border-dark_border/30 rounded-xl bg-white/90 backdrop-blur px-5 py-4 animate-float shadow-md">
                <p className="text-success text-18 font-bold">NVDA</p>
                <p className="text-muted text-14">+3,02 % aujourd'hui</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ INDICES & MATIÈRES ============ */}
      <section className="pb-14 lg:pb-20">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <SectionHead
              eyebrow="Vue d'ensemble"
              title="Les marchés en un coup d'œil"
              sub="Indices mondiaux, devises et matières premières, actualisés en temps réel."
            />
            <p className="flex items-center gap-2 text-muted text-15 mb-5 -mt-6">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              Cours simulés en direct
              {lastUpdate && (
                <span className="text-muted">
                  · mise à jour à {lastUpdate.toLocaleTimeString("fr-FR")}
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {indices.map((idx) => (
                <div
                  key={idx.name}
                  className="border border-dark_border/25 rounded-xl bg-white px-6 py-5 shadow-sm"
                >
                  <p className="text-muted text-14">{idx.name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-ink text-22 font-bold">
                      {formatPrice(idx.value)}
                    </p>
                    <span
                      className={`text-16 font-semibold ${
                        idx.change >= 0 ? "text-success" : "text-error"
                      }`}
                    >
                      {formatPercent(idx.change)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {commodities.map((c) => (
                <div
                  key={c.symbol}
                  className="border border-dark_border/25 rounded-xl bg-white px-4 py-4 text-center shadow-sm"
                >
                  <span className="text-24 leading-none">{c.icon}</span>
                  <p className="text-muted text-[13px] mt-2 truncate">{c.name}</p>
                  <p className="text-ink text-17 font-bold">
                    {formatPrice(c.price)}
                  </p>
                  <p
                    className={`text-14 font-semibold ${
                      c.change >= 0 ? "text-success" : "text-error"
                    }`}
                  >
                    {formatPercent(c.change)}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ TICKER ============ */}
      <section
        className="ticker-track overflow-hidden border-y border-dark_border/20 bg-white/60 py-4 mb-14 lg:mb-24"
        aria-label="Derniers cours des actions"
      >
        <div className="flex w-max animate-ticker items-center gap-10 px-5" aria-hidden="true">
          {[...stocks, ...stocks].map((stock, i) => (
            <div key={`${stock.symbol}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="text-ink text-17 font-bold">{stock.symbol}</span>
              <span className="text-muted text-16">
                {formatChf(stock.price)}
              </span>
              <span
                className={`text-16 font-medium ${
                  stock.changePercent >= 0 ? "text-success" : "text-error"
                }`}
              >
                {stock.changePercent >= 0 ? "▲" : "▼"} {formatPercent(stock.changePercent)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ COURS DES ACTIONS ============ */}
      <section className="pb-14 lg:pb-24">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <SectionHead
              eyebrow="Cotations"
              title="Cours des actions"
              sub="Les grandes valeurs de la cote parisienne et américaine, avec secteur, volume et capitalisation."
            />
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {stocks.map((stock, i) => (
              <Reveal key={stock.symbol} delay={(i % 4) * 80}>
                <article className="card p-5 h-full">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-ink text-18 font-bold">{stock.symbol}</h3>
                      <p className="text-muted text-16 mt-0.5">{stock.name}</p>
                    </div>
                    <span
                      className={`chip !text-16 ${
                        stock.changePercent >= 0
                          ? "!text-success !border-success/40"
                          : "!text-error !border-error/40"
                      }`}
                    >
                      {formatPercent(stock.changePercent)}
                    </span>
                  </div>
                  <p className="text-ink text-28 font-bold mt-5">
                    {formatChf(stock.price)}
                  </p>
                  <div className="flex items-end justify-between mt-2">
                    <p className={`text-17 font-medium ${stock.change >= 0 ? "text-success" : "text-error"}`}>
                      {formatSigned(stock.change)}
                    </p>
                    <svg
                      viewBox="0 0 100 28"
                      className="w-24 h-7"
                      preserveAspectRatio="none"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d={sparkline(stock.symbol, stock.change >= 0)}
                        stroke={stock.change >= 0 ? "#16A34A" : "#CF3127"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-dark_border/15 text-center">
                    <div>
                      <p className="text-muted text-[12px]">Secteur</p>
                      <p className="text-ink text-14 font-semibold truncate">{stock.sector}</p>
                    </div>
                    <div>
                      <p className="text-muted text-[12px]">Volume</p>
                      <p className="text-ink text-14 font-semibold">{stock.volume}</p>
                    </div>
                    <div>
                      <p className="text-muted text-[12px]">Capitalisation</p>
                      <p className="text-ink text-14 font-semibold">{stock.marketCap}</p>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          {/* Top performances */}
          <div className="grid lg:grid-cols-2 gap-6 mt-12">
            {[
              { title: "Meilleures performances du jour", list: topGainers, up: true },
              { title: "Plus fortes baisses du jour", list: topLosers, up: false },
            ].map((block) => (
              <div key={block.title} className="border border-dark_border/25 rounded-xl bg-white p-6 shadow-sm">
                <h3 className="text-ink text-22 font-bold mb-5">{block.title}</h3>
                <ul className="space-y-3">
                  {block.list.map((s) => (
                    <li key={s.symbol} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-muted text-14 font-semibold">{s.symbol}</span>
                        <span className="text-muted text-14 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-ink text-14 font-semibold">
                          {formatChf(s.price)}
                        </span>
                        <span
                          className={`text-14 font-bold ${
                            block.up ? "text-success" : "text-error"
                          }`}
                        >
                          {formatPercent(s.changePercent)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COMMENT ÇA MARCHE ============ */}
      <section className="py-16 lg:py-24 bg-white/60 border-y border-dark_border/15">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <div className="text-center">
              <span className="section-eyebrow-center">Comment ça marche</span>
              <h2 className="text-ink text-30 sm:text-36 font-bold tracking-tight mt-4">
                De l'idée à l'œuvre
              </h2>
              <p className="text-muted text-17 mt-3 max-w-2xl mx-auto">
                Un processus simple et transparent, de la description de votre
                projet jusqu'à la réception de votre tableau.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {steps.map((s, i) => (
              <Reveal key={s.step} delay={i * 80}>
                <div className="relative bg-white border border-dark_border/25 rounded-xl p-6 h-full shadow-sm hover:shadow-md transition">
                  <span className="absolute top-5 right-6 text-14 font-extrabold tracking-widest text-primary/40">
                    {s.step}
                  </span>
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white text-22 mb-5">
                    {s.icon}
                  </span>
                  <h3 className="text-ink text-18 font-bold mb-2">{s.title}</h3>
                  <p className="text-muted text-16">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SERVICES ============ */}
      <section className="py-24">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <SectionHead
              eyebrow="Nos services"
              title="Pourquoi nous choisir"
              sub="Bourse, art et accompagnement : tout ce qu'il faut pour investir et vous faire plaisir en toute confiance."
            />
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 80}>
                <div className="card p-7 h-full">
                  <div className="flex items-center justify-between mb-5">
                    <span className="grid place-items-center w-12 h-12 rounded-xl bg-primary/10 text-24">
                      {s.icon}
                    </span>
                    <span className="chip !text-primary !border-primary/40 !text-[13px]">{s.tag}</span>
                  </div>
                  <h3 className="text-ink text-22 font-bold mb-2">{s.title}</h3>
                  <p className="text-muted text-16">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ GALERIE ============ */}
      <section className="py-16 lg:py-24 bg-white/60 border-y border-dark_border/15">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
              <div>
                <span className="section-eyebrow">La galerie</span>
                <h2 className="text-ink text-30 sm:text-36 font-bold tracking-tight mt-4">
                  Œuvres d'artistes
                </h2>
                <p className="text-muted text-17 mt-3">
                  Un aperçu des créations de nos artistes partenaires.
                </p>
              </div>
              <Link to="/commandes" className="btn-ghost !py-3">
                Commander la vôtre
              </Link>
            </div>
          </Reveal>
          {loading ? (
            <p className="text-muted text-16">Chargement des œuvres…</p>
          ) : artworks.length === 0 ? (
            <div className="border border-dark_border/15 rounded-xl bg-white/60 px-6 py-16 text-center">
              <p className="text-ink text-22 font-semibold">La galerie se remplit bientôt</p>
              <p className="text-muted text-16 mt-3 max-w-md mx-auto">
                Les œuvres ajoutées par nos artistes partenaires apparaîtront ici dès leur mise en ligne.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {artworks.map((a, i) => (
                <Reveal key={a.id} delay={(i % 3) * 80}>
                  <div className="group bg-white border border-dark_border/25 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition h-full">
                    <div className={`relative h-56 bg-gradient-to-br ${a.gradient}`}>
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 transition" />
                      <span className="absolute top-4 left-4 chip bg-white/90 !text-primary">
                        {a.description || "Œuvre d'art"}
                      </span>
                      <span
                        className={`absolute top-4 right-4 chip ${
                          a.status === "sold"
                            ? "bg-white/90 !text-success"
                            : "bg-white/90 !text-primary"
                        }`}
                      >
                        {a.status === "sold"
                          ? "Vendu"
                          : a.price != null
                            ? formatChf(a.price)
                            : "Négociation"}
                      </span>
                    </div>
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <h3 className="text-ink text-18 font-bold">{a.title}</h3>
                        <p className="text-muted text-14">par {a.artist}</p>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============ ACTUALITÉS ============ */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <SectionHead
              eyebrow="Tendances"
              title="Actualités de la bourse"
              sub="Les dernières nouvelles qui font bouger les marchés et la scène artistique."
            />
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item, i) => (
              <Reveal key={item.id} delay={(i % 3) * 80}>
                <article className="card p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <span className="chip !text-primary !border-primary/40">{item.category}</span>
                    <span className="text-muted text-14">{item.readTime} de lecture</span>
                  </div>
                  <h3 className="text-ink text-22 font-bold tracking-tight mb-3">{item.title}</h3>
                  <p className="text-muted text-16">{item.summary}</p>
                  <p className="mt-auto pt-6 flex items-center gap-2 text-primary text-16 font-semibold">
                    Lire plus
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span className="ml-auto text-muted text-14 font-normal">{item.date}</span>
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TÉMOIGNAGES ============ */}
      <section className="py-16 lg:py-24 bg-white/60 border-y border-dark_border/15">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-eyebrow-center">Témoignages</span>
              <h2 className="text-ink text-30 sm:text-36 font-bold tracking-tight mt-4">
                Ils nous font confiance
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <div className="bg-white border border-dark_border/25 rounded-xl p-7 h-full shadow-sm">
                  <div className="flex gap-1 mb-5 text-gold">
                    {"★★★★★".split("").map((s, j) => (
                      <span key={j}>{s}</span>
                    ))}
                  </div>
                  <p className="text-muted text-16 mb-6">« {t.text} »</p>
                  <div className="flex items-center gap-3">
                    <span className="grid place-items-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white text-16 font-bold">
                      {t.initials}
                    </span>
                    <div>
                      <p className="text-ink text-16 font-bold">{t.name}</p>
                      <p className="text-muted text-14">{t.role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <div className="text-center mb-12">
              <span className="section-eyebrow-center">FAQ</span>
              <h2 className="text-ink text-30 sm:text-36 font-bold tracking-tight mt-4">
                Questions fréquentes
              </h2>
              <p className="text-muted text-17 mt-3 max-w-2xl mx-auto">
                Tout ce qu'il faut savoir avant de commander une œuvre ou de
                suivre la bourse.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <Faq />
          </Reveal>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="pb-16 lg:pb-24">
        <div className="container mx-auto lg:max-w-screen-xl px-4">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-7 sm:p-10 lg:p-14 text-center">
              <div className="orb w-[300px] h-[300px] bg-gold/30 -top-24 -right-20 animate-float" />
              <div className="relative">
                <span className="chip bg-white/15 !text-white !border-white/30 mb-6">
                  Vous êtes artiste ?
                </span>
                <h2 className="text-white lg:text-40 text-30 font-bold tracking-tight mb-5">
                  Rejoignez la galerie et vendez vos œuvres
                </h2>
                <p className="text-white/80 text-18 max-w-2xl mx-auto mb-8">
                  Gérez vos tableaux, suivez vos ventes et votre solde, et
                  recevez vos commandes d'art personnalisées.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Link
                    to="/connexion"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-primary font-bold text-14 uppercase tracking-[0.12em] px-8 py-4 transition hover:bg-gold hover:text-white"
                  >
                    Accéder à mon espace
                  </Link>
                  <Link
                    to="/commandes"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 text-white font-semibold text-14 uppercase tracking-[0.12em] px-8 py-4 transition hover:bg-white hover:text-primary"
                  >
                    Commander un tableau
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
