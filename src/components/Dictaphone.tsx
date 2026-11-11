"use client";

import { useRef, useState } from "react";

type Props = {
  onTranscription: (texte: string) => void;
};

export default function Dictaphone({ onTranscription }: Props) {
  const [etat, setEtat] = useState<"pret" | "enregistrement" | "transcription">("pret");
  const [erreur, setErreur] = useState<string | null>(null);
  const [duree, setDuree] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const minuteurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function demarrer() {
    setErreur(null);
    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErreur("Accès au micro refusé. Autorisez le micro dans le navigateur.");
      return;
    }
    const recorder = new MediaRecorder(flux);
    morceauxRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) morceauxRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      flux.getTracks().forEach((t) => t.stop());
      if (minuteurRef.current) clearInterval(minuteurRef.current);
      const audio = new Blob(morceauxRef.current, { type: recorder.mimeType });
      await transcrire(audio);
    };
    recorder.start();
    recorderRef.current = recorder;
    setDuree(0);
    minuteurRef.current = setInterval(() => setDuree((d) => d + 1), 1000);
    setEtat("enregistrement");
  }

  function arreter() {
    recorderRef.current?.stop();
    setEtat("transcription");
  }

  async function transcrire(audio: Blob) {
    try {
      const form = new FormData();
      form.append("audio", audio);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? "Échec de la transcription");
        return;
      }
      if (data.texte) onTranscription(data.texte);
    } finally {
      setEtat("pret");
    }
  }

  const mm = String(Math.floor(duree / 60)).padStart(2, "0");
  const ss = String(duree % 60).padStart(2, "0");

  return (
    <div className="flex flex-wrap items-center gap-3">
      {etat === "enregistrement" ? (
        <button
          type="button"
          onClick={arreter}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          Arrêter ({mm}:{ss})
        </button>
      ) : (
        <button
          type="button"
          onClick={demarrer}
          disabled={etat === "transcription"}
          className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
          </svg>
          {etat === "transcription" ? "Transcription..." : "Dicter"}
        </button>
      )}
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
