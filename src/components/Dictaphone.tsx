"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onTranscription: (texte: string) => void;
};

// Mode mains libres : l'enregistrement démarre quand le micro capte de la voix
// (par exemple quand la praticienne coupe la sourdine de son micro-cravate)
// et s'arrête après quelques secondes de silence (sourdine remise).
const DUREE_VOIX_POUR_DEMARRER_MS = 200;
const SILENCE_POUR_ARRETER_MS = 3500;
const DUREE_MAX_MS = 10 * 60 * 1000;
const VOIX_MINIMALE_MS = 800;
const SEUIL_PAR_DEFAUT = 0.02;

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* stockage indisponible */
  }
}

function contraintesAudio(micro: string): MediaStreamConstraints {
  return {
    audio: {
      deviceId: micro ? { exact: micro } : undefined,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: false,
    },
  };
}

export default function Dictaphone({ onTranscription }: Props) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [micros, setMicros] = useState<MediaDeviceInfo[]>([]);
  const [micro, setMicro] = useState("");
  const [transcriptionsEnCours, setTranscriptionsEnCours] = useState(0);

  // Mode manuel
  const [manuelActif, setManuelActif] = useState(false);
  const [duree, setDuree] = useState(0);

  // Mode mains libres
  const [mainsLibres, setMainsLibres] = useState(false);
  const [enregistreAuto, setEnregistreAuto] = useState(false);
  const [niveau, setNiveau] = useState(0);
  const [seuil, setSeuil] = useState(SEUIL_PAR_DEFAUT);

  const fluxRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const minuteurRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chaineRef = useRef<Promise<void>>(Promise.resolve());
  const seuilRef = useRef(SEUIL_PAR_DEFAUT);
  const onTranscriptionRef = useRef(onTranscription);

  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
  }, [onTranscription]);

  useEffect(() => {
    const m = lire("micro") ?? "";
    const s = Number(lire("seuil")) || SEUIL_PAR_DEFAUT;
    queueMicrotask(() => {
      setMicro(m);
      setSeuil(s);
      seuilRef.current = s;
    });
  }, []);

  const listerMicros = useCallback(async () => {
    try {
      const appareils = await navigator.mediaDevices.enumerateDevices();
      setMicros(appareils.filter((a) => a.kind === "audioinput" && a.deviceId));
    } catch {
      /* liste indisponible */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(listerMicros);
    navigator.mediaDevices?.addEventListener?.("devicechange", listerMicros);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", listerMicros);
  }, [listerMicros]);

  /** Les transcriptions sont faites l'une après l'autre pour garder l'ordre de la dictée. */
  const transcrire = useCallback((audio: Blob) => {
    setTranscriptionsEnCours((n) => n + 1);
    chaineRef.current = chaineRef.current.then(async () => {
      try {
        const form = new FormData();
        form.append("audio", audio);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErreur(data.error ?? "Échec de la transcription");
          return;
        }
        if (data.texte) onTranscriptionRef.current(data.texte);
      } catch {
        setErreur("Impossible d'envoyer l'enregistrement");
      } finally {
        setTranscriptionsEnCours((n) => n - 1);
      }
    });
  }, []);

  async function ouvrirMicro(): Promise<MediaStream | null> {
    try {
      const flux = await navigator.mediaDevices.getUserMedia(contraintesAudio(micro));
      listerMicros(); // les noms des micros ne sont visibles qu'après autorisation
      return flux;
    } catch {
      setErreur("Accès au micro refusé ou micro introuvable. Vérifiez qu'il est branché et autorisé dans le navigateur.");
      return null;
    }
  }

  function couperMicro() {
    if (minuteurRef.current) clearInterval(minuteurRef.current);
    minuteurRef.current = null;
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function nouvelEnregistreur(flux: MediaStream, auStop: (audio: Blob, dureeMs: number) => void) {
    const recorder = new MediaRecorder(flux);
    const debut = Date.now();
    morceauxRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) morceauxRef.current.push(e.data);
    };
    recorder.onstop = () => auStop(new Blob(morceauxRef.current, { type: recorder.mimeType }), Date.now() - debut);
    recorder.start();
    recorderRef.current = recorder;
  }

  // ----- Mode manuel -----

  async function demarrerManuel() {
    setErreur(null);
    const flux = await ouvrirMicro();
    if (!flux) return;
    fluxRef.current = flux;
    nouvelEnregistreur(flux, (audio) => {
      couperMicro();
      transcrire(audio);
    });
    setDuree(0);
    minuteurRef.current = setInterval(() => setDuree((d) => d + 1), 1000);
    setManuelActif(true);
  }

  function arreterManuel() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setManuelActif(false);
  }

  // ----- Mode mains libres -----

  async function activerMainsLibres() {
    setErreur(null);
    const flux = await ouvrirMicro();
    if (!flux) return;
    fluxRef.current = flux;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const analyseur = ctx.createAnalyser();
    analyseur.fftSize = 2048;
    ctx.createMediaStreamSource(flux).connect(analyseur);
    const echantillons = new Float32Array(analyseur.fftSize);

    let voixDepuis: number | null = null;
    let derniereVoix = 0;
    let debutEnregistrement = 0;
    let enregistre = false;

    minuteurRef.current = setInterval(() => {
      analyseur.getFloatTimeDomainData(echantillons);
      let somme = 0;
      for (const v of echantillons) somme += v * v;
      const rms = Math.sqrt(somme / echantillons.length);
      setNiveau(rms);

      const maintenant = Date.now();
      const voix = rms > seuilRef.current;

      if (!enregistre) {
        if (!voix) {
          voixDepuis = null;
          return;
        }
        voixDepuis ??= maintenant;
        if (maintenant - voixDepuis < DUREE_VOIX_POUR_DEMARRER_MS) return;
        enregistre = true;
        debutEnregistrement = derniereVoix = maintenant;
        setEnregistreAuto(true);
        nouvelEnregistreur(flux, (audio, dureeMs) => {
          // Un bruit bref (toux, choc) ne déclenche pas de transcription.
          if (dureeMs - SILENCE_POUR_ARRETER_MS >= VOIX_MINIMALE_MS) transcrire(audio);
        });
        return;
      }

      if (voix) derniereVoix = maintenant;
      const silenceLong = maintenant - derniereVoix > SILENCE_POUR_ARRETER_MS;
      const tropLong = maintenant - debutEnregistrement > DUREE_MAX_MS;
      if (silenceLong || tropLong) {
        enregistre = false;
        voixDepuis = null;
        recorderRef.current?.stop();
        recorderRef.current = null;
        setEnregistreAuto(false);
      }
    }, 100);

    setMainsLibres(true);
  }

  function desactiverMainsLibres() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    couperMicro();
    setMainsLibres(false);
    setEnregistreAuto(false);
    setNiveau(0);
  }

  // Libère le micro si on quitte la page.
  useEffect(() => () => couperMicro(), []);

  function changerSeuil(valeur: number) {
    setSeuil(valeur);
    seuilRef.current = valeur;
    ecrire("seuil", String(valeur));
  }

  function changerMicro(id: string) {
    setMicro(id);
    ecrire("micro", id);
  }

  const mm = String(Math.floor(duree / 60)).padStart(2, "0");
  const ss = String(duree % 60).padStart(2, "0");
  const enregistrement = manuelActif || enregistreAuto;
  // Échelle visuelle de la jauge : 0,1 de niveau RMS = jauge pleine.
  const pourcent = (v: number) => `${Math.min(100, (v / 0.1) * 100)}%`;

  return (
    <div className="flex flex-col gap-3">
      {enregistrement && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600 py-1.5 text-sm font-medium text-white">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          Enregistrement en cours
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!mainsLibres &&
          (manuelActif ? (
            <button
              type="button"
              onClick={arreterManuel}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
              Arrêter ({mm}:{ss})
            </button>
          ) : (
            <button
              type="button"
              onClick={demarrerManuel}
              className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
              </svg>
              Dicter
            </button>
          ))}

        {!manuelActif && (
          <button
            type="button"
            onClick={mainsLibres ? desactiverMainsLibres : activerMainsLibres}
            className={`rounded-full px-4 py-2.5 text-sm font-medium ring-1 ${
              mainsLibres ? "bg-slate-900 text-white ring-slate-900" : "text-slate-700 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {mainsLibres ? "Désactiver le mode mains libres" : "Mode mains libres"}
          </button>
        )}

        {micros.length > 1 && !enregistrement && !mainsLibres && (
          <select
            value={micro}
            onChange={(e) => changerMicro(e.target.value)}
            className="max-w-[16rem] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            aria-label="Micro utilisé"
          >
            <option value="">Micro par défaut</option>
            {micros.map((m, i) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Micro ${i + 1}`}
              </option>
            ))}
          </select>
        )}

        {transcriptionsEnCours > 0 && <span className="text-sm text-slate-500">Transcription…</span>}
      </div>

      {mainsLibres && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
          <p className="mb-3 font-medium">
            {enregistreAuto ? (
              <span className="text-red-700">● Enregistrement : remettez la sourdine pour terminer.</span>
            ) : (
              <span className="text-slate-700">En veille : coupez la sourdine du micro et parlez pour démarrer.</span>
            )}
          </p>
          <div className="relative mb-1 h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <div
              className={`h-full transition-[width] duration-100 ${niveau > seuil ? "bg-red-500" : "bg-teal-600"}`}
              style={{ width: pourcent(niveau) }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: pourcent(seuil) }} />
          </div>
          <label className="flex items-center gap-3 text-slate-600">
            Sensibilité
            <input
              type="range"
              min={0.003}
              max={0.08}
              step={0.001}
              value={seuil}
              onChange={(e) => changerSeuil(Number(e.target.value))}
              className="flex-1"
              style={{ direction: "rtl" }}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            La jauge montre le son capté ; le trait noir est le seuil de déclenchement. Micro en sourdine, la jauge doit
            rester sous le trait. Gardez cet onglet ouvert.
          </p>
        </div>
      )}

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
