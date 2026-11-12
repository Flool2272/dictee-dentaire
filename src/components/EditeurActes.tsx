"use client";

import type { ActeExtrait } from "@/lib/schema";
import { TARIFS } from "@/lib/tarifs";
import { euros, totaliser, type LigneDevis } from "@/lib/devis";

export default function EditeurActes({
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
