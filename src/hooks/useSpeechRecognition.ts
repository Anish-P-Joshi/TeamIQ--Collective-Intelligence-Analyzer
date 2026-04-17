import { useState, useRef, useCallback, useEffect } from 'react';

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

export function useSpeechRecognition(speakers: string[] = []) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeakerState] = useState<string>(speakers[0] || 'Speaker');
  const recognitionRef = useRef<any>(null);
  const activeSpeakerRef = useRef<string>(speakers[0] || 'Speaker');
  const lastFinalTimeRef = useRef<number>(0);
  const speakersRef = useRef<string[]>(speakers);

  useEffect(() => {
    speakersRef.current = speakers;
    if (speakers.length && !speakers.includes(activeSpeakerRef.current)) {
      activeSpeakerRef.current = speakers[0];
      setActiveSpeakerState(speakers[0]);
    }
  }, [speakers]);

  const setActiveSpeaker = useCallback((s: string) => {
    activeSpeakerRef.current = s;
    setActiveSpeakerState(s);
  }, []);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            const now = Date.now();
            // Auto-rotate speaker on long pauses (>4s) if multiple speakers configured
            if (speakersRef.current.length > 1 && now - lastFinalTimeRef.current > 4000) {
              const idx = speakersRef.current.indexOf(activeSpeakerRef.current);
              const next = speakersRef.current[(idx + 1) % speakersRef.current.length];
              activeSpeakerRef.current = next;
              setActiveSpeakerState(next);
            }
            lastFinalTimeRef.current = now;
            setEntries(prev => [...prev, {
              speaker: activeSpeakerRef.current,
              text,
              timestamp: now,
            }]);
          }
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognition.start(); } catch { setIsListening(false); }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setError('Failed to start speech recognition. Please check microphone permissions.');
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setIsListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInterimTranscript('');
    setEntries([]);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Build a flat transcript string for the AI
  const transcript = entries.map(e => `${e.speaker}: ${e.text}`).join('\n');

  return {
    isListening,
    transcript,
    interimTranscript,
    entries,
    error,
    isSupported,
    activeSpeaker,
    setActiveSpeaker,
    start,
    stop,
    reset,
  };
}
