import React, { useEffect, useRef } from 'react';
import { Room, Track, RemoteParticipant, LocalParticipant, RemoteTrackPublication } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface VideoTileProps {
  participant: LocalParticipant | RemoteParticipant;
  isLocal: boolean;
  color: string;
  isSpeaking: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
  theme: any;
}

export const VideoTile: React.FC<VideoTileProps> = ({ participant, isLocal, color, isSpeaking, audioMuted, videoMuted, theme }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!videoEl) return;

    const attachTracks = () => {
      // Video
      let videoTrack: any = null;
      participant.videoTrackPublications.forEach((pub: any) => {
        if (!videoTrack && pub.kind === Track.Kind.Video) videoTrack = pub.track;
      });
      if (videoTrack && videoEl) videoTrack.attach(videoEl);

      // Audio (only for remote — local mic shouldn't loop back)
      if (!isLocal && audioEl) {
        let audioTrack: any = null;
        participant.audioTrackPublications.forEach((pub: any) => {
          if (!audioTrack && pub.kind === Track.Kind.Audio) audioTrack = pub.track;
        });
        if (audioTrack) audioTrack.attach(audioEl);
      }
    };

    attachTracks();
    const interval = setInterval(attachTracks, 1000);

    return () => {
      clearInterval(interval);
      participant.videoTrackPublications.forEach(p => p.track?.detach());
      if (!isLocal) participant.audioTrackPublications.forEach(p => p.track?.detach());
    };
  }, [participant, isLocal]);

  const initials = (participant.name || participant.identity).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="relative rounded-xl overflow-hidden aspect-video transition-all"
      style={{
        background: 'hsl(220 30% 8%)',
        border: `2px solid ${isSpeaking ? color : theme.border}`,
        boxShadow: isSpeaking ? `0 0 24px ${color}88` : 'none',
      }}
    >
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-cover" />
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {videoMuted && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'hsl(220 30% 8%)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: color, color: 'white' }}>
            {initials}
          </div>
        </div>
      )}

      {/* Name + status */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium" style={{ background: 'hsl(0 0% 0% / 0.6)', color: 'white' }}>
          {audioMuted ? <MicOff className="w-3 h-3" style={{ color: 'hsl(0 80% 65%)' }} /> : <Mic className="w-3 h-3" style={{ color: 'hsl(150 70% 60%)' }} />}
          {participant.name || participant.identity}{isLocal && ' (You)'}
        </div>
        {isSpeaking && (
          <div className="px-2 py-1 rounded-md text-[10px] font-bold uppercase" style={{ background: color, color: 'white' }}>
            Speaking
          </div>
        )}
      </div>
    </div>
  );
};
