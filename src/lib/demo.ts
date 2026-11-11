import type { Analyse } from "./schema";

// Réponse fictive renvoyée quand ANTHROPIC_API_KEY n'est pas configurée,
// pour tester l'interface, le calcul du devis et les PDF sans appeler l'IA.
// Elle correspond à la dictée d'exemple, quelle que soit la dictée envoyée.
export const ANALYSE_DEMO: Analyse = {
  compteRendu: {
    motif: "Douleur au froid dans le secteur 3 depuis une semaine.",
    antecedents: "Aucun antécédent particulier. Pas d'allergie connue.",
    examenClinique:
      "Carie occluso-distale sur la 36, test au froid positif avec douleur brève, percussion négative. " +
      "Tartre important au bloc incisivo-canin mandibulaire. 46 très délabrée, dépulpée. 25 fracturée.",
    examensComplementaires: "Radiographie rétro-alvéolaire de la 36 : carie juxta-pulpaire sans atteinte pulpaire.",
    diagnostic: "Carie profonde de la 36. Délabrement coronaire de la 46. Fracture de la 25.",
    soinsRealises: "Détartrage complet. Restauration composite deux faces (OD) sur la 36.",
    planTraitement: "46 : inlay-core puis couronne céramo-céramique. 25 : couronne zircone.",
    conseils: "Brossage trois fois par jour, brossettes interdentaires. Contrôle dans quinze jours.",
  },
  actes: [
    { code: "HBQK002", dents: ["36"], quantite: 1, statut: "realise", precision: "" },
    { code: "HBJD001", dents: [], quantite: 1, statut: "realise", precision: "" },
    { code: "HBMD038", dents: ["36"], quantite: 1, statut: "realise", precision: "Faces occlusale et distale" },
    { code: "HBLD090", dents: ["46"], quantite: 1, statut: "propose", precision: "" },
    { code: "HBLD073", dents: ["46"], quantite: 1, statut: "propose", precision: "" },
    { code: "HBLD680", dents: ["25"], quantite: 1, statut: "propose", precision: "Dent fracturée" },
  ],
  actesNonReconnus: [],
  pointsAVerifier: ["Matériau de l'inlay-core de la 46 non précisé."],
};
