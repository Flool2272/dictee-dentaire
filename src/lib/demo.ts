import type { Analyse } from "./schema";

// CAS FICTIFS
// Dictées et résultats inventés, utilisés par le mode démo (sans ANTHROPIC_API_KEY)
// pour tester l'interface, le calcul des devis et les PDF sans appeler l'IA.

export type CasDemo = { id: string; titre: string; dictee: string; analyse: Analyse };

export const CAS_DEMO: CasDemo[] = [
  {
    id: "carie-couronnes",
    titre: "Carie, détartrage et deux couronnes",
    dictee:
      "Patient de 42 ans venu pour une douleur au froid en bas à gauche depuis une semaine. Pas d'antécédent particulier, " +
      "pas d'allergie connue. À l'examen, carie occluso-distale sur la 36, test au froid positif mais douleur brève, pas de " +
      "douleur à la percussion. Rétro-alvéolaire sur la 36 : carie proche de la pulpe sans atteinte. Tartre important au bloc " +
      "incisivo-canin mandibulaire. Aujourd'hui j'ai fait le détartrage complet et un composite deux faces sur la 36. " +
      "La 46 est très délabrée, déjà dévitalisée, il faudra faire un inlay-core et une couronne céramo-céramique. " +
      "Je propose aussi une couronne zircone sur la 25 qui est fracturée. Conseils : brossage trois fois par jour, " +
      "brossettes interdentaires, revoir dans quinze jours.",
    analyse: {
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
        { etape: 1, code: "HBQK002", dents: ["36"], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBJD001", dents: [], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBMD038", dents: ["36"], quantite: 1, statut: "realise", precision: "Faces occlusale et distale" },
        { etape: 1, code: "HBLD090", dents: ["46"], quantite: 1, statut: "propose", precision: "" },
        { etape: 2, code: "HBLD073", dents: ["46"], quantite: 1, statut: "propose", precision: "" },
        { etape: 3, code: "HBLD680", dents: ["25"], quantite: 1, statut: "propose", precision: "Dent fracturée" },
      ],
      actesNonReconnus: [],
      pointsAVerifier: ["Matériau de l'inlay-core de la 46 non précisé."],
    },
  },
  {
    id: "dents-sagesse",
    titre: "Dents de sagesse à extraire",
    dictee:
      "Patiente de 22 ans, adressée pour des douleurs en bas à droite et en bas à gauche, gonflement de la gencive " +
      "derrière la dernière molaire depuis trois jours, gêne à l'ouverture. Pas de traitement en cours, pas d'allergie. " +
      "Péricoronarite sur la 48, gencive inflammatoire, pas de fièvre. J'ai fait une panoramique : 38 et 48 incluses, " +
      "en mésio-version, proches du canal mandibulaire pour la 48. Prescription de bain de bouche. " +
      "Je propose l'extraction des deux dents de sagesse du bas, la 38 et la 48, en une séance sous anesthésie locale. " +
      "Il faudra peut-être un scanner avant pour la 48. Revoir après l'épisode infectieux.",
    analyse: {
      compteRendu: {
        motif: "Douleurs mandibulaires bilatérales, tuméfaction gingivale rétromolaire depuis trois jours, limitation d'ouverture.",
        antecedents: "Aucun traitement en cours. Pas d'allergie connue.",
        examenClinique: "Péricoronarite en regard de la 48, gencive inflammatoire. Apyrexie.",
        examensComplementaires:
          "Radiographie panoramique : 38 et 48 incluses en mésioversion. 48 au contact du canal mandibulaire.",
        diagnostic: "Péricoronarite sur 48 incluse. 38 incluse.",
        soinsRealises: "Examen et radiographie panoramique. Prescription d'un bain de bouche.",
        planTraitement:
          "Avulsion des 38 et 48 en une séance sous anesthésie locale, après résolution de l'épisode infectieux. " +
          "Imagerie 3D à discuter pour la 48.",
        conseils: "Bains de bouche selon prescription. Consulter en cas de fièvre ou d'aggravation du gonflement.",
      },
      actes: [
        { etape: 1, code: "C", dents: [], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBQK001", dents: [], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBGD021", dents: ["38", "48"], quantite: 1, statut: "propose", precision: "En une séance, anesthésie locale" },
      ],
      actesNonReconnus: ["Scanner (cone beam) préopératoire de la 48"],
      pointsAVerifier: [
        "Médicament et posologie du bain de bouche non dictés.",
        "Imagerie 3D de la 48 : à confirmer avant l'intervention.",
      ],
    },
  },
  {
    id: "enfant-controle",
    titre: "Contrôle d'un enfant",
    dictee:
      "Enfant de 8 ans, visite de contrôle, accompagné de sa mère. Pas d'antécédent. Bonne hygiène dans l'ensemble, " +
      "un peu de plaque en bas. Les premières molaires définitives sont sorties, sillons profonds. Petite carie sur la " +
      "75, une face. J'ai fait les scellements de sillons sur les quatre premières molaires, 16, 26, 36 et 46, et soigné " +
      "la 75. Conseils : brossage deux fois par jour avec un dentifrice fluoré adapté, limiter le grignotage. Revoir dans six mois.",
    analyse: {
      compteRendu: {
        motif: "Visite de contrôle.",
        antecedents: "Aucun antécédent. Enfant accompagné de sa mère.",
        examenClinique:
          "Hygiène globalement satisfaisante, plaque au secteur mandibulaire. Premières molaires permanentes " +
          "en place, sillons profonds. Carie une face sur la 75.",
        examensComplementaires: "Non renseigné.",
        diagnostic: "Carie sur 75. Sillons à risque carieux sur 16, 26, 36 et 46.",
        soinsRealises: "Scellement des sillons sur 16, 26, 36 et 46. Restauration de la 75.",
        planTraitement: "Pas de soin supplémentaire prévu. Contrôle dans six mois.",
        conseils: "Brossage deux fois par jour avec un dentifrice fluoré adapté à l'âge. Limiter le grignotage.",
      },
      actes: [
        { etape: 1, code: "C", dents: [], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBBD005", dents: ["16", "26", "36", "46"], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBMD020", dents: ["75"], quantite: 1, statut: "realise", precision: "Une face" },
      ],
      actesNonReconnus: [],
      pointsAVerifier: [
        "Vérifier si l'examen relève de l'examen de prévention M'T dents (pris en charge à 100 %).",
      ],
    },
  },
  {
    id: "implant-parodontie",
    titre: "Bilan implant et parodontie",
    dictee:
      "Patient de 55 ans, fumeur, dix cigarettes par jour, diabète de type 2 équilibré. Il veut remplacer la 46 " +
      "extraite il y a six mois. Saignements au brossage. Parodontite modérée, poches de 5 millimètres dans les secteurs " +
      "1 et 4. J'ai fait une panoramique : os suffisant en hauteur en 46. Je propose d'abord un surfaçage sur les deux " +
      "sextants concernés, puis un implant en 46 avec une couronne sur implant céramo-métallique. Il serait aussi " +
      "intéressé par une gouttière parce qu'il serre les dents la nuit. J'ai expliqué l'impact du tabac sur l'implant.",
    analyse: {
      compteRendu: {
        motif: "Demande de remplacement de la 46 (avulsion il y a six mois). Saignements au brossage.",
        antecedents: "Diabète de type 2 équilibré. Tabagisme actif (10 cigarettes par jour).",
        examenClinique:
          "Édentement unitaire en 46. Parodontite modérée avec poches de 5 mm dans les secteurs 1 et 4. Bruxisme nocturne rapporté.",
        examensComplementaires: "Radiographie panoramique : hauteur osseuse suffisante en 46.",
        diagnostic: "Parodontite modérée localisée. Édentement unitaire 46. Bruxisme.",
        soinsRealises: "Bilan clinique et radiographique. Information sur l'effet du tabac sur le pronostic implantaire.",
        planTraitement:
          "1. Surfaçage radiculaire des deux sextants concernés. 2. Réévaluation parodontale. " +
          "3. Implant en 46 puis couronne sur implant céramo-métallique. 4. Gouttière occlusale de bruxisme.",
        conseils: "Arrêt ou réduction du tabac recommandé. Hygiène interdentaire quotidienne.",
      },
      actes: [
        { etape: 1, code: "C", dents: [], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HBQK001", dents: [], quantite: 1, statut: "realise", precision: "" },
        { etape: 1, code: "HN-SURF", dents: [], quantite: 2, statut: "propose", precision: "Secteurs 1 et 4" },
        { etape: 2, code: "HN-IMPL", dents: ["46"], quantite: 1, statut: "propose", precision: "" },
        { etape: 3, code: "HBLD418", dents: ["46"], quantite: 1, statut: "propose", precision: "" },
        { etape: 4, code: "HN-GOUT", dents: [], quantite: 1, statut: "propose", precision: "" },
      ],
      actesNonReconnus: ["Scanner (cone beam) pré-implantaire, si nécessaire"],
      pointsAVerifier: [
        "Nombre exact de sextants à surfacer (deux d'après la dictée).",
        "Dernier bilan HbA1c non mentionné (diabète).",
      ],
    },
  },
  {
    id: "reprise-couronne-25",
    titre: "Reprise de couronne sur la 25",
    dictee:
      "Patiente de 48 ans, la couronne de la 25 est descellée et elle a une gêne à la mastication. Pas d'antécédent " +
      "médical, pas d'allergie. La 25 est dévitalisée, la radio montre un traitement canalaire incomplet avec une image " +
      "périapicale. Inflammation gingivale localisée avec poche en distal de la 25. Je propose : découpe et descellement " +
      "de la couronne, désobturation canalaire puis reprise du traitement canalaire avec radios per-opératoire et finale, " +
      "reconstitution avec ancrage radiculaire, couronne transitoire, puis couronne zircone monolithique. " +
      "Et un assainissement parodontal par lambeau autour de la 25. Elle signe le devis aujourd'hui.",
    analyse: {
      compteRendu: {
        motif: "Descellement de la couronne de la 25, gêne à la mastication.",
        antecedents: "Aucun antécédent médical. Pas d'allergie connue.",
        examenClinique: "25 dépulpée, couronne descellée. Inflammation gingivale localisée avec poche en distal de la 25.",
        examensComplementaires: "Radiographie : traitement canalaire incomplet de la 25 avec image périapicale.",
        diagnostic: "Lésion périapicale sur 25 avec traitement endodontique insuffisant. Atteinte parodontale localisée.",
        soinsRealises: "Examen et radiographie. Présentation et signature du devis.",
        planTraitement:
          "1. Dépose de la couronne de la 25. 2. Retraitement endodontique de la 25 avec radiographies per-opératoire et finale. " +
          "3. Reconstitution avec ancrage radiculaire. 4. Couronne transitoire puis couronne zircone monolithique. " +
          "5. Assainissement parodontal par lambeau en regard de la 25.",
        conseils: "Éviter de mastiquer côté gauche jusqu'à la couronne transitoire. Hygiène interdentaire soigneuse.",
      },
      actes: [
        { etape: 1, code: "HBGD027", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
        { etape: 2, code: "HBGD001", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
        { etape: 2, code: "HBFD003", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
        { etape: 2, code: "HBQK040", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
        { etape: 3, code: "HBMD042", dents: ["25"], quantite: 1, statut: "propose", precision: "Mésio-occluso-vestibulo-palatino-distale" },
        { etape: 4, code: "HBLD490", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
        { etape: 4, code: "HBLD350", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
        { etape: 5, code: "HBJA247", dents: ["25"], quantite: 1, statut: "propose", precision: "" },
      ],
      actesNonReconnus: [],
      pointsAVerifier: [],
    },
  },
];

/** En mode démo, renvoie le cas dont la dictée correspond, sinon le premier. */
export function casPourDictee(dictee: string): { cas: CasDemo; exact: boolean } {
  const texte = dictee.trim();
  const cas = CAS_DEMO.find((c) => c.dictee === texte);
  return cas ? { cas, exact: true } : { cas: CAS_DEMO[0], exact: false };
}
