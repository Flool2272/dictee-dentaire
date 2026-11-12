"use client";

import { useMemo, useState } from "react";
import { euros } from "@/lib/devis";
import { versCsv, type EntreeHistorique } from "@/lib/historique";

const dateFr = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR") : "");

export default function Historique({
  entrees,
  numeroCourant,
  onOuvrir,
  onSupprimer,
  onToutEffacer,
  onFermer,
}: {
  entrees: EntreeHistorique[];
  numeroCourant: string;
  onOuvrir: (e: EntreeHistorique) => void;
  onSupprimer: (numero: string) => void;
  onToutEffacer: () => void;
  onFermer: () => void;
}) {
  const [recherche, setRecherche] = useState("");

  const filtrees = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    if (!r) return entrees;
    return entrees.filter(
      (e) => e.patient.nom.toLowerCase().includes(r) || e.numero.includes(r) || dateFr(e.date).includes(r)
    );
  }, [entrees, recherche]);

  function exporter() {
    const blob = new Blob(["﻿" + versCsv(filtrees)], { type: "text/csv;charset=utf-8" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = `historique-devis-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  return (
    <section className="mb-6 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Historique des devis</h2>
          <p className="text-xs text-slate-500">
            {entrees.length} devis · conservés uniquement sur cet ordinateur, dans ce navigateur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (patient, date…)"
            aria-label="Rechercher dans l'historique"
            className="w-60 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#4655d8] focus:outline-none"
          />
          <button
            onClick={exporter}
            disabled={filtrees.length === 0}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
          >
            Exporter (Excel)
          </button>
          <button onClick={onFermer} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Fermer
          </button>
        </div>
      </div>

      {entrees.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-500">
          Aucun devis enregistré. Un devis est ajouté ici dès qu&apos;il est enregistré ou imprimé.
        </p>
      ) : filtrees.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-500">Aucun devis ne correspond à « {recherche} ».</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">Patient</th>
                <th className="px-2 py-2 font-semibold">N° devis</th>
                <th className="px-2 py-2 text-right font-semibold">Actes</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 font-semibold">État</th>
                <th className="px-6 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtrees.map((e) => (
                <tr key={e.numero} className={`border-t border-slate-100 ${e.numero === numeroCourant ? "bg-[#f4f5fe]" : ""}`}>
                  <td className="whitespace-nowrap px-6 py-3">{dateFr(e.date)}</td>
                  <td className="px-2 py-3 font-medium">{e.patient.nom || <span className="text-slate-400">Sans nom</span>}</td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-600">{e.numero}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{e.nbActes}</td>
                  <td className="px-2 py-3 text-right font-mono tabular-nums">{euros(e.totalDevis)}</td>
                  <td className="px-2 py-3">
                    {e.imprime ? (
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Imprimé</span>
                    ) : (
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Brouillon</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right">
                    <button
                      onClick={() => onOuvrir(e)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#4655d8] hover:bg-[#ecedfe]"
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer le devis ${e.numero}${e.patient.nom ? ` de ${e.patient.nom}` : ""} ?`)) onSupprimer(e.numero);
                      }}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Supprimer le devis ${e.numero}`}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entrees.length > 0 && (
        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button
            onClick={() => {
              if (window.confirm("Effacer tout l'historique de cet ordinateur ? Cette action est définitive.")) onToutEffacer();
            }}
            className="text-xs text-slate-500 hover:text-red-700"
          >
            Effacer tout l&apos;historique
          </button>
        </div>
      )}
    </section>
  );
}
