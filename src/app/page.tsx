"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Dictaphone from "@/components/Dictaphone";
import type { ActeExtrait, Analyse } from "@/lib/schema";
import { TARIFS } from "@/lib/tarifs";
import { calculerLignes, euros, totaliser, type LigneDevis } from "@/lib/devis";

type Cabinet = { praticien: string; adresse: string; telephone: string; rpps: string };
const CABINET_VIDE: Cabinet = { praticien: "", adresse: "", telephone: "", rpps: "" };

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

const EXEMPLE =
  "Patient de 42 ans venu pour une douleur au froid en bas à gauche depuis une semaine. Pas d'antécédent particulier, " +
  "pas d'allergie connue. À l'examen, carie occluso-distale sur la 36, test au froid positif mais douleur brève, pas de " +
  "douleur à la percussion. Rétro-alvéolaire sur la 36 : carie proche de la pulpe sans atteinte. Tartre important au bloc " +
  "incisivo-canin mandibulaire. Aujourd'hui j'ai fait le détartrage complet et un composite deux faces sur la 36. " +
  "La 46 est très délabrée, déjà dévitalisée, il faudra faire un inlay-core et une couronne céramo-céramique. " +
  "Je propose aussi une couronne zircone sur la 25 qui est fracturée. Conseils : brossage trois fois par jour, " +
  "brossettes interdentaires, revoir dans quinze jours.";

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
  const [patient, setPatient] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dictee, setDictee] = useState("");
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"cr" | "devis">("cr");
  const [aImprimer, setAImprimer] = useState<"cr" | "devis">("cr");
  const [copie, setCopie] = useState(false);

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
      setAnalyse(data as Analyse);
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
    () => calculerLignes(analyse?.actes.filter((a) => a.statut === "propose") ?? []),
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
    const nouvel: ActeExtrait = { code: TARIFS[0].code, dents: [], quantite: 1, statut: "propose", precision: "" };
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
          <strong>Prototype.</strong> La grille tarifaire est simulée : codes et montants à remplacer par ceux du cabinet.
          Ne dictez pas le nom du patient. Saisissez-le dans le champ prévu : il reste dans le navigateur et n&apos;est pas
          envoyé à l&apos;IA.
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
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Patient (non envoyé à l&apos;IA)</span>
              <input value={patient} onChange={(e) => setPatient(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date de la séance</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Dictaphone onTranscription={(t) => setDictee((d) => (d ? `${d}\n${t}` : t))} />
            <button onClick={() => setDictee(EXEMPLE)} className="text-sm text-teal-700 underline-offset-2 hover:underline">
              Charger une dictée d&apos;exemple
            </button>
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
        <div className="print-only text-[11pt] text-black">
          <EnTete cabinet={cabinet} patient={patient} date={date} titre={aImprimer === "cr" ? "Compte rendu de consultation" : "Devis de soins et de prothèses dentaires"} />
          {aImprimer === "cr" ? (
            <CompteRenduImprimable analyse={analyse} realises={realises} />
          ) : (
            <DevisImprimable lignes={proposes} />
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

function DevisImprimable({ lignes }: { lignes: LigneDevis[] }) {
  return (
    <div>
      <TableauMontants lignes={lignes} />
      <p className="mt-4">Devis valable 6 mois à compter de sa date d&apos;émission.</p>
      <p className="mt-1 text-sm">
        Les montants remboursés sont estimés sur la base des tarifs de l&apos;Assurance maladie. Le remboursement de votre
        complémentaire santé dépend de votre contrat.
      </p>
      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <p>Signature du praticien</p>
          <div className="mt-16 border-t border-black" />
        </div>
        <div>
          <p>Bon pour accord, signature du patient</p>
          <div className="mt-16 border-t border-black" />
        </div>
      </div>
    </div>
  );
}
