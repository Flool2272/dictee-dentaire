"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Moteur d'écoute : découpe le son du micro en segments, envoyés un par un à la transcription.
//
// - "dictee" : un segment démarre quand la voix apparaît (sourdine du micro coupée)
//   et se termine après 3,5 s de silence (sourdine remise).
// - "consultation" : écoute continue de l'échange avec le patient ; le son est découpé
//   aux pauses (dès 1,5 s de silence après 20 s d'enregistrement, ou au plus tard à 60 s).

export type ModeEcoute = "consultation" | "dictee";

const REGLAGES = {
  dictee: { silenceFin: 3500, dureeMin: 0, dureeMax: 10 * 60 * 1000 },
  consultation: { silenceFin: 1500, dureeMin: 20_000, dureeMax: 60_000 },
} as const;
const SILENCE_FIN_ABSOLU = 3500;
const VOIX_POUR_DEMARRER_MS = 200;
const VOIX_MINIMALE_MS = 800;
export const SEUIL_PAR_DEFAUT = 0.02;

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

/** Message compréhensible selon la raison du refus d'accès au micro. */
function messageErreurMicro(e: unknown): string {
  const nom = e instanceof DOMException ? e.name : "";
  switch (nom) {
    case "NotAllowedError":
    case "SecurityError":
      return "Accès au micro refusé. Autorisez le micro pour ce site (icône à gauche de l'adresse), puis rechargez la page. Sur un ordinateur professionnel, l'accès peut être bloqué par votre service informatique : essayez depuis un téléphone.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Aucun micro détecté. Branchez un micro ou un casque, ou choisissez-en un autre dans « Micro et sensibilité ».";
    case "NotReadableError":
    case "AbortError":
      return "Le micro est déjà utilisé par une autre application (Teams, Zoom…). Fermez-la, puis réessayez.";
    default:
      return "Micro inaccessible : vérifiez qu'il est branché et autorisé dans le navigateur.";
  }
}

export function useEcoute(onTexte: (texte: string) => void) {
  const [actif, setActif] = useState(false);
  const [mode, setMode] = useState<ModeEcoute>("consultation");
  const [enregistre, setEnregistre] = useState(false);
  const [niveau, setNiveau] = useState(0);
  const [seuil, setSeuilState] = useState(SEUIL_PAR_DEFAUT);
  const [micros, setMicros] = useState<MediaDeviceInfo[]>([]);
  const [micro, setMicroState] = useState("");
  const [enTranscription, setEnTranscription] = useState(0);
  const [debut, setDebut] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const fluxRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const minuteurRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chaineRef = useRef<Promise<void>>(Promise.resolve());
  const seuilRef = useRef(SEUIL_PAR_DEFAUT);
  const onTexteRef = useRef(onTexte);

  useEffect(() => {
    onTexteRef.current = onTexte;
  }, [onTexte]);

  const listerMicros = useCallback(async () => {
    try {
      const appareils = await navigator.mediaDevices.enumerateDevices();
      setMicros(appareils.filter((a) => a.kind === "audioinput" && a.deviceId));
    } catch {
      /* liste indisponible */
    }
  }, []);

  useEffect(() => {
    const m = lire("micro") ?? "";
    const s = Number(lire("seuil")) || SEUIL_PAR_DEFAUT;
    const md = lire("modeEcoute") === "dictee" ? "dictee" : "consultation";
    queueMicrotask(() => {
      setMicroState(m);
      setSeuilState(s);
      seuilRef.current = s;
      setMode(md);
      listerMicros();
    });
    navigator.mediaDevices?.addEventListener?.("devicechange", listerMicros);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", listerMicros);
  }, [listerMicros]);

  /** Transcriptions faites l'une après l'autre pour garder l'ordre. */
  const transcrire = useCallback((audio: Blob) => {
    setEnTranscription((n) => n + 1);
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
        if (data.texte) onTexteRef.current(data.texte);
      } catch {
        setErreur("Impossible d'envoyer l'enregistrement");
      } finally {
        setEnTranscription((n) => n - 1);
      }
    });
  }, []);

  const couper = useCallback(() => {
    if (minuteurRef.current) clearInterval(minuteurRef.current);
    minuteurRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => couper, [couper]);

  async function demarrer() {
    setErreur(null);
    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micro ? { exact: micro } : undefined,
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: false,
        },
      });
    } catch (e) {
      setErreur(messageErreurMicro(e));
      return;
    }
    listerMicros();
    fluxRef.current = flux;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const analyseur = ctx.createAnalyser();
    analyseur.fftSize = 2048;
    ctx.createMediaStreamSource(flux).connect(analyseur);
    const echantillons = new Float32Array(analyseur.fftSize);
    const reglage = REGLAGES[mode];

    let voixDepuis: number | null = null;
    let derniereVoix = 0;
    let debutSegment = 0;
    let tempsVoix = 0;
    let segmentEnCours = false;

    const fermerSegment = () => {
      segmentEnCours = false;
      voixDepuis = null;
      setEnregistre(false);
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder?.state === "recording") recorder.stop();
    };

    minuteurRef.current = setInterval(() => {
      analyseur.getFloatTimeDomainData(echantillons);
      let somme = 0;
      for (const v of echantillons) somme += v * v;
      const rms = Math.sqrt(somme / echantillons.length);
      setNiveau(rms);
      const maintenant = Date.now();
      const voix = rms > seuilRef.current;

      if (!segmentEnCours) {
        if (!voix) {
          voixDepuis = null;
          return;
        }
        voixDepuis ??= maintenant;
        if (maintenant - voixDepuis < VOIX_POUR_DEMARRER_MS) return;
        segmentEnCours = true;
        debutSegment = derniereVoix = maintenant;
        tempsVoix = 0;
        setEnregistre(true);
        const recorder = new MediaRecorder(flux);
        const morceaux: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) morceaux.push(e.data);
        };
        const voixDuSegment = () => tempsVoix;
        recorder.onstop = () => {
          // Un bruit bref (toux, choc) n'est pas envoyé à la transcription.
          if (voixDuSegment() >= VOIX_MINIMALE_MS) transcrire(new Blob(morceaux, { type: recorder.mimeType }));
        };
        recorder.start();
        recorderRef.current = recorder;
        return;
      }

      if (voix) {
        derniereVoix = maintenant;
        tempsVoix += 100;
      }
      const silence = maintenant - derniereVoix;
      const duree = maintenant - debutSegment;
      if (
        silence > SILENCE_FIN_ABSOLU ||
        (duree >= reglage.dureeMin && silence > reglage.silenceFin) ||
        duree > reglage.dureeMax
      ) {
        fermerSegment();
      }
    }, 100);

    setDebut(Date.now());
    setActif(true);
  }

  function arreter() {
    couper();
    setActif(false);
    setEnregistre(false);
    setNiveau(0);
    setDebut(null);
  }

  function choisirMode(m: ModeEcoute) {
    setMode(m);
    ecrire("modeEcoute", m);
  }

  function choisirMicro(id: string) {
    setMicroState(id);
    ecrire("micro", id);
  }

  function regler(valeur: number) {
    setSeuilState(valeur);
    seuilRef.current = valeur;
    ecrire("seuil", String(valeur));
  }

  return {
    actif,
    mode,
    enregistre,
    niveau,
    seuil,
    micros,
    micro,
    enTranscription,
    debut,
    erreur,
    demarrer,
    arreter,
    choisirMode,
    choisirMicro,
    regler,
  };
}
