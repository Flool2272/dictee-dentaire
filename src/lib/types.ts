import type { Analyse } from "./schema";

export type Cabinet = { praticien: string; adresse: string; telephone: string; rpps: string; finess: string };
export const CABINET_VIDE: Cabinet = { praticien: "", adresse: "", telephone: "", rpps: "", finess: "" };

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
