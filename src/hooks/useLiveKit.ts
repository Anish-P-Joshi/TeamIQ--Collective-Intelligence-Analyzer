import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  Track,
  Participant,
  ConnectionState,
  DataPacket_Kind,
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface LKTranscriptEntry {
  speaker: string;     // participant.name (display) — auto-identified
  identity: string;    // participant.identity
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface ParticipantState {
  identity: string;
  name: string;
  isLocal: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  mutedSince: number | null; // ms timestamp when audio was muted, null if unmuted
  joinedAt: number;
}

interface UseLiveKitOptions {
  roomName: string;
  identity: string;
  displayName: string;
  onTranscript?: (entry: LKTranscriptEntry) => void;
  onParticipantJoined?: (name: string) => void;
  onParticipantLeft?: (name: string) => void;
}

export function useLiveKit({ roomName, identity, displayName, onTranscript, onParticipantJoined, onParticipantLeft }: UseLiveKitOptions) {
  const [room] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
  }));
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [entries, setEntries] = useState<LKTranscriptEntry[]>([]);
  const [interim, setInterim] = useState<{ speaker: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-participant SpeechRecognition for remote participants. Local uses browser mic directly.
  const recognizersRef = useRef<Map<string, any>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const refreshParticipants = useCallback(() => {
    const list: ParticipantState[] = [];
    const local = room.localParticipant;
    if (local) {
      list.push({
        identity: local.identity,
        name: local.name || local.identity,
        isLocal: true,
        audioMuted: !local.isMicrophoneEnabled,
        videoMuted: !local.isCameraEnabled,
        isSpeaking: local.isSpeaking,
        audioLevel: local.audioLevel,
        mutedSince: !local.isMicrophoneEnabled ? Date.now() : null,
        joinedAt: Date.now(),
      });
    }
    room.remoteParticipants.forEach(p => {
      let audioMuted = true;
      let videoMuted = true;
      p.audioTrackPublications.forEach((pub: any) => { if (!pub.isMuted) audioMuted = false; });
      p.videoTrackPublications.forEach((pub: any) => { if (!pub.isMuted) videoMuted = false; });
      if (p.audioTrackPublications.size === 0) audioMuted = true;
      if (p.videoTrackPublications.size === 0) videoMuted = true;
      list.push({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal: false,
        audioMuted,
        videoMuted,
        isSpeaking: p.isSpeaking,
        audioLevel: p.audioLevel,
        mutedSince: null,
        joinedAt: Date.now(),
      });
    });
    setParticipants(prev => {
      // preserve mutedSince timestamps
      const prevMap = new Map(prev.map(p => [p.identity, p]));
      return list.map(p => {
        const old = prevMap.get(p.identity);
        if (!old) return { ...p, mutedSince: p.audioMuted ? Date.now() : null };
        return {
          ...p,
          mutedSince: p.audioMuted
            ? (old.mutedSince ?? Date.now())
            : null,
          joinedAt: old.joinedAt,
        };
      });
    });
  }, [room]);

  // Start a SpeechRecognition tied to a remote participant's audio MediaStream.
  const startRecognitionForRemote = useCallback((participant: RemoteParticipant, track: RemoteTrack) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recognizersRef.current.has(participant.identity)) return;
    if (track.kind !== Track.Kind.Audio) return;

    // We must play the audio for the user to hear it AND for SR to pick it up via mic loopback...
    // Instead, attach the MediaStreamTrack to a hidden <audio> for playback, but Web Speech can't
    // listen to a specific stream. So we use a fallback: keep playback, and rely on shared mic
    // capture won't work. Best effort: per-track recognition isn't natively possible in browser.
    // We label by speaker name using the loudest active participant heuristic instead.
    const audioEl = new Audio();
    audioEl.srcObject = new MediaStream([(track as any).mediaStreamTrack]);
    audioEl.autoplay = true;
    audioEl.muted = false;
    audioElsRef.current.set(participant.identity, audioEl);
    document.body.appendChild(audioEl);
  }, []);

  const stopRecognitionForRemote = useCallback((identity: string) => {
    const rec = recognizersRef.current.get(identity);
    if (rec) { try { rec.stop(); } catch {} recognizersRef.current.delete(identity); }
    const el = audioElsRef.current.get(identity);
    if (el) { el.remove(); audioElsRef.current.delete(identity); }
  }, []);

  // Single SpeechRecognition on local mic; speaker is determined dynamically by who is currently
  // speaking in the room (LiveKit gives us isSpeaking + audioLevel per participant).
  const localRecRef = useRef<any>(null);
  const lastSpeakerRef = useRef<string>('');

  const determineActiveSpeaker = useCallback((): { name: string; identity: string } => {
    // Pick the participant with the highest audioLevel among those marked as speaking
    let best: { name: string; identity: string; level: number } | null = null;
    const local = room.localParticipant;
    if (local && local.isSpeaking) {
      best = { name: local.name || local.identity, identity: local.identity, level: local.audioLevel };
    }
    room.remoteParticipants.forEach(p => {
      if (p.isSpeaking && (!best || p.audioLevel > best.level)) {
        best = { name: p.name || p.identity, identity: p.identity, level: p.audioLevel };
      }
    });
    if (best) return { name: best.name, identity: best.identity };
    // fallback to last speaker
    return { name: lastSpeakerRef.current || (local?.name || local?.identity || 'Speaker'), identity: local?.identity || 'unknown' };
  }, [room]);

  const startLocalRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }
    if (localRecRef.current) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      let interimText = '';
      // Local mic only captures the LOCAL speaker — always attribute to ourselves.
      const local = room.localParticipant;
      const speaker = { name: local?.name || displayName, identity: local?.identity || identity };
      lastSpeakerRef.current = speaker.name;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          const entry: LKTranscriptEntry = {
            speaker: speaker.name,
            identity: speaker.identity,
            text,
            timestamp: Date.now(),
            isFinal: true,
          };
          setEntries(prev => [...prev, entry]);
          onTranscriptRef.current?.(entry);
          // Broadcast to other participants via LiveKit data channel
          try {
            const payload = textEncoder.encode(JSON.stringify({ type: 'transcript', entry }));
            local?.publishData(payload, { reliable: true });
          } catch (err) { console.warn('publishData failed', err); }
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText ? { speaker: speaker.name, text: interimText } : null);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('SR error:', e.error);
    };

    rec.onend = () => {
      if (localRecRef.current === rec) {
        try { rec.start(); } catch { }
      }
    };

    localRecRef.current = rec;
    try { rec.start(); } catch (e) { console.error('Failed to start SR', e); }
  }, [determineActiveSpeaker]);

  const stopLocalRecognition = useCallback(() => {
    const rec = localRecRef.current;
    localRecRef.current = null;
    if (rec) { try { rec.stop(); } catch {} }
  }, []);

  // Connect
  const connect = useCallback(async () => {
    if (room.state !== ConnectionState.Disconnected) return;
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('livekit-token', {
        body: { roomName, identity, name: displayName },
      });
      if (fnError) throw fnError;
      if (!data?.token || !data?.url) throw new Error('No token returned');

      await room.connect(data.url, data.token);
      await room.localParticipant.enableCameraAndMicrophone();
      refreshParticipants();
      startLocalRecognition();
    } catch (e: any) {
      console.error('LiveKit connect failed', e);
      setError(e?.message || 'Failed to join room');
    }
  }, [room, roomName, identity, displayName, refreshParticipants, startLocalRecognition]);

  const disconnect = useCallback(async () => {
    stopLocalRecognition();
    recognizersRef.current.forEach((_, id) => stopRecognitionForRemote(id));
    await room.disconnect();
  }, [room, stopLocalRecognition, stopRecognitionForRemote]);

  const toggleMic = useCallback(async () => {
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    refreshParticipants();
  }, [room, refreshParticipants]);

  const toggleCam = useCallback(async () => {
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    refreshParticipants();
  }, [room, refreshParticipants]);

  const joinCbRef = useRef(onParticipantJoined);
  const leaveCbRef = useRef(onParticipantLeft);
  useEffect(() => { joinCbRef.current = onParticipantJoined; }, [onParticipantJoined]);
  useEffect(() => { leaveCbRef.current = onParticipantLeft; }, [onParticipantLeft]);

  // Wire up room events
  useEffect(() => {
    const onState = (s: ConnectionState) => setConnectionState(s);
    const onParticipantConnected = (p: RemoteParticipant) => {
      joinCbRef.current?.(p.name || p.identity);
      refreshParticipants();
    };
    const onParticipantDisconnected = (p: RemoteParticipant) => {
      leaveCbRef.current?.(p.name || p.identity);
      stopRecognitionForRemote(p.identity);
      refreshParticipants();
    };
    const onTrackSubscribed = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        startRecognitionForRemote(p, track);
      }
      refreshParticipants();
    };
    const onTrackUnsubscribed = (_t: RemoteTrack, _p: RemoteTrackPublication, p: RemoteParticipant) => {
      refreshParticipants();
    };
    const onTrackMuted = () => refreshParticipants();
    const onTrackUnmuted = () => refreshParticipants();
    const onActiveSpeakers = (_speakers: Participant[]) => refreshParticipants();
    const onDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const msg = JSON.parse(textDecoder.decode(payload));
        if (msg?.type === 'transcript' && msg.entry) {
          const entry: LKTranscriptEntry = msg.entry;
          setEntries(prev => {
            // dedup by identity+timestamp+text
            if (prev.some(e => e.identity === entry.identity && e.timestamp === entry.timestamp && e.text === entry.text)) return prev;
            return [...prev, entry];
          });
          onTranscriptRef.current?.(entry);
        }
      } catch (e) { /* ignore */ }
    };

    room.on(RoomEvent.ConnectionStateChanged, onState);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
    room.on(RoomEvent.DataReceived, onDataReceived);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onState);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, refreshParticipants, startRecognitionForRemote, stopRecognitionForRemote]);

  // Poll audio levels to keep speaking state live
  useEffect(() => {
    const id = setInterval(refreshParticipants, 500);
    return () => clearInterval(id);
  }, [refreshParticipants]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopLocalRecognition();
      recognizersRef.current.forEach((_, id) => stopRecognitionForRemote(id));
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transcript = entries.map(e => `${e.speaker}: ${e.text}`).join('\n');

  return {
    room,
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
    participants,
    entries,
    interim,
    transcript,
    error,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
  };
}
