import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AnalyseSchema } from "@/lib/schema";
import { casPourDictee } from "@/lib/demo";
import { grillePourPrompt } from "@/lib/tarifs";

const SYSTEM = `Tu assistes une chirurgienne-dentiste française. Elle te transmet la transcription d'une dictée faite pendant ou après une séance.

Ta tâche :
1. Rédiger un compte rendu clinique clair, en français médical sobre, à partir de la dictée uniquement. N'invente aucune donnée clinique. Si une rubrique n'est pas abordée, écris "Non renseigné".
2. Lister les actes cités, en choisissant leur code UNIQUEMENT dans la grille ci-dessous. Distingue les actes réalisés pendant la séance des actes proposés dans le plan de traitement.
3. Mettre dans "actesNonReconnus" tout acte dicté qui n'a pas d'équivalent dans la grille, au lieu de forcer un code.
4. Numéroter les étapes du traitement ("etape") dans l'ordre où elles seront réalisées, en regroupant les actes d'une même séance.
5. Signaler dans "pointsAVerifier" toute ambiguïté : numéro de dent incertain, nombre de faces non précisé, matériau de couronne non précisé, etc.

Numérotation des dents : notation FDI à deux chiffres (11 à 48, 51 à 85 pour les dents temporaires). Convertis les formulations orales ("la six du bas à gauche" = 36).
Ne mentionne jamais l'identité du patient, même si elle apparaît dans la dictée.

Grille des actes du cabinet :
${grillePourPrompt()}`;

export async function POST(request: NextRequest) {
  const { dictee } = await request.json().catch(() => ({}));
  if (typeof dictee !== "string" || !dictee.trim()) {
    return NextResponse.json({ error: "Dictée vide" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    // Mode démo : pas de clé configurée, on renvoie une analyse fictive.
    const { cas, exact } = casPourDictee(dictee);
    return NextResponse.json({ ...cas.analyse, demo: exact ? "exact" : "approx" });
  }

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(AnalyseSchema) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Transcription de la dictée :\n\n${dictee.trim()}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "L'IA a refusé de traiter cette dictée." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return NextResponse.json({ error: "Réponse de l'IA incomplète, réessayez." }, { status: 502 });
    }
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Clé ANTHROPIC_API_KEY invalide" }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Trop de requêtes, réessayez dans un instant." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Erreur de l'IA (${error.status})` }, { status: 502 });
    }
    return NextResponse.json({ error: "Impossible de contacter l'IA" }, { status: 502 });
  }
}
