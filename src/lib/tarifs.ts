// GRILLE TARIFAIRE
// Les actes marqués « devis du cabinet » reprennent les codes et montants d'un devis
// réel fourni par le cabinet. Les autres sont simulés : codes, libellés et montants
// indicatifs, à remplacer par la grille réelle (codes CCAM, honoraires, bases à jour).

export type Panier = "soins" | "100% santé" | "modéré" | "libre" | "hors nomenclature";

export type Acte = {
  code: string;
  libelle: string;
  /** Honoraires pratiqués par le cabinet, en euros */
  honoraires: number;
  /** Base de remboursement Sécurité sociale, en euros (0 si non remboursable) */
  baseRemboursement: number;
  /** Taux de prise en charge de l'Assurance maladie obligatoire (0 à 1) */
  tauxAMO: number;
  panier: Panier;
  /** true si l'acte est facturé par dent (le nombre de dents donne la quantité) */
  parDent: boolean;
  /** Honoraires limite de facturation (plafond), pour les actes concernés */
  limite?: number;
  /** Code matériau tel qu'il figure sur le devis conventionnel */
  materiau?: string;
};

/** Numéro de panier sur le devis conventionnel : 1 = 100 % santé, 2 = modéré, 3 = libre. */
export function numeroPanier(panier: Panier): string {
  return panier === "100% santé" ? "1" : panier === "modéré" ? "2" : panier === "libre" ? "3" : "";
}

export const TARIFS: Acte[] = [
  // Devis du cabinet
  { code: "HBGD027", libelle: "Découpe / descellement de couronne postérieure", honoraires: 38, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: true },
  { code: "HBGD001", libelle: "Désobturation canalaire d'une prémolaire", honoraires: 75, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: true },
  { code: "HBMD042", libelle: "Obturation 5 faces avec ancrage radiculaire", honoraires: 104, baseRemboursement: 104, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBFD003", libelle: "Mise en forme et obturation canalaire d'une prémolaire", honoraires: 70.72, baseRemboursement: 70.72, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBQK040", libelle: "Radiographies rétro-alvéolaires per-interventionnelle et finale", honoraires: 11.97, baseRemboursement: 11.97, tauxAMO: 0.6, panier: "soins", parDent: false },
  { code: "HBLD490", libelle: "Couronne transitoire", honoraires: 61.8, baseRemboursement: 10, tauxAMO: 0.6, panier: "100% santé", parDent: true, limite: 61.8, materiau: "4" },
  { code: "HBLD350", libelle: "Couronne définitive zircone monolithique", honoraires: 453.2, baseRemboursement: 120, tauxAMO: 0.6, panier: "100% santé", parDent: true, limite: 453.2, materiau: "3" },
  { code: "HBJA247", libelle: "Assainissement parodontal par lambeau", honoraires: 50, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: false },
  // Actes simulés
  { code: "C", libelle: "Consultation", honoraires: 30, baseRemboursement: 30, tauxAMO: 0.6, panier: "soins", parDent: false },
  { code: "HBJD001", libelle: "Détartrage et polissage des dents", honoraires: 43.38, baseRemboursement: 43.38, tauxAMO: 0.6, panier: "soins", parDent: false },
  { code: "HBQK002", libelle: "Radiographie rétro-alvéolaire (1 à 3 dents contiguës)", honoraires: 15, baseRemboursement: 15, tauxAMO: 0.6, panier: "soins", parDent: false },
  { code: "HBQK001", libelle: "Radiographie panoramique dentomaxillaire", honoraires: 24, baseRemboursement: 24, tauxAMO: 0.6, panier: "soins", parDent: false },
  { code: "HBMD049", libelle: "Restauration composite 1 face", honoraires: 40, baseRemboursement: 40, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBMD038", libelle: "Restauration composite 2 faces", honoraires: 65, baseRemboursement: 65, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBMD054", libelle: "Restauration composite 3 faces ou plus", honoraires: 85, baseRemboursement: 85, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBFD006", libelle: "Traitement endodontique d'une incisive ou canine", honoraires: 40, baseRemboursement: 40, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBFD033", libelle: "Traitement endodontique d'une prémolaire", honoraires: 60, baseRemboursement: 60, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBFD035", libelle: "Traitement endodontique d'une molaire", honoraires: 120, baseRemboursement: 120, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBGD036", libelle: "Avulsion d'une dent permanente", honoraires: 33.44, baseRemboursement: 33.44, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBGD021", libelle: "Avulsion d'une dent de sagesse incluse", honoraires: 150, baseRemboursement: 83.6, tauxAMO: 0.6, panier: "libre", parDent: true },
  { code: "HBLD090", libelle: "Inlay-core", honoraires: 175, baseRemboursement: 90, tauxAMO: 0.6, panier: "100% santé", parDent: true },
  { code: "HBLD634", libelle: "Couronne céramo-métallique (incisive, canine, 1re prémolaire)", honoraires: 500, baseRemboursement: 120, tauxAMO: 0.6, panier: "100% santé", parDent: true },
  { code: "HBLD680", libelle: "Couronne zircone monolithe (prémolaire)", honoraires: 440, baseRemboursement: 120, tauxAMO: 0.6, panier: "modéré", parDent: true },
  { code: "HBLD073", libelle: "Couronne céramo-céramique (molaire)", honoraires: 750, baseRemboursement: 120, tauxAMO: 0.6, panier: "libre", parDent: true },
  { code: "HBBD005", libelle: "Scellement prophylactique des sillons", honoraires: 21.69, baseRemboursement: 21.69, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBMD020", libelle: "Restauration d'une dent temporaire", honoraires: 30, baseRemboursement: 30, tauxAMO: 0.6, panier: "soins", parDent: true },
  { code: "HBLD131", libelle: "Bridge céramo-métallique 3 éléments", honoraires: 1300, baseRemboursement: 279.5, tauxAMO: 0.6, panier: "modéré", parDent: false },
  { code: "HBLD418", libelle: "Couronne sur implant céramo-métallique", honoraires: 900, baseRemboursement: 107.5, tauxAMO: 0.6, panier: "libre", parDent: true },
  { code: "HN-IMPL", libelle: "Pose d'un implant (hors nomenclature)", honoraires: 1100, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: true },
  { code: "HN-SURF", libelle: "Surfaçage radiculaire, par sextant (non remboursé)", honoraires: 80, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: false },
  { code: "HN-GOUT", libelle: "Gouttière occlusale de bruxisme (non remboursée)", honoraires: 280, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: false },
  { code: "HN-BLAN", libelle: "Éclaircissement dentaire (hors nomenclature)", honoraires: 350, baseRemboursement: 0, tauxAMO: 0, panier: "hors nomenclature", parDent: false },
];

export const CODES = TARIFS.map((a) => a.code) as [string, ...string[]];

export function trouverActe(code: string): Acte | undefined {
  return TARIFS.find((a) => a.code === code);
}

/** Texte de la grille transmis à l'IA pour qu'elle choisisse les bons codes. */
export function grillePourPrompt(): string {
  return TARIFS.map(
    (a) => `- ${a.code} : ${a.libelle}${a.parDent ? " (par dent)" : ""} [panier ${a.panier}]`
  ).join("\n");
}
