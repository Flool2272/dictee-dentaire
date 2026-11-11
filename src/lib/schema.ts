import { z } from "zod";
import { CODES } from "./tarifs";

export const ActeExtraitSchema = z.object({
  etape: z
    .number()
    .int()
    .describe("Numéro d'étape du traitement : 1 pour la première étape, 2 pour la suivante, etc. Les actes d'une même séance partagent le même numéro."),
  code: z.enum(CODES).describe("Code de l'acte, choisi uniquement dans la grille fournie"),
  dents: z
    .array(z.string())
    .describe("Numéros de dents en notation FDI (ex. \"36\"). Vide si l'acte ne concerne pas une dent précise."),
  quantite: z.number().int().describe("Nombre d'actes pour un acte non facturé par dent. Mettre 1 par défaut."),
  statut: z
    .enum(["realise", "propose"])
    .describe("\"realise\" si l'acte a été fait pendant la séance, \"propose\" s'il fait partie du plan de traitement à venir"),
  precision: z.string().describe("Courte précision clinique tirée de la dictée (faces, matériau, remarque). Chaîne vide si aucune."),
});

export const AnalyseSchema = z.object({
  compteRendu: z.object({
    motif: z.string(),
    antecedents: z.string(),
    examenClinique: z.string(),
    examensComplementaires: z.string(),
    diagnostic: z.string(),
    soinsRealises: z.string(),
    planTraitement: z.string(),
    conseils: z.string(),
  }),
  actes: z.array(ActeExtraitSchema),
  actesNonReconnus: z
    .array(z.string())
    .describe("Actes dictés qui ne correspondent à aucun code de la grille"),
  pointsAVerifier: z
    .array(z.string())
    .describe("Ambiguïtés ou informations manquantes que la praticienne doit vérifier"),
});

export type Analyse = z.infer<typeof AnalyseSchema>;
export type ActeExtrait = z.infer<typeof ActeExtraitSchema>;
