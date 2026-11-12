import type { Analyse } from "./schema";

export type Cabinet = { praticien: string; adresse: string; telephone: string; rpps: string; finess: string };

// En-tête par défaut du cabinet, utilisé quand rien n'a été saisi dans « Cabinet ».
// Valeurs FICTIVES en attendant les vraies : elles peuvent être remplacées sans toucher
// au code par les variables NEXT_PUBLIC_CABINET_* dans les réglages de Render.
export const CABINET_DEFAUT: Cabinet = {
  praticien: process.env.NEXT_PUBLIC_CABINET_PRATICIEN || "Claire Martin (fictif)",
  adresse: process.env.NEXT_PUBLIC_CABINET_ADRESSE || "12 rue des Lilas, 69003 Lyon",
  telephone: process.env.NEXT_PUBLIC_CABINET_TELEPHONE || "04 00 00 00 00",
  rpps: process.env.NEXT_PUBLIC_CABINET_RPPS || "10000000000",
  finess: process.env.NEXT_PUBLIC_CABINET_FINESS || "690000000",
};

/** Les valeurs saisies dans le navigateur l'emportent ; un champ laissé vide reprend la valeur par défaut. */
export function completerCabinet(saisi: Partial<Cabinet>): Cabinet {
  const cles = Object.keys(CABINET_DEFAUT) as (keyof Cabinet)[];
  return Object.fromEntries(cles.map((k) => [k, saisi[k]?.trim() ? saisi[k] : CABINET_DEFAUT[k]])) as Cabinet;
}

// Identité du patient : saisie et imprimée localement, jamais envoyée à l'IA ni stockée.
export type Patient = { nom: string; naissance: string; secu: string };

export const RUBRIQUES: { cle: keyof Analyse["compteRendu"]; titre: string }[] = [
  { cle: "motif", titre: "Motif de consultation" },
  { cle: "antecedents", titre: "Antécédents" },
  { cle: "examenClinique", titre: "Examen clinique" },
  { cle: "examensComplementaires", titre: "Examens complémentaires" },
  { cle: "diagnostic", titre: "Diagnostic" },
  { cle: "soinsRealises", titre: "Soins réalisés" },
  { cle: "planTraitement", titre: "Plan de traitement" },
  { cle: "conseils", titre: "Conseils au patient" },
];
