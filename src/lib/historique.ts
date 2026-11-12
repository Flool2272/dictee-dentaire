import type { Analyse } from "./schema";
import type { Patient } from "./types";

// Historique des devis, conservé UNIQUEMENT dans le navigateur de l'ordinateur utilisé
// (localStorage) : rien n'est envoyé au serveur. Il contient des données de santé :
// il reste sur ce poste et peut être effacé à tout moment.

export type EntreeHistorique = {
  numero: string;
  date: string; // date de la séance (AAAA-MM-JJ)
  enregistreLe: string; // horodatage ISO de la dernière sauvegarde
  patient: Patient;
  analyse: Analyse;
  totalDevis: number;
  nbActes: number;
  imprime: boolean;
};

const CLE = "historiqueDevis";
const MAX_ENTREES = 500;

export function lireHistorique(): EntreeHistorique[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrire(liste: EntreeHistorique[]): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste.slice(0, MAX_ENTREES)));
    return true;
  } catch {
    return false;
  }
}

/** Ajoute l'entrée, ou la remplace si ce numéro de devis existe déjà ; la plus récente en tête. */
export function enregistrer(entree: EntreeHistorique): EntreeHistorique[] {
  const anciennes = lireHistorique();
  const precedente = anciennes.find((e) => e.numero === entree.numero);
  const fusion = { ...entree, imprime: entree.imprime || Boolean(precedente?.imprime) };
  const liste = [fusion, ...anciennes.filter((e) => e.numero !== entree.numero)];
  ecrire(liste);
  return liste;
}

export function supprimer(numero: string): EntreeHistorique[] {
  const liste = lireHistorique().filter((e) => e.numero !== numero);
  ecrire(liste);
  return liste;
}

export function toutEffacer(): EntreeHistorique[] {
  ecrire([]);
  return [];
}

/** Export tableur (séparateur ; pour Excel en français). */
export function versCsv(liste: EntreeHistorique[]): string {
  const echapper = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lignes = liste.map((e) =>
    [
      e.numero,
      e.date,
      e.patient.nom,
      String(e.nbActes),
      e.totalDevis.toFixed(2).replace(".", ","),
      e.imprime ? "oui" : "non",
    ]
      .map(echapper)
      .join(";")
  );
  return ["N° devis;Date;Patient;Actes proposés;Total devis (€);Imprimé", ...lignes].join("\r\n");
}
