import type { ActeExtrait } from "./schema";
import { trouverActe, type Acte } from "./tarifs";

export type LigneDevis = {
  etape: number;
  acte: Acte;
  dents: string[];
  quantite: number;
  precision: string;
  honoraires: number;
  baseRemboursement: number;
  remboursementAMO: number;
  resteACharge: number;
};

export type Totaux = {
  honoraires: number;
  baseRemboursement: number;
  remboursementAMO: number;
  resteACharge: number;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Les montants sont calculés ici à partir de la grille, jamais par l'IA. */
export function calculerLignes(actes: ActeExtrait[]): LigneDevis[] {
  const lignes: LigneDevis[] = [];
  for (const a of actes) {
    const acte = trouverActe(a.code);
    if (!acte) continue;
    const quantite = acte.parDent && a.dents.length > 0 ? a.dents.length : Math.max(1, a.quantite);
    const honoraires = arrondi(acte.honoraires * quantite);
    const baseRemboursement = arrondi(acte.baseRemboursement * quantite);
    const remboursementAMO = arrondi(baseRemboursement * acte.tauxAMO);
    lignes.push({
      etape: a.etape,
      acte,
      dents: a.dents,
      quantite,
      precision: a.precision,
      honoraires,
      baseRemboursement,
      remboursementAMO,
      resteACharge: arrondi(honoraires - remboursementAMO),
    });
  }
  return lignes;
}

export function totaliser(lignes: LigneDevis[]): Totaux {
  return lignes.reduce<Totaux>(
    (t, l) => ({
      honoraires: arrondi(t.honoraires + l.honoraires),
      baseRemboursement: arrondi(t.baseRemboursement + l.baseRemboursement),
      remboursementAMO: arrondi(t.remboursementAMO + l.remboursementAMO),
      resteACharge: arrondi(t.resteACharge + l.resteACharge),
    }),
    { honoraires: 0, baseRemboursement: 0, remboursementAMO: 0, resteACharge: 0 }
  );
}

export const euros = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
