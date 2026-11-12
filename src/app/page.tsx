"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EditeurActes from "@/components/EditeurActes";
import { CompteRenduImprimable, DevisConventionnel, EnTete } from "@/components/Documents";
import type { ActeExtrait, Analyse } from "@/lib/schema";
import { TARIFS } from "@/lib/tarifs";
import { CAS_DEMO } from "@/lib/demo";
import { calculerLignes, euros, totaliser, type LigneDevis } from "@/lib/devis";
import { CABINET_DEFAUT, completerCabinet, RUBRIQUES, type Cabinet, type Patient } from "@/lib/types";
import { useEcoute } from "@/lib/useEcoute";

function lireCabinet(): Cabinet {
  try {
    const brut = localStorage.getItem("cabinet");
    return completerCabinet(brut ? JSON.parse(brut) : {});
  } catch {
    return CABINET_DEFAUT;
  }
}

const joindre = (avant: string, ajout: string) => (avant ? `${avant} ${ajout}` : ajout);

export default function Accueil() {
  const router = useRouter();
  const [cabinet, setCabinet] = useState<Cabinet>(CABINET_DEFAUT);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [patient, setPatient] = useState<Patient>({ nom: "", naissance: "", secu: "" });
  const [identiteOuverte, setIdentiteOuverte] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [texte, setTexte] = useState("");
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [chiffrage, setChiffrage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [demo, setDemo] = useState<"exact" | "approx" | null>(null);
  const [onglet, setOnglet] = useState<"cr" | "actes" | "texte">("cr");
  const [aImprimer, setAImprimer] = useState<"cr" | "devis">("devis");
  const [copie, setCopie] = useState(false);
  const [numeroDevis, setNumeroDevis] = useState("");
  const [simulation, setSimulation] = useState<string | null>(null);

  useEffect(() => {
    // Lecture différée : localStorage n'existe pas pendant le rendu serveur.
    const c = lireCabinet();
    queueMicrotask(() => setCabinet(c));
  }, []);

  function majCabinet(c: Cabinet) {
    setCabinet(c);
    try {
      localStorage.setItem("cabinet", JSON.stringify(c));
    } catch {
      /* stockage indisponible : les réglages restent pour cette session */
    }
  }

  // ----- Chiffrage (analyse par l'IA), relancé à chaque nouveau morceau de texte -----

  const enVolRef = useRef(false);
  const enAttenteRef = useRef<string | null>(null);

  const chiffrer = useCallback(
    async (contenu: string) => {
      if (!contenu.trim()) return;
      if (enVolRef.current) {
        // Un chiffrage est déjà en cours : on relancera avec le texte le plus récent.
        enAttenteRef.current = contenu;
        return;
      }
      enVolRef.current = true;
      setChiffrage(true);
      setErreur(null);
      let courant: string | null = contenu;
      while (courant) {
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dictee: courant }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setErreur(data.error ?? "Échec du chiffrage");
          } else {
            const { demo: estDemo, ...resultat } = data;
            setDemo(estDemo === "exact" || estDemo === "approx" ? estDemo : null);
            setAnalyse(resultat as Analyse);
            setNumeroDevis((n) => n || `${date.replaceAll("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`);
          }
        } catch {
          setErreur("Impossible de contacter le serveur");
        }
        courant = enAttenteRef.current;
        enAttenteRef.current = null;
      }
      enVolRef.current = false;
      setChiffrage(false);
    },
    [date]
  );

  // Pendant l'écoute, chaque morceau transcrit s'ajoute au texte et relance le chiffrage.
  const texteRef = useRef("");
  const minuteurChiffrage = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ajouterTexte = useCallback(
    (morceau: string, relancer = true) => {
      texteRef.current = joindre(texteRef.current, morceau);
      setTexte(texteRef.current);
      if (!relancer) return;
      if (minuteurChiffrage.current) clearTimeout(minuteurChiffrage.current);
      minuteurChiffrage.current = setTimeout(() => chiffrer(texteRef.current), 800);
    },
    [chiffrer]
  );

  const ecoute = useEcoute(ajouterTexte);

  function nouvelleConsultation() {
    texteRef.current = "";
    setTexte("");
    setAnalyse(null);
    setDemo(null);
    setErreur(null);
    setNumeroDevis("");
    setPatient({ nom: "", naissance: "", secu: "" });
  }

  async function demarrer() {
    if (analyse || texte) nouvelleConsultation();
    await ecoute.demarrer();
  }

  function terminer() {
    ecoute.arreter();
    // Dernier chiffrage une fois les dernières transcriptions arrivées.
    setTimeout(() => chiffrer(texteRef.current), 1500);
  }

  // ----- Simulation : rejoue une consultation fictive, phrase par phrase -----

  async function simuler(id: string) {
    const cas = CAS_DEMO.find((c) => c.id === id);
    if (!cas || simulation) return;
    nouvelleConsultation();
    setSimulation(id);
    const phrases = cas.dictee.match(/[^.:]+[.:]\s*/g) ?? [cas.dictee];
    for (const p of phrases) {
      await new Promise((r) => setTimeout(r, 700));
      ajouterTexte(p.trim(), false);
    }
    await chiffrer(cas.dictee);
    setSimulation(null);
  }

  // ----- Données dérivées -----

  const realises = useMemo(
    () => calculerLignes(analyse?.actes.filter((a) => a.statut === "realise") ?? []),
    [analyse]
  );
  const proposes = useMemo(
    () =>
      calculerLignes(analyse?.actes.filter((a) => a.statut === "propose") ?? []).sort((a, b) => a.etape - b.etape),
    [analyse]
  );

  function majRubrique(cle: keyof Analyse["compteRendu"], valeur: string) {
    if (!analyse) return;
    setAnalyse({ ...analyse, compteRendu: { ...analyse.compteRendu, [cle]: valeur } });
  }

  function majActe(index: number, modif: Partial<ActeExtrait>) {
    if (!analyse) return;
    setAnalyse({ ...analyse, actes: analyse.actes.map((a, i) => (i === index ? { ...a, ...modif } : a)) });
  }

  function supprimerActe(index: number) {
    if (!analyse) return;
    setAnalyse({ ...analyse, actes: analyse.actes.filter((_, i) => i !== index) });
  }

  function ajouterActe() {
    if (!analyse) return;
    const derniereEtape = Math.max(0, ...analyse.actes.map((a) => a.etape));
    const nouvel: ActeExtrait = {
      etape: derniereEtape || 1,
      code: TARIFS[0].code,
      dents: [],
      quantite: 1,
      statut: "propose",
      precision: "",
    };
    setAnalyse({ ...analyse, actes: [...analyse.actes, nouvel] });
  }

  function imprimer(doc: "cr" | "devis") {
    setAImprimer(doc);
    setTimeout(() => window.print(), 50);
  }

  async function copier() {
    if (!analyse) return;
    const lignesActes = (lignes: LigneDevis[]) =>
      lignes
        .map((l) => `- ${l.acte.code} ${l.acte.libelle}${l.dents.length ? ` (dent ${l.dents.join(", ")})` : ""}`)
        .join("\n");
    const contenu = [
      ...RUBRIQUES.map((r) => `${r.titre.toUpperCase()}\n${analyse.compteRendu[r.cle]}`),
      realises.length ? `ACTES RÉALISÉS\n${lignesActes(realises)}` : "",
      proposes.length ? `ACTES PROPOSÉS\n${lignesActes(proposes)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(contenu);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function deconnexion() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
  }

  const occupe = ecoute.actif || simulation !== null;

  return (
    <>
      <div className="no-print mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-5 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="flex flex-col leading-none"><span className="font-display text-xl font-extrabold tracking-tight text-[#1b2340]">Émail</span><span className="mt-1 hidden text-xs text-slate-500 sm:block">Dictée et devis dentaires</span></span>
          </div>
          <nav className="flex gap-1 text-sm">
            <button onClick={() => setReglagesOuverts((o) => !o)} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-white">
              Cabinet
            </button>
            <button onClick={deconnexion} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-white">
              Déconnexion
            </button>
          </nav>
        </header>

        {reglagesOuverts && (
          <section className="mb-6 grid gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">Cabinet (en-tête des documents)</h2>
            {(
              [
                ["praticien", "Praticien (ex. Marie Dupont)"],
                ["adresse", "Adresse du cabinet"],
                ["telephone", "Téléphone"],
                ["rpps", "N° RPPS"],
                ["finess", "N° FINESS de l'établissement"],
              ] as const
            ).map(([cle, label]) => (
              <Champ key={cle} label={label} value={cabinet[cle]} onChange={(v) => majCabinet({ ...cabinet, [cle]: v })} />
            ))}
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-12">
          <CarteEcoute
            ecoute={ecoute}
            texte={texte}
            simulation={simulation}
            onDemarrer={demarrer}
            onTerminer={terminer}
            onSimuler={simuler}
          />

          <CarteDevis
            patient={patient}
            date={date}
            ecouteActive={occupe}
            chiffrage={chiffrage}
            analyse={analyse}
            realises={realises}
            proposes={proposes}
            copie={copie}
            onImprimer={imprimer}
            onCopier={copier}
            identiteOuverte={identiteOuverte}
            onIdentite={() => setIdentiteOuverte((o) => !o)}
          >
            {identiteOuverte && (
              <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
                <Champ label="Nom et prénom" value={patient.nom} onChange={(v) => setPatient({ ...patient, nom: v })} />
                <Champ label="N° de sécurité sociale" value={patient.secu} onChange={(v) => setPatient({ ...patient, secu: v })} />
                <Champ label="Date de naissance" type="date" value={patient.naissance} onChange={(v) => setPatient({ ...patient, naissance: v })} />
                <Champ label="Date de la séance" type="date" value={date} onChange={setDate} />
                <p className="text-xs text-slate-500 sm:col-span-2">
                  Ces informations servent uniquement à l&apos;impression : elles ne sont ni envoyées à l&apos;IA ni enregistrées.
                </p>
              </div>
            )}
          </CarteDevis>
        </div>

        {(erreur || ecoute.erreur) && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{erreur ?? ecoute.erreur}</p>
        )}

        <section className="mt-5 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
              {(
                [
                  ["cr", "Compte rendu"],
                  ["actes", "Détail des actes"],
                  ["texte", "Transcription"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setOnglet(id)}
                  className={`rounded-lg px-4 py-1.5 ${onglet === id ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Tout est modifiable avant impression.</p>
          </div>

          <div className="p-5">
            {demo && (
              <p className="mb-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
                <strong>Mode démo :</strong> aucune clé d&apos;IA n&apos;est configurée, le résultat est fictif.{" "}
                {demo === "exact"
                  ? "Il correspond à la consultation d'exemple choisie."
                  : "Le texte ne correspond à aucun exemple : le premier cas fictif est affiché."}
              </p>
            )}

            {analyse && (analyse.pointsAVerifier.length > 0 || analyse.actesNonReconnus.length > 0) && onglet !== "texte" && (
              <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <p className="font-medium">À vérifier</p>
                <ul className="list-disc pl-5">
                  {analyse.pointsAVerifier.map((p, i) => (
                    <li key={`p${i}`}>{p}</li>
                  ))}
                  {analyse.actesNonReconnus.map((p, i) => (
                    <li key={`n${i}`}>Acte absent de la grille, non chiffré : {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {onglet === "texte" ? (
              <OngletTexte
                texte={texte}
                occupe={occupe}
                chiffrage={chiffrage}
                onChange={(v) => {
                  texteRef.current = v;
                  setTexte(v);
                }}
                onChiffrer={() => chiffrer(texteRef.current)}
              />
            ) : !analyse ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Démarrez une consultation, ou tapez un texte dans l&apos;onglet Transcription.
              </p>
            ) : onglet === "cr" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {RUBRIQUES.map((r) => (
                  <label key={r.cle} className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">{r.titre}</span>
                    <textarea
                      value={analyse.compteRendu[r.cle]}
                      onChange={(e) => majRubrique(r.cle, e.target.value)}
                      rows={Math.max(2, Math.ceil(analyse.compteRendu[r.cle].length / 60))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 leading-relaxed focus:border-[#4655d8] focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <EditeurActes
                actes={analyse.actes}
                onChange={majActe}
                onDelete={supprimerActe}
                onAdd={ajouterActe}
                realises={realises}
                proposes={proposes}
              />
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          Prototype : grille tarifaire en partie simulée. Ne prononcez pas l&apos;identité du patient pendant l&apos;écoute.
        </p>
      </div>

      {analyse && (
        <div className="print-only text-black">
          {aImprimer === "cr" ? (
            <div className="text-[11pt]">
              <EnTete cabinet={cabinet} patient={patient.nom} date={date} titre="Compte rendu de consultation" />
              <CompteRenduImprimable analyse={analyse} realises={realises} />
            </div>
          ) : (
            <DevisConventionnel lignes={proposes} cabinet={cabinet} patient={patient} date={date} numero={numeroDevis} />
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" className="shrink-0" role="img" aria-label="Émail">
      <circle cx="32" cy="32" r="30" fill="#1b2340" />
      <path d="M18 24a16 16 0 0 1 14-10" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M16 36c4 0 4-8 8-8s4 14 8 14 4-18 8-18 4 12 8 12"
        fill="none"
        stroke="#a9b4ff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Champ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-[#4655d8] focus:outline-none"
      />
    </label>
  );
}

function Pastille({ ton, children }: { ton: "ecoute" | "calcul" | "pret" | "neutre"; children: React.ReactNode }) {
  const styles = {
    ecoute: "bg-red-50 text-red-700 ring-red-200",
    calcul: "bg-[#ecedfe] text-[#2f3aa6] ring-[#d5d9fb]",
    pret: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    neutre: "bg-slate-100 text-slate-600 ring-slate-200",
  }[ton];
  const point = {
    ecoute: "bg-red-500 animate-pulse",
    calcul: "bg-[#4655d8] animate-pulse",
    pret: "bg-emerald-500",
    neutre: "bg-slate-400",
  }[ton];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ring-1 ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${point}`} />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

type Ecoute = ReturnType<typeof useEcoute>;

function CarteEcoute({
  ecoute,
  texte,
  simulation,
  onDemarrer,
  onTerminer,
  onSimuler,
}: {
  ecoute: Ecoute;
  texte: string;
  simulation: string | null;
  onDemarrer: () => void;
  onTerminer: () => void;
  onSimuler: (id: string) => void;
}) {
  const [maintenant, setMaintenant] = useState(0);
  const [historique, setHistorique] = useState<number[]>(() => Array(32).fill(0));
  const [reglages, setReglages] = useState(false);
  const [cas, setCas] = useState(CAS_DEMO[0].id);
  const zoneTexteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ecoute.actif) return;
    const id = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ecoute.actif]);

  useEffect(() => {
    queueMicrotask(() => setHistorique((h) => [...h.slice(1), ecoute.niveau]));
  }, [ecoute.niveau]);

  useEffect(() => {
    const zone = zoneTexteRef.current;
    if (zone) zone.scrollTop = zone.scrollHeight;
  }, [texte]);

  const secondes = ecoute.debut && maintenant ? Math.max(0, Math.floor((maintenant - ecoute.debut) / 1000)) : 0;
  const chrono = `${String(Math.floor(secondes / 60)).padStart(2, "0")}:${String(secondes % 60).padStart(2, "0")}`;
  const enCours = ecoute.actif || simulation !== null;
  const dictee = ecoute.mode === "dictee";

  let titre: React.ReactNode = (
    <>
      Parlez normalement.
      <br />
      <span className="text-[#a9b4ff]">Le devis se remplit.</span>
    </>
  );
  if (simulation)
    titre = (
      <>
        Ça écoute,
        <br />
        <span className="text-[#a9b4ff]">ça code, ça chiffre.</span>
      </>
    );
  else if (ecoute.actif && dictee)
    titre = ecoute.enregistre ? (
      <>
        Je vous écoute.
        <br />
        <span className="text-[#a9b4ff]">Remettez la sourdine pour finir.</span>
      </>
    ) : (
      <>
        En veille.
        <br />
        <span className="text-[#a9b4ff]">Coupez la sourdine pour dicter.</span>
      </>
    );
  else if (ecoute.actif)
    titre = (
      <>
        Ça écoute,
        <br />
        <span className="text-[#a9b4ff]">ça code, ça chiffre.</span>
      </>
    );

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#1b2340] p-6 text-white shadow-lg sm:p-8 lg:col-span-7">

      <div className="relative flex items-center justify-between gap-3">
        {enCours ? (
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            {simulation ? "Simulation" : ecoute.enregistre || !dictee ? "Écoute en cours" : "En veille"}
            {ecoute.actif && <span className="tabular-nums text-white/60">{chrono}</span>}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-[#a9b4ff]" />
            Prêt
          </span>
        )}
        {ecoute.enTranscription > 0 && <span className="text-xs text-white/60">Transcription…</span>}
      </div>

      <h1 className="relative mt-6 font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">{titre}</h1>

      <div className="relative mt-6 flex h-12 items-end gap-1" aria-hidden>
        {historique.map((v, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full transition-[height] duration-100 ${v > ecoute.seuil ? "bg-[#a9b4ff]" : "bg-white/20"}`}
            style={{ height: `${Math.max(8, Math.min(100, (v / 0.08) * 100))}%` }}
          />
        ))}
      </div>

      <div
        ref={zoneTexteRef}
        className="relative mt-5 h-28 overflow-y-auto rounded-2xl bg-white/5 p-4 text-sm leading-relaxed text-white/85 ring-1 ring-white/10"
      >
        {texte ? <p>{texte}</p> : <p className="text-white/40">Le texte de la consultation s&apos;affichera ici au fil de l&apos;échange.</p>}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-3">
        {ecoute.actif ? (
          <button onClick={onTerminer} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1b2340] shadow hover:bg-[#ecedfe]">
            Terminer la consultation
          </button>
        ) : (
          <button
            onClick={onDemarrer}
            disabled={simulation !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4655d8] px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#3a48c4] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
            </svg>
            Démarrer la consultation
          </button>
        )}

        {!enCours && (
          <div className="flex rounded-xl bg-white/10 p-1 text-xs ring-1 ring-white/15">
            {(
              [
                ["consultation", "Consultation complète"],
                ["dictee", "Dictée (sourdine)"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => ecoute.choisirMode(id)}
                className={`rounded-lg px-3 py-1.5 ${ecoute.mode === id ? "bg-white font-medium text-[#1b2340]" : "text-white/75"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setReglages((r) => !r)} className="text-xs text-white/60 underline-offset-2 hover:underline">
          Micro et sensibilité
        </button>
      </div>

      {!enCours && ecoute.mode === "consultation" && (
        <p className="relative mt-3 text-xs text-white/55">
          Prévenez le patient que l&apos;échange est écouté pour rédiger son compte rendu.
        </p>
      )}

      {reglages && (
        <div className="relative mt-4 grid gap-3 rounded-2xl bg-white/5 p-4 text-sm ring-1 ring-white/10">
          {ecoute.micros.length > 0 && (
            <label className="flex flex-wrap items-center gap-3 text-white/75">
              Micro
              <select
                value={ecoute.micro}
                onChange={(e) => ecoute.choisirMicro(e.target.value)}
                disabled={ecoute.actif}
                className="max-w-full flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-white ring-1 ring-white/20 [&>option]:text-black"
              >
                <option value="">Micro par défaut</option>
                {ecoute.micros.map((m, i) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || `Micro ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-3 text-white/75">
            Sensibilité
            <input
              type="range"
              min={0.003}
              max={0.08}
              step={0.001}
              value={ecoute.seuil}
              onChange={(e) => ecoute.regler(Number(e.target.value))}
              className="flex-1 accent-[#a9b4ff]"
              style={{ direction: "rtl" }}
            />
          </label>
          <p className="text-xs text-white/50">
            Les barres s&apos;allument en bleu quand la voix est détectée. Micro en sourdine, elles doivent rester grises.
          </p>
        </div>
      )}

      {!enCours && (
        <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/60">
          Pas de micro sous la main ?
          <select
            value={cas}
            onChange={(e) => setCas(e.target.value)}
            className="rounded-lg bg-white/10 px-2 py-1 text-white ring-1 ring-white/20 [&>option]:text-black"
          >
            {CAS_DEMO.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titre}
              </option>
            ))}
          </select>
          <button
            onClick={() => onSimuler(cas)}
            className="rounded-lg bg-white/10 px-3 py-1 font-medium text-white ring-1 ring-white/20 hover:bg-white/20"
          >
            Simuler la consultation
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function CarteDevis({
  patient,
  date,
  ecouteActive,
  chiffrage,
  analyse,
  realises,
  proposes,
  copie,
  onImprimer,
  onCopier,
  identiteOuverte,
  onIdentite,
  children,
}: {
  patient: Patient;
  date: string;
  ecouteActive: boolean;
  chiffrage: boolean;
  analyse: Analyse | null;
  realises: LigneDevis[];
  proposes: LigneDevis[];
  copie: boolean;
  onImprimer: (doc: "cr" | "devis") => void;
  onCopier: () => void;
  identiteOuverte: boolean;
  onIdentite: () => void;
  children: React.ReactNode;
}) {
  const total = totaliser(proposes);
  const dateFr = date ? new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR") : "";
  const vide = !analyse || (proposes.length === 0 && realises.length === 0 && analyse.actesNonReconnus.length === 0);

  return (
    <section className="flex flex-col rounded-3xl bg-white shadow-lg ring-1 ring-slate-200 lg:col-span-5">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-[#1b2340]">Devis · Plan de traitement</p>
            <p className="text-xs text-slate-500">Consultation du {dateFr}</p>
          </div>
        </div>
        {chiffrage ? (
          <Pastille ton="calcul">Chiffrage…</Pastille>
        ) : ecouteActive ? (
          <Pastille ton="ecoute">Écoute en cours</Pastille>
        ) : analyse ? (
          <Pastille ton="pret">Prêt</Pastille>
        ) : (
          <Pastille ton="neutre">En attente</Pastille>
        )}
      </div>

      <div className="mx-5 mt-4">
        <button
          onClick={onIdentite}
          aria-expanded={identiteOuverte}
          className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-sm ring-1 ${
            patient.nom
              ? "bg-slate-50 text-[#1b2340] ring-slate-200 hover:bg-slate-100"
              : "bg-[#ecedfe] font-medium text-[#2f3aa6] ring-[#d5d9fb] hover:bg-[#e2e5fd]"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
              <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" />
            </svg>
            <span className="truncate">{patient.nom ? `Patient : ${patient.nom}` : "Ajouter l'identité du patient"}</span>
          </span>
          <span className="shrink-0 text-xs text-slate-500">{identiteOuverte ? "Fermer" : patient.nom ? "Modifier" : "Pour l'impression"}</span>
        </button>
      </div>
      <div className="mt-1">{children}</div>

      <div className="flex-1 px-5 pb-2 pt-3">
        <div className="mb-1 grid grid-cols-[6.5rem_1fr] gap-3 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
          <span>Code CCAM</span>
          <span>Acte</span>
        </div>

        {vide ? (
          <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-slate-200 px-6 text-center text-sm text-slate-400">
            {chiffrage ? "Chiffrage en cours…" : "Les actes apparaîtront ici pendant que vous parlez."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {proposes.map((l, i) => (
              <LigneActe key={`p-${l.acte.code}-${l.dents.join()}-${i}`} ligne={l} index={i} badge="chiffre" />
            ))}
            {analyse?.actesNonReconnus.map((n, i) => (
              <li key={`n-${i}`} className="apparition grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 py-3">
                <span className="rounded-lg bg-amber-50 px-2 py-1.5 text-center font-mono text-xs font-semibold text-amber-800">?</span>
                <span className="text-sm text-slate-700">{n}</span>
                <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">À coter</span>
              </li>
            ))}
            {realises.length > 0 && (
              <li className="pb-1 pt-4 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Réalisé aujourd&apos;hui</li>
            )}
            {realises.map((l, i) => (
              <LigneActe key={`r-${l.acte.code}-${l.dents.join()}-${i}`} ligne={l} index={proposes.length + i} badge="realise" />
            ))}
          </ul>
        )}
      </div>

      {proposes.length > 0 && (
        <div className="mx-5 mb-4 mt-2 flex items-end justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Total du devis</p>
            <p className="font-mono text-2xl font-semibold tracking-tight text-[#1b2340] tabular-nums">{euros(total.honoraires)}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Remb. Sécu : {euros(total.remboursementAMO)}</p>
            <p>Reste avant mutuelle : {euros(total.resteACharge)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
        <button
          onClick={() => onImprimer("devis")}
          disabled={proposes.length === 0}
          className="rounded-xl bg-[#1b2340] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a3560] disabled:opacity-40"
        >
          Imprimer le devis
        </button>
        <button
          onClick={() => onImprimer("cr")}
          disabled={!analyse}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
        >
          Compte rendu
        </button>
        <button
          onClick={onCopier}
          disabled={!analyse}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
        >
          {copie ? "Copié ✓" : "Copier le texte"}
        </button>
      </div>
    </section>
  );
}

function LigneActe({ ligne, index, badge }: { ligne: LigneDevis; index: number; badge: "chiffre" | "realise" }) {
  return (
    <li className="apparition grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 py-3" style={{ animationDelay: `${index * 120}ms` }}>
      <span className="rounded-lg bg-[#ecedfe] px-2 py-1.5 text-center font-mono text-xs font-semibold tracking-wide text-[#2f3aa6]">
        {ligne.acte.code}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-[#1b2340]">{ligne.acte.libelle}</span>
        <span className="block text-xs text-slate-500">
          {ligne.dents.length ? `Dent ${ligne.dents.join(", ")} · ` : ligne.quantite > 1 ? `×${ligne.quantite} · ` : ""}
          {euros(ligne.honoraires)}
        </span>
      </span>
      {badge === "chiffre" ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
            />
          </svg>
          Chiffré
        </span>
      ) : (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Réalisé</span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

function OngletTexte({
  texte,
  occupe,
  chiffrage,
  onChange,
  onChiffrer,
}: {
  texte: string;
  occupe: boolean;
  chiffrage: boolean;
  onChange: (v: string) => void;
  onChiffrer: () => void;
}) {
  return (
    <div className="text-sm">
      <textarea
        value={texte}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        disabled={occupe}
        placeholder="La transcription de la consultation apparaît ici. Vous pouvez aussi taper, coller ou corriger le texte, puis le chiffrer."
        className="w-full rounded-xl border border-slate-200 px-3 py-2 leading-relaxed focus:border-[#4655d8] focus:outline-none disabled:bg-slate-50"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={onChiffrer}
          disabled={occupe || chiffrage || !texte.trim()}
          className="rounded-xl bg-[#1b2340] px-4 py-2 font-semibold text-white hover:bg-[#2a3560] disabled:opacity-40"
        >
          {chiffrage ? "Chiffrage…" : "Chiffrer ce texte"}
        </button>
        <select
          value=""
          onChange={(e) => {
            const cas = CAS_DEMO.find((c) => c.id === e.target.value);
            if (cas) onChange(cas.dictee);
          }}
          disabled={occupe}
          className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600"
        >
          <option value="">Charger un texte d&apos;exemple…</option>
          {CAS_DEMO.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titre}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
