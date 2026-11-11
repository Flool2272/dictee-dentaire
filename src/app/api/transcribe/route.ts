import { NextRequest, NextResponse } from "next/server";

// Vocabulaire qui aide le modèle de transcription à reconnaître les termes dentaires.
const VOCABULAIRE =
  "Compte rendu dentaire. Détartrage, carie, pulpite, composite, inlay-core, couronne céramo-métallique, zircone, " +
  "traitement endodontique, avulsion, dent de sagesse, rétro-alvéolaire, panoramique, mésial, distal, occlusal, " +
  "vestibulaire, lingual, parodontite, implant, bridge, dent 36, dent 21.";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Mode démo : la dictée vocale n'est pas encore activée. Tapez le texte ou chargez l'exemple." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Aucun enregistrement reçu" }, { status: 400 });
  }

  const body = new FormData();
  // Safari enregistre en mp4, Chrome et Firefox en webm/ogg.
  const ext = audio.type.includes("mp4") ? "mp4" : audio.type.includes("ogg") ? "ogg" : "webm";
  body.append("file", audio, `dictee.${ext}`);
  body.append("model", "gpt-4o-transcribe");
  body.append("language", "fr");
  body.append("prompt", VOCABULAIRE);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Échec de la transcription (${res.status})` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ texte: typeof data?.text === "string" ? data.text : "" });
  } catch {
    return NextResponse.json({ error: "Impossible de contacter le service de transcription" }, { status: 502 });
  }
}
