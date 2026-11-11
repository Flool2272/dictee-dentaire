"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Dictaphone from "@/components/Dictaphone";
import type { ActeExtrait, Analyse } from "@/lib/schema";
import { TARIFS, numeroPanier } from "@/lib/tarifs";
import { CAS_DEMO } from "@/lib/demo";
import { calculerLignes, euros, totaliser, type LigneDevis } from "@/lib/devis";

type Cabinet = { praticien: string; adresse: string; telephone: string; rpps: string; finess: string };
const CABINET_VIDE: Cabinet = { praticien: "", adresse: "", telephone: "", rpps: "", finess: "" };

// Identité du patient : saisie et imprimée localement, jamais envoyée à l'IA ni stockée.
type Patient = { nom: string; naissance: string; secu: string };

const RUBRIQUES: { cle: keyof Analyse["compteRendu"]; titre: string }[] = [
  { cle: "motif", titre: "Motif de consultation" },
  { cle: "antecedents", titre: "Antécédents" },
  { cle: "examenClinique", titre: "Examen clinique" },
  { cle: "examensComplementaires", titre: "Examens complémentaires" },
  { cle: "diagnostic", titre: "Diagnostic" },
  { cle: "soinsRealises", titre: "Soins réalisés" },
  { cle: "planTraitement", titre: "Plan de traitement" },
  { cle: "conseils", titre: "Conseils au patient" },
];

function lireCabinet(): Cabinet {
  try {
    const brut = localStorage.getItem("cabinet");
    return brut ? { ...CABINET_VIDE, ...JSON.parse(brut) } : CABINET_VIDE;
  } catch {
    return CABINET_VIDE;
  }
}

export default function Accueil() {
  const router = useRouter();
  const [cabinet, setCabinet] = useState<Cabinet>(CABINET_VIDE);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [patient, setPatient] = useState<Patient>({ nom: "", naissance: "", secu: "" });
  const [numeroDevis, setNumeroDevis] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dictee, setDictee] = useState("");
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"cr" | "devis">("cr");
  const [aImprimer, setAImprimer] = useState<"cr" | "devis">("cr");
  const [copie, setCopie] = useState(false);
  const [demo, setDemo] = useState<"exact" | "approx" | null>(null);

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

  async function generer() {
    setErreur(null);
    setChargement(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictee }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? "Échec de la génération");
        return;
      }
      const { demo: estDemo, ...resultat } = data;
      setDemo(estDemo === "exact" || estDemo === "approx" ? estDemo : null);
      setAnalyse(resultat as Analyse);
      setNumeroDevis(`${date.replaceAll("-", "")}-${Math.floor(1000 + Math.random() * 9000)}`);
      setOnglet("cr");
    } finally {
      setChargement(false);
    }
  }

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
    const actes = analyse.actes.map((a, i) => (i === index ? { ...a, ...modif } : a));
    setAnalyse({ ...analyse, actes });
  }

  function supprimerActe(index: number) {
    if (!analyse) return;
    setAnalyse({ ...analyse, actes: analyse.actes.filter((_, i) => i !== index) });
  }

  function ajouterActe() {
    if (!analyse) return;
    const derniereEtape = Math.max(0, ...analyse.actes.map((a) => a.etape));
    const nouvel: ActeExtrait = { etape: derniereEtape || 1, code: TARIFS[0].code, dents: [], quantite: 1, statut: "propose", precision: "" };
    setAnalyse({ ...analyse, actes: [...analyse.actes, nouvel] });
  }

  function imprimer(doc: "cr" | "devis") {
    setAImprimer(doc);
    // Laisse React afficher le bon document avant d'ouvrir la boîte d'impression.
    setTimeout(() => window.print(), 50);
  }

  async function copierPourLogiciel() {
    if (!analyse) return;
    const lignesActes = (lignes: LigneDevis[]) =>
      lignes
        .map((l) => `- ${l.acte.code} ${l.acte.libelle}${l.dents.length ? ` (dent ${l.dents.join(", ")})` : ""}`)
        .join("\n");
    const texte = [
      ...RUBRIQUES.map((r) => `${r.titre.toUpperCase()}\n${analyse.compteRendu[r.cle]}`),
      realises.length ? `ACTES RÉALISÉS\n${lignesActes(realises)}` : "",
      proposes.length ? `ACTES PROPOSÉS\n${lignesActes(proposes)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(texte);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function deconnexion() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <>
      <div className="no-print mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Dictée dentaire</h1>
            <p className="text-sm text-slate-500">Compte rendu et devis à partir de votre dictée</p>
          </div>
          <div className="flex gap-2 text-sm">
            <button onClick={() => setReglagesOuverts((o) => !o)} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-200">
              Cabinet
            </button>
            <button onClick={deconnexion} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-200">
              Déconnexion
            </button>
          </div>
        </header>

        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Prototype.</strong> La grille tarifaire est en partie simulée : seuls les actes repris du devis du cabinet
          ont des montants réels. Ne dictez pas l&apos;identité du patient : saisissez-la dans les champs prévus, elle reste
          dans le navigateur et n&apos;est pas envoyée à l&apos;IA.
        </div>

        {reglagesOuverts && (
          <section className="mb-6 grid gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
            <h2 className="font-medium sm:col-span-2">En-tête des documents</h2>
            {(
              [
                ["praticien", "Praticien (ex. Dr Marie Dupont)"],
                ["adresse", "Adresse du cabinet"],
                ["telephone", "Téléphone"],
                ["rpps", "N° RPPS"],
                ["finess", "N° FINESS de l'établissement"],
              ] as const
            ).map(([cle, label]) => (
              <label key={cle} className="text-sm">
                <span className="mb-1 block text-slate-600">{label}</span>
                <input
                  value={cabinet[cle]}
                  onChange={(e) => majCabinet({ ...cabinet, [cle]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            ))}
          </section>
        )}

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["nom", "Nom et prénom du patient", "text"],
                ["naissance", "Date de naissance", "date"],
                ["secu", "N° de sécurité sociale", "text"],
              ] as const
            ).map(([cle, label, type]) => (
              <label key={cle} className="text-sm">
                <span className="mb-1 block text-slate-600">
                  {label} <span className="text-slate-400">(non envoyé à l&apos;IA)</span>
                </span>
                <input
                  type={type}
                  value={patient[cle]}
                  onChange={(e) => setPatient({ ...patient, [cle]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            ))}
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date de la séance</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Dictaphone onTranscription={(t) => setDictee((d) => (d ? `${d}\n${t}` : t))} />
            <select
              value=""
              onChange={(e) => {
                const cas = CAS_DEMO.find((c) => c.id === e.target.value);
                if (cas) setDictee(cas.dictee);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-teal-800"
            >
              <option value="">Charger une dictée d&apos;exemple…</option>
              {CAS_DEMO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titre}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={dictee}
            onChange={(e) => setDictee(e.target.value)}
            rows={7}
            placeholder="La transcription de votre dictée apparaît ici. Vous pouvez aussi taper ou corriger le texte."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={generer}
              disabled={chargement || !dictee.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {chargement ? "Rédaction en cours..." : "Générer le compte rendu et le devis"}
            </button>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          </div>
        </section>

        {analyse && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
                {(
                  [
                    ["cr", "Compte rendu"],
                    ["devis", "Actes et devis"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setOnglet(id)}
                    className={`rounded-md px-3 py-1.5 ${onglet === id ? "bg-white shadow-sm" : "text-slate-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <button onClick={copierPourLogiciel} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                  {copie ? "Copié ✓" : "Copier pour LogosW"}
                </button>
                <button onClick={() => imprimer("cr")} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
                  PDF compte rendu
                </button>
                <button
                  onClick={() => imprimer("devis")}
                  disabled={proposes.length === 0}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                >
                  PDF devis
                </button>
              </div>
            </div>

            {demo && (
              <div className="mb-5 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">
                <strong>Mode démo :</strong> aucune clé d&apos;IA n&apos;est configurée, ce résultat est fictif.{" "}
                {demo === "exact"
                  ? "Il correspond à la dictée d'exemple choisie."
                  : "Le texte saisi ne correspond à aucun exemple : le premier cas fictif est affiché à la place."}{" "}
                Le calcul du devis, les modifications et les PDF fonctionnent normalement.
              </div>
            )}

            {(analyse.pointsAVerifier.length > 0 || analyse.actesNonReconnus.length > 0) && (
              <div className="mb-5 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-900 ring-1 ring-orange-200">
                {analyse.pointsAVerifier.length > 0 && (
                  <>
                    <p className="font-medium">À vérifier</p>
                    <ul className="mb-2 list-disc pl-5">
                      {analyse.pointsAVerifier.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                )}
                {analyse.actesNonReconnus.length > 0 && (
                  <>
                    <p className="font-medium">Actes absents de la grille (non chiffrés)</p>
                    <ul className="list-disc pl-5">
                      {analyse.actesNonReconnus.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {onglet === "cr" ? (
              <div className="grid gap-4">
                {RUBRIQUES.map((r) => (
                  <label key={r.cle} className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">{r.titre}</span>
                    <textarea
                      value={analyse.compteRendu[r.cle]}
                      onChange={(e) => majRubrique(r.cle, e.target.value)}
                      rows={Math.max(2, Math.ceil(analyse.compteRendu[r.cle].length / 90))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 leading-relaxed"
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
          </section>
        )}
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

function EditeurActes({
  actes,
  onChange,
  onDelete,
  onAdd,
  realises,
  proposes,
}: {
  actes: ActeExtrait[];
  onChange: (i: number, modif: Partial<ActeExtrait>) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  realises: LigneDevis[];
  proposes: LigneDevis[];
}) {
  return (
    <div className="text-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-2 font-medium" title="Numéro d'étape du traitement">Étape</th>
              <th className="py-2 pr-2 font-medium">Acte</th>
              <th className="py-2 pr-2 font-medium">Dents</th>
              <th className="py-2 pr-2 font-medium">Statut</th>
              <th className="py-2 pr-2 font-medium">Précision</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {actes.map((a, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={1}
                    value={a.etape}
                    onChange={(e) => onChange(i, { etape: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-14 rounded border border-slate-300 px-2 py-1"
                    aria-label="Étape"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select value={a.code} onChange={(e) => onChange(i, { code: e.target.value })} className="w-full max-w-xs rounded border border-slate-300 px-2 py-1">
                    {TARIFS.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.code} · {t.libelle}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={a.dents.join(", ")}
                    onChange={(e) =>
                      onChange(i, { dents: e.target.value.split(/[,\s]+/).filter(Boolean) })
                    }
                    placeholder="ex. 36, 37"
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select value={a.statut} onChange={(e) => onChange(i, { statut: e.target.value as ActeExtrait["statut"] })} className="rounded border border-slate-300 px-2 py-1">
                    <option value="realise">Réalisé</option>
                    <option value="propose">Proposé (devis)</option>
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input value={a.precision} onChange={(e) => onChange(i, { precision: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1" />
                </td>
                <td className="py-2">
                  <button onClick={() => onDelete(i)} className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer l'acte">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="mt-3 text-teal-700 hover:underline">
        + Ajouter un acte
      </button>

      <h3 className="mb-2 mt-6 font-medium">Devis (actes proposés)</h3>
      <TableauMontants lignes={proposes} />
      {realises.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 font-medium">Actes réalisés pendant la séance</h3>
          <TableauMontants lignes={realises} />
        </>
      )}
    </div>
  );
}

function TableauMontants({ lignes }: { lignes: LigneDevis[] }) {
  if (lignes.length === 0) return <p className="text-slate-500">Aucun acte.</p>;
  const t = totaliser(lignes);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[0.95em]">
        <thead>
          <tr className="border-b border-slate-300 text-left">
            <th className="py-1.5 pr-2 font-medium">Code</th>
            <th className="py-1.5 pr-2 font-medium">Acte</th>
            <th className="py-1.5 pr-2 font-medium">Dents</th>
            <th className="py-1.5 pr-2 font-medium">Panier</th>
            <th className="py-1.5 pr-2 text-right font-medium">Honoraires</th>
            <th className="py-1.5 pr-2 text-right font-medium">Base remb.</th>
            <th className="py-1.5 pr-2 text-right font-medium">Remb. AMO</th>
            <th className="py-1.5 text-right font-medium">Reste*</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 font-mono text-xs">{l.acte.code}</td>
              <td className="py-1.5 pr-2">
                {l.acte.libelle}
                {l.precision && <span className="block text-xs text-slate-500">{l.precision}</span>}
              </td>
              <td className="py-1.5 pr-2">{l.dents.join(", ") || (l.quantite > 1 ? `×${l.quantite}` : "")}</td>
              <td className="py-1.5 pr-2">{l.acte.panier}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{euros(l.honoraires)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{euros(l.baseRemboursement)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{euros(l.remboursementAMO)}</td>
              <td className="py-1.5 text-right tabular-nums">{euros(l.resteACharge)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={4} className="py-2 pr-2">
              Total
            </td>
            <td className="py-2 pr-2 text-right tabular-nums">{euros(t.honoraires)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{euros(t.baseRemboursement)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{euros(t.remboursementAMO)}</td>
            <td className="py-2 text-right tabular-nums">{euros(t.resteACharge)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-1 text-xs text-slate-500">
        * Reste à charge avant remboursement de la complémentaire santé.
      </p>
    </div>
  );
}

function EnTete({ cabinet, patient, date, titre }: { cabinet: Cabinet; patient: string; date: string; titre: string }) {
  const dateFr = date ? new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR") : "";
  return (
    <div className="mb-6">
      <div className="flex justify-between border-b border-black pb-3">
        <div>
          <p className="font-semibold">{cabinet.praticien || "Praticien"}</p>
          <p>Chirurgien-dentiste</p>
          {cabinet.adresse && <p>{cabinet.adresse}</p>}
          {cabinet.telephone && <p>Tél. {cabinet.telephone}</p>}
          {cabinet.rpps && <p>RPPS {cabinet.rpps}</p>}
        </div>
        <div className="text-right">
          <p>Le {dateFr}</p>
          {patient && <p className="mt-2">Patient : {patient}</p>}
        </div>
      </div>
      <h1 className="mt-5 text-center text-lg font-semibold">{titre}</h1>
    </div>
  );
}

function CompteRenduImprimable({ analyse, realises }: { analyse: Analyse; realises: LigneDevis[] }) {
  return (
    <div className="space-y-3">
      {RUBRIQUES.map((r) => (
        <div key={r.cle} className="break-inside-avoid">
          <h2 className="font-semibold">{r.titre}</h2>
          <p className="whitespace-pre-wrap">{analyse.compteRendu[r.cle]}</p>
        </div>
      ))}
      {realises.length > 0 && (
        <div className="break-inside-avoid">
          <h2 className="font-semibold">Actes réalisés</h2>
          <ul className="list-disc pl-5">
            {realises.map((l, i) => (
              <li key={i}>
                {l.acte.code} · {l.acte.libelle}
                {l.dents.length > 0 && ` (dent ${l.dents.join(", ")})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const montant = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFr = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR") : "");

/** Devis au format du modèle conventionnel utilisé par le cabinet. */
function DevisConventionnel({
  lignes,
  cabinet,
  patient,
  date,
  numero,
}: {
  lignes: LigneDevis[];
  cabinet: Cabinet;
  patient: Patient;
  date: string;
  numero: string;
}) {
  const t = totaliser(lignes);
  const th = "border border-black px-1 py-0.5 text-center align-middle font-normal";
  const td = "border border-black px-1 py-0.5";
  const num = `${td} text-right tabular-nums`;
  return (
    <div className="page-devis text-[8.5pt] leading-tight">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="flex-1 border border-black px-2 py-1 text-center">
          <p className="font-semibold">
            DEVIS POUR LES TRAITEMENTS ET ACTES BUCCO-DENTAIRES FAISANT L&apos;OBJET D&apos;UNE ENTENTE DIRECTE
          </p>
          <p>conformément aux dispositions de la convention nationale des chirurgiens-dentistes</p>
        </div>
        <div className="text-right">
          <p>Devis {numero}</p>
          <p>Établi le {dateFr(date)}</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 border border-black">
        <div className="border-r border-black px-2 py-1">
          <p className="font-semibold">Identification du chirurgien-dentiste traitant</p>
          <p>Docteur {cabinet.praticien}</p>
          <p>
            Identifiant du praticien : N° RPPS : {cabinet.rpps} - N° de l&apos;établissement (FINESS) : {cabinet.finess}
          </p>
          {cabinet.adresse && <p>{cabinet.adresse}</p>}
        </div>
        <div className="px-2 py-1">
          <p className="font-semibold">Identification du patient</p>
          <p>Nom et prénom : {patient.nom}</p>
          <p>Date de naissance : {dateFr(patient.naissance)}</p>
          <p>N° de sécurité sociale du patient : {patient.secu}</p>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th colSpan={11} className={`${td} text-left`}>
              <span className="text-[10pt] font-semibold">Traitement proposé</span> – Description précise et détaillée des
              actes
            </th>
          </tr>
          <tr>
            <th className={th}>N° de traitement</th>
            <th className={th}>N° dent ou localisation</th>
            <th className={th}>Cotation CCAM, NGAP ou acte HN</th>
            <th className={`${th} w-[28%]`}>Nature de l&apos;acte</th>
            <th className={th}>Matériaux utilisés</th>
            <th className={th}>Panier</th>
            <th className={th}>Honoraires limite de facturation</th>
            <th className={th}>Base de remboursement de l&apos;Assurance Maladie Obligatoire</th>
            <th className={th}>Montant remboursé Assurance Maladie Obligatoire</th>
            <th className={th}>Montant non remboursé Assurance Maladie Obligatoire</th>
            <th className={th}>Honoraires dt prix de vente du dispositif médical sur mesure</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const remboursable = l.acte.tauxAMO > 0;
            return (
              <tr key={i}>
                <td className={`${td} text-center`}>{l.etape}</td>
                <td className={`${td} text-center`}>{l.dents.join(", ") || (l.quantite > 1 ? `×${l.quantite}` : "")}</td>
                <td className={td}>{l.acte.code}</td>
                <td className={td}>
                  {l.acte.libelle}
                  {l.precision && <span className="block italic">{l.precision}</span>}
                </td>
                <td className={`${td} text-center`}>{l.acte.materiau ?? ""}</td>
                <td className={`${td} text-center`}>{numeroPanier(l.acte.panier)}</td>
                <td className={num}>{l.acte.limite !== undefined ? montant(l.acte.limite * l.quantite) : ""}</td>
                <td className={num}>{remboursable ? montant(l.baseRemboursement) : "NR"}</td>
                <td className={num}>{montant(l.remboursementAMO)}</td>
                <td className={num}>{montant(l.resteACharge)}</td>
                <td className={num}>{montant(l.honoraires)}</td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td colSpan={7} className={`${td} text-right`}>
              TOTAL € (des actes envisagés)
            </td>
            <td className={num}>{montant(t.baseRemboursement)}</td>
            <td className={num}>{montant(t.remboursementAMO)}</td>
            <td className={num}>{montant(t.resteACharge)}</td>
            <td className={num}>{montant(t.honoraires)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1">
        Panier : 1 = 100 % santé (sans reste à charge), 2 = tarifs maîtrisés, 3 = tarifs libres. NR = non remboursable.
        Devis valable 6 mois.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div className="h-28 border border-black px-2 py-1">
          <p>Le patient ou son représentant légal reconnaît avoir eu la possibilité du choix de son traitement.</p>
          <p>Date et signature du patient ou du (ou des) responsable(s) légal (légaux)</p>
        </div>
        <div className="h-28 border border-black px-2 py-1">
          <p>Signature du chirurgien-dentiste</p>
        </div>
      </div>
    </div>
  );
}
