import type { Analyse } from "@/lib/schema";
import { numeroPanier } from "@/lib/tarifs";
import { totaliser, type LigneDevis } from "@/lib/devis";
import { RUBRIQUES, type Cabinet, type Patient } from "@/lib/types";

export function EnTete({ cabinet, patient, date, titre }: { cabinet: Cabinet; patient: string; date: string; titre: string }) {
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

export function CompteRenduImprimable({ analyse, realises }: { analyse: Analyse; realises: LigneDevis[] }) {
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
export function DevisConventionnel({
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
