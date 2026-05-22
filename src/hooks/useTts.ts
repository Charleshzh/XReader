import { useCallback, useEffect, useRef, useState } from "react";
import { splitIntoUtteranceChunks } from "@/lib/tts";

function canSpeak(): boolean {
  return typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
}

export function useTts(text: string, rate: number, toggleToken = 0) {
  const [playing, setPlaying] = useState(false);
  const queueRef = useRef<SpeechSynthesisUtterance[]>([]);

  const stop = useCallback(() => {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    queueRef.current = [];
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!canSpeak() || !text.trim()) return;

    stop();
    const chunks = splitIntoUtteranceChunks(text);
    if (chunks.length === 0) return;

    queueRef.current = chunks.map((chunk) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "zh-CN";
      utterance.rate = rate;
      return utterance;
    });

    const speakChunk = (index: number) => {
      const utterance = queueRef.current[index];
      if (!utterance) {
        setPlaying(false);
        return;
      }

      utterance.onstart = () => setPlaying(true);
      utterance.onend = () => {
        if (index + 1 < queueRef.current.length) {
          speakChunk(index + 1);
        } else {
          setPlaying(false);
        }
      };
      utterance.onerror = () => {
        setPlaying(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakChunk(0);
  }, [rate, stop, text]);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!text.trim() && playing) {
      queueMicrotask(() => {
        stop();
      });
    }
  }, [playing, stop, text]);

  useEffect(() => {
    if (toggleToken === 0) return;
    queueMicrotask(() => {
      if (playing) {
        stop();
        return;
      }
      play();
    });
  }, [toggleToken, playing, play, stop]);

  return {
    playing,
    play,
    stop,
    supported: canSpeak(),
  };
}
