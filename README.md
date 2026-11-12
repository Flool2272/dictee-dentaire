# Émail · Dictée et devis dentaires

Prototype : la praticienne dicte, l'application rédige le compte rendu de consultation et prépare le devis.

## Fonctionnement

1. **Dictée** : enregistrement dans le navigateur, transcription par `gpt-4o-transcribe` (`src/app/api/transcribe`).
   Le texte reste modifiable, on peut aussi le taper.
2. **Analyse** : Claude rédige le compte rendu structuré et liste les actes, choisis uniquement dans la grille
   du cabinet, en séparant actes réalisés et actes proposés (`src/app/api/generate`).
3. **Devis** : les montants sont calculés par le code à partir de la grille (`src/lib/devis.ts`), jamais par l'IA.
4. **Relecture** : tout est modifiable avant export.
5. **Export** : PDF du compte rendu et du devis (impression du navigateur), et texte à coller dans LogosW.

## Mode démo

Sans `ANTHROPIC_API_KEY`, l'analyse renvoie un résultat fictif (celui de la dictée d'exemple) pour tester
l'interface, le devis et les PDF. Sans `OPENAI_API_KEY`, la dictée vocale est désactivée : il faut taper le texte.

## Historique des devis

Les devis enregistrés ou imprimés sont conservés dans le navigateur de l'ordinateur utilisé
(`src/lib/historique.ts`, localStorage), jamais sur le serveur. On peut les rechercher, les rouvrir,
les supprimer et les exporter en CSV. Ils contiennent des données de santé : ils restent sur ce poste.

## Grille tarifaire

`src/lib/tarifs.ts` contient huit actes repris d'un devis réel du cabinet ; les autres sont **simulés** et doivent être remplacés par les codes CCAM, honoraires
et bases de remboursement réels du cabinet avant tout usage.

## Données de santé

Ce prototype ne stocke rien côté serveur. Le nom du patient est saisi dans un champ à part, n'est jamais envoyé
aux services d'IA et ne sert qu'à l'impression. La dictée elle-même est envoyée à OpenAI (transcription) et à
Anthropic (rédaction) : ne pas y mentionner l'identité du patient.

Avant un usage réel avec des données patients : hébergement certifié HDS, contrats de sous-traitance RGPD avec
les fournisseurs d'IA, et information des patients.

## Lancer en local

```bash
cp .env.example .env.local   # puis remplir les valeurs
npm install
npm run dev
```

## Déploiement

`render.yaml` décrit le service Render. Variables à renseigner : `APP_PASSWORD_HASH`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY` (`SESSION_SECRET` est générée automatiquement).
