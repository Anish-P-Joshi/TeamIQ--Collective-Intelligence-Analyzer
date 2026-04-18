import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLiveKit, LKTranscriptEntry } from "@/hooks/useLiveKit";
import { VideoTile } from "@/components/VideoTile";
import {
  Mic, MicOff, Video, VideoOff, BarChart3, Brain, TrendingUp, MessageSquare,
  Lightbulb, ArrowLeft, Activity, Target, Zap, Network, GitMerge, PhoneOff, Copy, Check
} from "lucide-react";

interface AnalysisData {
  intelligenceScore: number;
  participationBalance: number;
  ideaDiversity: number;
  currentTopics: string[];
  currentSpeaker?: string;
  aiInsights: { text: string; type: string; priority: number }[];
  keyDecisions: string[];
  actionItems: string[];
  sentimentOverall: string;
  engagementLevel: string;
  suggestedQuestions: string[];
  participantInsights: { name: string; talkTimePercent: number; ideas: number; sentiment: string }[];
  convergenceScore: number;
  noveltyScore: number;
  perspectiveRange?: number;
  balanceScore?: number;
  dominantVoices?: number;
  silentMembers?: number;
  interactions?: { from: string; to: string; weight: number }[];
  convergenceTimeline?: { minute: number; consensus: number; ideas: number; conflicts: number }[];
  qualityScore?: number;
}

const defaultAnalysis: AnalysisData = {
  intelligenceScore: 0, participationBalance: 0, ideaDiversity: 0,
  currentTopics: [], currentSpeaker: "",
  aiInsights: [{ text: "Waiting for participants and audio...", type: "info", priority: 1 }],
  keyDecisions: [], actionItems: [],
  sentimentOverall: "neutral", engagementLevel: "low",
  suggestedQuestions: [], participantInsights: [],
  convergenceScore: 0, noveltyScore: 0, perspectiveRange: 0,
  balanceScore: 0, dominantVoices: 0, silentMembers: 0,
  interactions: [], convergenceTimeline: [], qualityScore: 0,
};

const THEMES = [
  { bg: "linear-gradient(135deg, hsl(230 35% 8%) 0%, hsl(260 40% 14%) 50%, hsl(220 45% 10%) 100%)", panel: "hsl(230 30% 12% / 0.7)", border: "hsl(260 40% 30%)", text: "hsl(220 20% 96%)", muted: "hsl(220 15% 65%)", accent: "hsl(280 80% 65%)" },
  { bg: "linear-gradient(135deg, hsl(200 60% 8%) 0%, hsl(180 50% 12%) 50%, hsl(220 55% 10%) 100%)", panel: "hsl(200 40% 14% / 0.7)", border: "hsl(180 50% 30%)", text: "hsl(180 20% 96%)", muted: "hsl(190 20% 65%)", accent: "hsl(170 80% 55%)" },
  { bg: "linear-gradient(135deg, hsl(15 60% 10%) 0%, hsl(345 50% 14%) 50%, hsl(25 55% 12%) 100%)", panel: "hsl(15 40% 14% / 0.7)", border: "hsl(15 60% 35%)", text: "hsl(30 25% 96%)", muted: "hsl(20 20% 70%)", accent: "hsl(20 90% 60%)" },
  { bg: "linear-gradient(135deg, hsl(150 50% 8%) 0%, hsl(170 45% 12%) 50%, hsl(140 50% 10%) 100%)", panel: "hsl(150 35% 14% / 0.7)", border: "hsl(150 50% 30%)", text: "hsl(150 20% 96%)", muted: "hsl(150 15% 70%)", accent: "hsl(150 70% 55%)" },
  { bg: "linear-gradient(135deg, hsl(280 50% 10%) 0%, hsl(320 45% 14%) 50%, hsl(260 50% 12%) 100%)", panel: "hsl(280 35% 16% / 0.7)", border: "hsl(300 50% 35%)", text: "hsl(300 20% 96%)", muted: "hsl(290 15% 70%)", accent: "hsl(320 85% 65%)" },
  { bg: "linear-gradient(135deg, hsl(220 70% 8%) 0%, hsl(245 60% 14%) 50%, hsl(210 65% 10%) 100%)", panel: "hsl(220 50% 14% / 0.7)", border: "hsl(220 60% 35%)", text: "hsl(210 25% 97%)", muted: "hsl(215 20% 70%)", accent: "hsl(210 95% 65%)" },
  { bg: "linear-gradient(135deg, hsl(195 60% 10%) 0%, hsl(220 55% 14%) 50%, hsl(180 50% 12%) 100%)", panel: "hsl(200 45% 14% / 0.7)", border: "hsl(190 55% 35%)", text: "hsl(195 25% 96%)", muted: "hsl(195 15% 70%)", accent: "hsl(190 90% 60%)" },
];

const PARTICIPANT_COLORS = ["hsl(210 90% 60%)", "hsl(150 70% 55%)", "hsl(280 80% 65%)", "hsl(30 90% 60%)", "hsl(190 85% 55%)", "hsl(330 80% 65%)", "hsl(50 90% 60%)", "hsl(170 70% 55%)"];

const MeetingAnalysis = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const org = searchParams.get("org") || "";
  const title = searchParams.get("title") || "Team Meeting";
  const roomName = searchParams.get("room") || "";
  const displayName = searchParams.get("name") || "Guest";

  const theme = useMemo(() => THEMES[Math.floor(Math.random() * THEMES.length)], []);

  // Stable identity per tab
  const identity = useMemo(() => `${displayName.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`, [displayName]);

  const {
    isConnected, participants, entries, interim, transcript, error: lkError,
    connect, disconnect, toggleMic, toggleCam, room,
  } = useLiveKit({ roomName, identity, displayName });

  const [analysis, setAnalysis] = useState<AnalysisData>(defaultAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muteWarnings, setMuteWarnings] = useState<{ name: string; seconds: number; ts: number }[]>([]);

  const lastAnalyzedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const lastWarningRef = useRef<Map<string, number>>(new Map());

  // Meeting timer
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => setMeetingTime(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isConnected]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [entries, interim]);

  // Mute-duration insights — fire once per participant per >90s mute
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      participants.forEach(p => {
        if (!p.audioMuted || !p.mutedSince) return;
        const mutedSec = Math.floor((now - p.mutedSince) / 1000);
        if (mutedSec < 90) return;
        const lastWarn = lastWarningRef.current.get(p.identity) || 0;
        if (now - lastWarn < 120000) return; // re-warn at most every 2 min
        lastWarningRef.current.set(p.identity, now);
        setMuteWarnings(prev => [...prev.slice(-4), { name: p.name, seconds: mutedSec, ts: now }]);
      });
    }, 10000);
    return () => clearInterval(id);
  }, [participants]);

  // AI analysis — use real transcript
  const runAnalysis = useCallback(async () => {
    if (!transcript || transcript === lastAnalyzedRef.current || isAnalyzing) return;
    lastAnalyzedRef.current = transcript;
    setIsAnalyzing(true);
    try {
      const participantNames = participants.map(p => p.name);
      const { data, error } = await supabase.functions.invoke('analyze-meeting', {
        body: {
          transcript,
          participants: participantNames,
          organization: org,
          meetingTitle: title,
          meetingTimeSeconds: meetingTime,
          mutedParticipants: participants.filter(p => p.audioMuted && p.mutedSince).map(p => ({
            name: p.name,
            mutedSeconds: Math.floor((Date.now() - (p.mutedSince || 0)) / 1000),
          })),
        }
      });
      if (error) { console.error('Analysis error:', error); return; }
      if (data?.analysis) {
        // Merge mute warnings into AI insights
        const warnings = muteWarnings.map(w => ({
          text: `${w.name} has been muted for ${Math.floor(w.seconds / 60)}m ${w.seconds % 60}s — they may have something to share.`,
          type: 'warning',
          priority: 2,
        }));
        const merged = [...warnings, ...(data.analysis.aiInsights || [])].slice(0, 6);
        setAnalysis({ ...data.analysis, aiInsights: merged });
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transcript, participants, org, title, meetingTime, isAnalyzing, muteWarnings]);

  useEffect(() => {
    if (!isConnected) return;
    const firstTimer = setTimeout(() => { runAnalysis(); }, 8000);
    analysisIntervalRef.current = setInterval(() => { runAnalysis(); }, 12000);
    return () => {
      clearTimeout(firstTimer);
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    };
  }, [isConnected, runAnalysis]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const insightColor = (type: string) => type === 'warning' ? 'hsl(40 95% 65%)' : type === 'positive' ? 'hsl(150 70% 60%)' : 'hsl(210 90% 70%)';

  const currentSpeaker = participants.find(p => p.isSpeaking)?.name || analysis.currentSpeaker || (entries.length > 0 ? entries[entries.length - 1].speaker : '');

  const panelStyle: React.CSSProperties = {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    backdropFilter: 'blur(12px)',
    color: theme.text,
  };

  const handleJoin = async () => {
    setHasJoined(true);
    await connect();
  };

  const handleLeave = async () => {
    await disconnect();
    navigate('/');
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/meeting-analysis?room=${encodeURIComponent(roomName)}&org=${encodeURIComponent(org)}&title=${encodeURIComponent(title)}&name=`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const localParticipant = participants.find(p => p.isLocal);

  // Pre-join screen
  if (!hasJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: theme.bg, color: theme.text }}>
        <div className="max-w-md w-full rounded-2xl p-8" style={panelStyle}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: theme.accent }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl">{title}</h1>
              <p className="text-xs" style={{ color: theme.muted }}>{org || 'TeamIQ Meeting'}</p>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span style={{ color: theme.muted }}>Joining as</span>
              <span className="font-medium">{displayName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: theme.muted }}>Room</span>
              <span className="font-mono text-xs">{roomName}</span>
            </div>
          </div>
          <button onClick={handleJoin}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium"
                  style={{ background: theme.accent, color: 'white' }}>
            <Video className="w-5 h-5" /> Join Meeting
          </button>
          <p className="text-xs mt-4 text-center" style={{ color: theme.muted }}>
            Camera & microphone permission required. Use Chrome or Edge for live transcription.
          </p>
          {lkError && <p className="text-sm mt-4 text-center" style={{ color: 'hsl(0 80% 70%)' }}>{lkError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
      <header className="px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl"
              style={{ background: theme.panel, borderBottom: `1px solid ${theme.border}` }}>
        <div className="flex items-center gap-4">
          <button onClick={handleLeave} style={{ color: theme.muted }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: theme.accent }}>
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">TeamIQ</span>
          </div>
          <div className="hidden sm:block h-6 w-px" style={{ background: theme.border }} />
          <h1 className="hidden sm:block text-sm truncate max-w-[200px]" style={{ color: theme.muted }}>{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ background: 'hsl(150 70% 50% / 0.2)', color: 'hsl(150 70% 70%)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'hsl(150 70% 60%)' }} />
              Live • {formatTime(meetingTime)}
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{ background: 'hsl(210 90% 50% / 0.2)', color: 'hsl(210 90% 75%)' }}>
              <Activity className="w-3 h-3 animate-spin" /> Analyzing
            </div>
          )}
          <button onClick={copyShareLink}
                  className="flex items-center gap-1 text-xs px-3 py-1 rounded transition"
                  style={{ color: theme.muted, border: `1px solid ${theme.border}` }}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Invite'}
          </button>
          <button onClick={() => setShowAnalytics(!showAnalytics)}
                  className="text-sm px-3 py-1 rounded transition hidden md:block"
                  style={{ color: theme.muted, border: `1px solid ${theme.border}` }}>
            {showAnalytics ? 'Hide' : 'Show'} Analytics
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
        {/* Left: Video grid + Transcript */}
        <div className={`flex-1 flex flex-col ${showAnalytics ? 'lg:w-2/3' : 'lg:w-full'} overflow-hidden`}>
          {/* Video grid */}
          <div className="p-4">
            <div className={`grid gap-3 ${participants.length === 1 ? 'grid-cols-1' : participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {participants.map((p, i) => {
                const lkParticipant = p.isLocal
                  ? room.localParticipant
                  : Array.from(room.remoteParticipants.values()).find(rp => rp.identity === p.identity);
                if (!lkParticipant) return null;
                return (
                  <VideoTile
                    key={p.identity}
                    participant={lkParticipant as any}
                    isLocal={p.isLocal}
                    color={PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length]}
                    isSpeaking={p.isSpeaking}
                    audioMuted={p.audioMuted}
                    videoMuted={p.videoMuted}
                    theme={theme}
                  />
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="px-4 pb-2">
            <div className="rounded-xl p-3 flex items-center justify-center gap-3" style={panelStyle}>
              <button onClick={toggleMic}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition"
                      style={{
                        background: localParticipant?.audioMuted ? 'hsl(0 70% 50%)' : 'hsl(0 0% 100% / 0.1)',
                        border: `1px solid ${theme.border}`,
                      }}>
                {localParticipant?.audioMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" style={{ color: theme.text }} />}
              </button>
              <button onClick={toggleCam}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition"
                      style={{
                        background: localParticipant?.videoMuted ? 'hsl(0 70% 50%)' : 'hsl(0 0% 100% / 0.1)',
                        border: `1px solid ${theme.border}`,
                      }}>
                {localParticipant?.videoMuted ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5" style={{ color: theme.text }} />}
              </button>
              <button onClick={handleLeave}
                      className="px-4 h-11 rounded-full flex items-center gap-2 transition font-medium"
                      style={{ background: 'hsl(0 75% 50%)', color: 'white' }}>
                <PhoneOff className="w-4 h-4" /> Leave
              </button>
            </div>
          </div>

          {/* Currently Speaking strip */}
          <div className="px-4 pb-2">
            <div className="rounded-xl p-3" style={panelStyle}>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider" style={{ color: theme.muted }}>Currently Speaking</span>
                <span className="text-sm font-bold" style={{ color: theme.accent }}>{currentSpeaker || '—'}</span>
              </div>
            </div>
          </div>

          {/* Live Transcript */}
          <div className="flex-1 overflow-hidden px-4 pb-4">
            <div className="rounded-xl p-4 h-full flex flex-col" style={panelStyle}>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4" style={{ color: theme.accent }} />
                <h3 className="text-sm font-medium">Live Transcript</h3>
                {isConnected && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'hsl(0 90% 60%)' }} />}
              </div>
              <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto text-sm leading-relaxed space-y-2 pr-2">
                {entries.length === 0 && !interim ? (
                  <span className="italic" style={{ color: theme.muted }}>
                    {isConnected ? 'Listening for speech...' : 'Connecting...'}
                  </span>
                ) : (
                  entries.map((e, i) => {
                    const colorIdx = participants.findIndex(p => p.identity === e.identity || p.name === e.speaker);
                    const color = PARTICIPANT_COLORS[(colorIdx >= 0 ? colorIdx : i) % PARTICIPANT_COLORS.length];
                    return (
                      <div key={i} className="flex gap-2">
                        <span className="font-bold flex-shrink-0" style={{ color }}>{e.speaker}:</span>
                        <span style={{ color: theme.text }}>{e.text}</span>
                      </div>
                    );
                  })
                )}
                {interim && (
                  <div className="flex gap-2">
                    <span className="font-bold" style={{ color: theme.accent }}>{interim.speaker}:</span>
                    <span className="italic" style={{ color: theme.muted }}>{interim.text}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Analytics */}
        {showAnalytics && (
          <div className="lg:w-[420px] overflow-y-auto" style={{ borderLeft: `1px solid ${theme.border}` }}>
            <div className="p-4 space-y-4">
              <div className="rounded-xl p-4" style={panelStyle}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: theme.muted }}>Intelligence Score</span>
                  <TrendingUp className="w-4 h-4" style={{ color: theme.accent }} />
                </div>
                <div className="text-3xl font-bold">{analysis.intelligenceScore.toFixed(1)}<span className="text-lg" style={{ color: theme.muted }}>/10</span></div>
                <p className="text-xs mt-1" style={{ color: theme.muted }}>Real-time discussion quality</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={panelStyle}>
                  <span className="text-xs" style={{ color: theme.muted }}>Participation Balance</span>
                  <div className="text-2xl font-bold mt-1" style={{ color: theme.accent }}>{analysis.participationBalance}%</div>
                </div>
                <div className="rounded-xl p-4" style={panelStyle}>
                  <span className="text-xs" style={{ color: theme.muted }}>Idea Diversity</span>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'hsl(190 90% 65%)' }}>{analysis.ideaDiversity}%</div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="rounded-xl p-4" style={panelStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4" style={{ color: theme.accent }} />
                  <h3 className="text-sm font-medium">AI Insights</h3>
                </div>
                <div className="space-y-2">
                  {analysis.aiInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: insightColor(insight.type) }} />
                      <p className="text-xs" style={{ color: insightColor(insight.type) }}>{insight.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Participation Heatmap */}
              {(analysis.participantInsights.length > 0 || participants.length > 0) && (
                <div className="rounded-xl p-4" style={panelStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" style={{ color: theme.accent }} />
                      <h3 className="text-sm font-medium">Participation Heatmap</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'hsl(150 70% 50% / 0.2)', color: 'hsl(150 70% 70%)' }}>Live</span>
                  </div>
                  <div className="space-y-3">
                    {(analysis.participantInsights.length > 0
                      ? analysis.participantInsights
                      : participants.map(p => ({ name: p.name, talkTimePercent: 0, ideas: 0, sentiment: 'neutral' }))
                    ).map((p, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: theme.text }}>{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ color: theme.muted }}>{p.ideas} ideas</span>
                            <span className="font-medium">{p.talkTimePercent}%</span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: theme.border }}>
                          <div className="h-full rounded-full transition-all duration-1000"
                               style={{ width: `${p.talkTimePercent}%`, background: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <div className="text-center">
                      <div className="text-lg font-bold">{(analysis.balanceScore || 0).toFixed(2)}</div>
                      <div className="text-[10px]" style={{ color: theme.muted }}>Balance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{analysis.dominantVoices || 0}</div>
                      <div className="text-[10px]" style={{ color: theme.muted }}>Dominant</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{analysis.silentMembers || participants.filter(p => p.audioMuted).length}</div>
                      <div className="text-[10px]" style={{ color: theme.muted }}>Silent</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Diversity Meter */}
              <div className="rounded-xl p-4" style={panelStyle}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: 'hsl(50 95% 60%)' }} />
                    <h3 className="text-sm font-medium">Diversity Meter</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'hsl(150 70% 50% / 0.2)', color: 'hsl(150 70% 70%)' }}>Live</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Idea Diversity', value: analysis.ideaDiversity },
                    { label: 'Perspective Range', value: analysis.perspectiveRange || 0 },
                    { label: 'Novelty Score', value: analysis.noveltyScore },
                    { label: 'Convergence Level', value: analysis.convergenceScore },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: theme.muted }}>{item.label}</span>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: theme.border }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                             style={{ width: `${item.value}%`, background: `linear-gradient(90deg, ${theme.accent}, hsl(190 90% 60%))` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interaction Network — show even with single participant */}
              <div className="rounded-xl p-4" style={panelStyle}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4" style={{ color: 'hsl(280 80% 70%)' }} />
                    <h3 className="text-sm font-medium">Interaction Network</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'hsl(150 70% 50% / 0.2)', color: 'hsl(150 70% 70%)' }}>Live</span>
                </div>
                <InteractionNetwork
                  participants={analysis.participantInsights.length > 0
                    ? analysis.participantInsights
                    : participants.map(p => ({ name: p.name, talkTimePercent: p.isSpeaking ? 50 : 10 }))}
                  interactions={analysis.interactions || []}
                  colors={PARTICIPANT_COLORS}
                  theme={theme}
                />
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div className="text-center">
                    <div className="text-lg font-bold">{analysis.interactions?.length || 0}</div>
                    <div className="text-[10px]" style={{ color: theme.muted }}>Active Connections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">1.0s</div>
                    <div className="text-[10px]" style={{ color: theme.muted }}>Avg Response</div>
                  </div>
                </div>
              </div>

              {/* Convergence Analysis */}
              <div className="rounded-xl p-4" style={panelStyle}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-4 h-4" style={{ color: 'hsl(150 70% 60%)' }} />
                    <h3 className="text-sm font-medium">Convergence Analysis</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'hsl(150 70% 50% / 0.2)', color: 'hsl(150 70% 70%)' }}>Live</span>
                </div>
                <ConvergenceChart timeline={analysis.convergenceTimeline || []} theme={theme} />
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
                  <div className="text-center">
                    <div className="text-lg font-bold" style={{ color: 'hsl(150 70% 60%)' }}>{analysis.convergenceScore}%</div>
                    <div className="text-[10px]" style={{ color: theme.muted }}>Consensus</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{Math.floor(meetingTime / 60)}m</div>
                    <div className="text-[10px]" style={{ color: theme.muted }}>Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold" style={{ color: theme.accent }}>{analysis.qualityScore || 0}</div>
                    <div className="text-[10px]" style={{ color: theme.muted }}>Quality</div>
                  </div>
                </div>
              </div>

              {analysis.currentTopics.length > 0 && (
                <div className="rounded-xl p-4" style={panelStyle}>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4" style={{ color: theme.accent }} />
                    <h3 className="text-sm font-medium">Current Topics</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.currentTopics.map((topic, i) => (
                      <span key={i} className="text-xs rounded-full px-3 py-1" style={{ background: theme.border, color: theme.text }}>{topic}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.suggestedQuestions.length > 0 && (
                <div className="rounded-xl p-4" style={panelStyle}>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4" style={{ color: 'hsl(40 95% 65%)' }} />
                    <h3 className="text-sm font-medium">Suggested Questions</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.suggestedQuestions.map((q, i) => (
                      <p key={i} className="text-xs rounded-lg p-2" style={{ color: theme.muted, background: theme.border }}>💡 {q}</p>
                    ))}
                  </div>
                </div>
              )}

              {analysis.keyDecisions.length > 0 && (
                <div className="rounded-xl p-4" style={panelStyle}>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span style={{ color: 'hsl(150 70% 60%)' }}>✓</span> Key Decisions
                  </h3>
                  {analysis.keyDecisions.map((d, i) => (
                    <p key={i} className="text-xs mb-1" style={{ color: theme.text }}>• {d}</p>
                  ))}
                </div>
              )}

              {analysis.actionItems.length > 0 && (
                <div className="rounded-xl p-4" style={panelStyle}>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span style={{ color: 'hsl(210 90% 65%)' }}>→</span> Action Items
                  </h3>
                  {analysis.actionItems.map((a, i) => (
                    <p key={i} className="text-xs mb-1" style={{ color: theme.text }}>• {a}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InteractionNetwork: React.FC<{
  participants: { name: string; talkTimePercent: number }[];
  interactions: { from: string; to: string; weight: number }[];
  colors: string[];
  theme: any;
}> = ({ participants, interactions, colors, theme }) => {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = participants.length > 1 ? 85 : 0;
  const nodes = participants.map((p, i) => {
    const angle = (i / Math.max(participants.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { ...p, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), color: colors[i % colors.length] };
  });
  const nameToNode = new Map(nodes.map(n => [n.name, n]));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      {interactions.map((edge, i) => {
        const a = nameToNode.get(edge.from);
        const b = nameToNode.get(edge.to);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                     stroke={theme.accent} strokeOpacity={0.3 + (edge.weight / 10) * 0.6}
                     strokeWidth={1 + edge.weight / 3} />;
      })}
      {nodes.map((n, i) => {
        const nodeR = 14 + (n.talkTimePercent / 100) * 14;
        return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={nodeR} fill={n.color} fillOpacity={0.85} />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
              {n.name.split(' ')[0].slice(0, 6)}
            </text>
            <text x={n.x} y={n.y + nodeR + 11} textAnchor="middle" fontSize="9" fill={theme.muted}>
              {n.talkTimePercent}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const ConvergenceChart: React.FC<{
  timeline: { minute: number; consensus: number; ideas: number; conflicts: number }[];
  theme: any;
}> = ({ timeline, theme }) => {
  const w = 380;
  const h = 120;
  const padding = 20;
  const data = timeline.length > 0 ? timeline : [{ minute: 0, consensus: 0, ideas: 0, conflicts: 0 }];
  const maxMin = Math.max(...data.map(d => d.minute), 5);

  const toPath = (key: 'consensus' | 'ideas' | 'conflicts') =>
    data.map((d, i) => {
      const x = padding + ((d.minute) / maxMin) * (w - padding * 2);
      const y = h - padding - (d[key] / 100) * (h - padding * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

  const series: { key: 'consensus' | 'ideas' | 'conflicts'; color: string; label: string }[] = [
    { key: 'consensus', color: 'hsl(150 70% 60%)', label: 'Consensus' },
    { key: 'ideas', color: theme.accent, label: 'Ideas' },
    { key: 'conflicts', color: 'hsl(0 80% 65%)', label: 'Conflicts' },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {[0, 25, 50, 75, 100].map(v => {
          const y = h - padding - (v / 100) * (h - padding * 2);
          return <line key={v} x1={padding} y1={y} x2={w - padding} y2={y} stroke={theme.border} strokeWidth={0.5} />;
        })}
        {series.map(s => (
          <path key={s.key} d={toPath(s.key)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}
      </svg>
      <div className="flex items-center justify-center gap-3 mt-1">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px]" style={{ color: theme.muted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MeetingAnalysis;
