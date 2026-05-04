import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLiveKit, LKTranscriptEntry } from "@/hooks/useLiveKit";
import { VideoTile } from "@/components/VideoTile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import {
  Mic, MicOff, Video, VideoOff, BarChart3, Brain, TrendingUp, MessageSquare,
  Lightbulb, ArrowLeft, Activity, Target, Zap, Network, GitMerge, PhoneOff, Copy, Check,
  Download, ChevronDown, Eye, EyeOff
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

interface ScorePoint {
  timestamp: number;
  meetingSecond: number;
  score: number;
  keywordHits: number;
  agendaHits: number;
  irrelevantHits: number;
  reason: string;
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

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'you', 'are', 'was', 'were', 'our', 'your', 'they', 'them', 'about', 'into', 'what', 'when', 'where', 'how', 'why', 'can', 'could', 'should', 'would', 'just', 'like', 'need', 'going', 'meeting', 'team']);

const extractTerms = (value: string) => value
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .map(term => term.trim())
  .filter(term => term.length >= 3 && !STOP_WORDS.has(term));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MeetingAnalysis = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const org = searchParams.get("org") || "";
  const title = searchParams.get("title") || "Team Meeting";
  const roomName = searchParams.get("room") || "";
  const initialName = searchParams.get("name") || "";
  const keywordsParam = searchParams.get("keywords") || "";
  const monitoredKeywords = useMemo(() => extractTerms(keywordsParam), [keywordsParam]);
  const agendaTerms = useMemo(() => Array.from(new Set([...extractTerms(title), ...extractTerms(org)])), [title, org]);

  const theme = useMemo(() => THEMES[Math.floor(Math.random() * THEMES.length)], []);

  // Display name — editable on pre-join screen for invitees
  const [nameInput, setNameInput] = useState(initialName);
  const displayName = nameInput.trim() || initialName || "Guest";

  // Stable identity per tab
  const identity = useMemo(() => `user-${Math.random().toString(36).slice(2, 10)}`, []);

  const handleParticipantJoined = useCallback((name: string) => {
    toast.success(`${name} joined the meeting`);
  }, []);
  const handleParticipantLeft = useCallback((name: string) => {
    toast.info(`${name} left the meeting`);
  }, []);

  const {
    isConnected, participants, entries, interim, transcript, error: lkError,
    connect, disconnect, toggleMic, toggleCam, room,
  } = useLiveKit({
    roomName, identity, displayName,
    onParticipantJoined: handleParticipantJoined,
    onParticipantLeft: handleParticipantLeft,
  });

  const [analysis, setAnalysis] = useState<AnalysisData>(defaultAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muteWarnings, setMuteWarnings] = useState<{ name: string; seconds: number; ts: number }[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [manualInsights, setManualInsights] = useState<AnalysisData['aiInsights']>([]);

  const lastAnalyzedRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const lastWarningRef = useRef<Map<string, number>>(new Map());
  const inactiveWarningRef = useRef<Map<string, number>>(new Map());
  const irrelevantWarningRef = useRef(0);
  const silenceWarningRef = useRef(0);

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

  // Live, client-side derived stats from real entries+participants — works without AI.
  const liveStats = useMemo(() => {
    const wordsByIdentity = new Map<string, { name: string; words: number; ideas: number }>();
    participants.forEach(p => wordsByIdentity.set(p.identity, { name: p.name, words: 0, ideas: 0 }));
    const now = Date.now();
    const lastSpeechAt = entries[entries.length - 1]?.timestamp || null;
    const silentSeconds = isConnected ? Math.floor(((lastSpeechAt ? now - lastSpeechAt : meetingTime * 1000) / 1000)) : 0;
    let keywordHits = 0;
    let agendaHits = 0;
    let irrelevantHits = 0;
    let relevantWordCount = 0;
    let irrelevantStart: number | null = null;

    entries.forEach(e => {
      const key = e.identity;
      const existing = wordsByIdentity.get(key) || { name: e.speaker, words: 0, ideas: 0 };
      const lowerText = e.text.toLowerCase();
      const words = e.text.split(/\s+/).filter(Boolean).length;
      const matchedKeywords = monitoredKeywords.filter(term => lowerText.includes(term)).length;
      const matchedAgenda = agendaTerms.filter(term => lowerText.includes(term)).length;
      keywordHits += matchedKeywords;
      agendaHits += matchedAgenda;
      if (matchedKeywords || matchedAgenda) {
        relevantWordCount += words;
        irrelevantStart = null;
      } else if (words >= 4) {
        irrelevantHits += 1;
        irrelevantStart = irrelevantStart ?? e.timestamp;
      }

      existing.words += words;
      // crude "idea" = utterance >= 6 words
      if (words >= 6) existing.ideas += 1;
      existing.name = e.speaker || existing.name;
      wordsByIdentity.set(key, existing);
    });
    const totalWords = Array.from(wordsByIdentity.values()).reduce((s, v) => s + v.words, 0) || 1;
    const insights = Array.from(wordsByIdentity.values()).map(v => ({
      name: v.name,
      talkTimePercent: Math.round((v.words / totalWords) * 100),
      ideas: v.ideas,
      sentiment: 'neutral' as const,
    }));

    // Participation balance: 100 = perfectly even, 0 = one person dominates
    const n = insights.length || 1;
    const ideal = 100 / n;
    const variance = insights.reduce((s, p) => s + Math.pow(p.talkTimePercent - ideal, 2), 0) / n;
    const balancePct = Math.max(0, Math.round(100 - Math.sqrt(variance) * 1.5));
    const dominant = insights.filter(p => p.talkTimePercent > ideal * 1.7).length;
    const silent = insights.filter(p => p.talkTimePercent < ideal * 0.3).length;

    // Pairwise interactions: consecutive speaker A -> B
    const interactionMap = new Map<string, number>();
    for (let i = 1; i < entries.length; i++) {
      const from = entries[i - 1].speaker;
      const to = entries[i].speaker;
      if (!from || !to || from === to) continue;
      const key = `${from}|${to}`;
      interactionMap.set(key, (interactionMap.get(key) || 0) + 1);
    }
    const interactions = Array.from(interactionMap.entries()).map(([k, weight]) => {
      const [from, to] = k.split('|');
      return { from, to, weight: Math.min(10, weight) };
    });

    // Convergence timeline: bucket entries per minute
    const buckets = new Map<number, number>();
    entries.forEach(e => {
      const minute = Math.floor((e.timestamp - (entries[0]?.timestamp || e.timestamp)) / 60000);
      buckets.set(minute, (buckets.get(minute) || 0) + 1);
    });
    const maxBucket = Math.max(1, ...Array.from(buckets.values()));
    const timeline = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([m, c]) => ({
      minute: m,
      ideas: Math.round((c / maxBucket) * 100),
      consensus: Math.min(100, balancePct + m * 2),
      conflicts: Math.max(0, 30 - m * 3),
    }));

    const keywordBoost = Math.min(2.2, keywordHits * 0.45);
    const agendaBoost = Math.min(1.8, agendaHits * 0.3 + (relevantWordCount / Math.max(totalWords, 1)) * 1.5);
    const irrelevantPenalty = Math.min(3, irrelevantHits * 0.35);
    const silencePenalty = silentSeconds >= 30 ? 5 : silentSeconds >= 20 ? 2 : 0;
    const activityPenalty = participants.filter(p => p.audioMuted && p.videoMuted).length * 0.35;
    const ideaDiversity = Math.min(100, insights.filter(p => p.ideas > 0).length * 22 + Math.min(28, totalWords / 18) + keywordHits * 4 + agendaHits * 2);
    const intelligenceScore = clamp((balancePct / 16) + (insights.length * 0.55) + Math.min(2.1, totalWords / 90) + keywordBoost + agendaBoost - irrelevantPenalty - silencePenalty - activityPenalty, 1, 10);
    const noveltyScore = Math.min(100, Math.round(insights.reduce((s, p) => s + p.ideas, 0) * 8));
    const convergenceScore = clamp(Math.round(balancePct + agendaHits * 4 + keywordHits * 2 - irrelevantHits * 6 - (silentSeconds >= 30 ? 35 : 0)), 0, 100);
    const perspectiveRange = Math.min(100, insights.length * 18 + Math.min(25, totalWords / 25) + insights.filter(p => p.ideas > 0).length * 8);
    const qualityScore = clamp(Math.round((balancePct + ideaDiversity + convergenceScore) / 3), 0, 100);
    const scoreReason = silentSeconds >= 30
      ? 'Meeting silence over 30s caused a major score drop'
      : keywordHits > 0 || agendaHits > 0
        ? 'Score increased from monitored keywords and agenda-relevant discussion'
        : irrelevantHits > 0
          ? 'Score reduced because recent speech drifted away from the agenda'
          : 'Score based on live speaking balance and discussion volume';

    return {
      participantInsights: insights,
      participationBalance: balancePct,
      ideaDiversity: Math.round(ideaDiversity),
      intelligenceScore: Number(intelligenceScore.toFixed(1)),
      noveltyScore,
      convergenceScore,
      perspectiveRange,
      qualityScore,
      balanceScore: Math.round((balancePct / 100) * 100) / 100,
      dominantVoices: dominant,
      silentMembers: silent + participants.filter(p => p.audioMuted).length,
      interactions,
      convergenceTimeline: timeline,
      keywordHits,
      agendaHits,
      irrelevantHits,
      irrelevantSeconds: irrelevantStart ? Math.floor((now - irrelevantStart) / 1000) : 0,
      silentSeconds,
      scoreReason,
      avgResponseSeconds: entries.length > 1
        ? ((entries[entries.length - 1].timestamp - entries[0].timestamp) / 1000 / Math.max(1, entries.length - 1)).toFixed(1)
        : '0.0',
    };
  }, [entries, participants, monitoredKeywords, agendaTerms, isConnected, meetingTime]);

  const localInsights = useMemo<AnalysisData['aiInsights']>(() => {
    const inactiveNames = participants
      .filter(p => p.audioMuted && p.videoMuted && p.inactiveSince && Date.now() - p.inactiveSince >= 30000)
      .map(p => p.name);
    const insights: AnalysisData['aiInsights'] = [];

    if (entries.length === 0) {
      insights.push({ text: isConnected ? "Listening for meeting audio and waiting for speech." : "Waiting for participants and audio...", type: "info", priority: 1 });
    }
    if (liveStats.keywordHits > 0) {
      insights.push({ text: `Detected ${liveStats.keywordHits} monitored keyword mention${liveStats.keywordHits === 1 ? '' : 's'} from the customization setup.`, type: "positive", priority: 2 });
    }
    if (liveStats.agendaHits > 0) {
      insights.push({ text: `Discussion is aligning with the meeting agenda (${liveStats.agendaHits} agenda signal${liveStats.agendaHits === 1 ? '' : 's'} detected).`, type: "positive", priority: 2 });
    }
    if (liveStats.irrelevantSeconds >= 15) {
      insights.push({ text: "Conversation shifting, advice to stick to agenda.", type: "warning", priority: 3 });
    }
    if (liveStats.silentSeconds >= 30) {
      insights.push({ text: "The meeting has been silent for over 30 seconds, so the intelligence score dropped sharply.", type: "warning", priority: 3 });
    }
    inactiveNames.forEach(name => {
      insights.push({ text: `${name} has been inactive, they might have something to contribute!`, type: "warning", priority: 3 });
    });
    muteWarnings.forEach(w => {
      insights.push({ text: `${w.name} has been muted for ${Math.floor(w.seconds / 60)}m ${w.seconds % 60}s — they may have something to share.`, type: "warning", priority: 2 });
    });

    if (insights.length === 0) {
      insights.push({ text: liveStats.scoreReason, type: "info", priority: 1 });
    }
    return insights.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [participants, entries.length, isConnected, liveStats, muteWarnings]);

  // AI analysis — supplements live stats with qualitative insights
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
        const warnings = muteWarnings.map(w => ({
          text: `${w.name} has been muted for ${Math.floor(w.seconds / 60)}m ${w.seconds % 60}s — they may have something to share.`,
          type: 'warning',
          priority: 2,
        }));
        const merged = [...warnings, ...(data.analysis.aiInsights || [])].slice(0, 6);
        setAnalysis(prev => ({ ...prev, ...data.analysis, aiInsights: merged }));
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transcript, participants, org, title, meetingTime, isAnalyzing, muteWarnings]);

  // Merge live stats into analysis on every change so visuals always update
  useEffect(() => {
    setAnalysis(prev => ({
      ...prev,
      participantInsights: liveStats.participantInsights.length > 0 ? liveStats.participantInsights : prev.participantInsights,
      participationBalance: liveStats.participationBalance,
      ideaDiversity: liveStats.ideaDiversity,
      intelligenceScore: liveStats.intelligenceScore,
      noveltyScore: liveStats.noveltyScore,
      convergenceScore: liveStats.convergenceScore,
      perspectiveRange: liveStats.perspectiveRange,
      qualityScore: liveStats.qualityScore,
      balanceScore: liveStats.balanceScore,
      dominantVoices: liveStats.dominantVoices,
      silentMembers: liveStats.silentMembers,
      interactions: liveStats.interactions.length > 0 ? liveStats.interactions : prev.interactions,
      convergenceTimeline: liveStats.convergenceTimeline.length > 0 ? liveStats.convergenceTimeline : prev.convergenceTimeline,
      aiInsights: [...manualInsights, ...localInsights, ...(prev.aiInsights || []).filter(insight => ![...manualInsights, ...localInsights].some(local => local.text === insight.text))]
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 6),
    }));
  }, [liveStats, localInsights, manualInsights]);

  useEffect(() => {
    if (!isConnected) return;
    const now = Date.now();
    if (liveStats.irrelevantSeconds >= 15 && now - irrelevantWarningRef.current > 45000) {
      irrelevantWarningRef.current = now;
      const text = "Conversation shifting, advice to stick to agenda.";
      toast.warning(text);
      setManualInsights(prev => [{ text, type: 'warning', priority: 3 }, ...prev.filter(i => i.text !== text)].slice(0, 6));
    }
    if (liveStats.silentSeconds >= 30 && now - silenceWarningRef.current > 45000) {
      silenceWarningRef.current = now;
      const text = "The meeting has been silent for over 30 seconds, so the intelligence score dropped sharply.";
      toast.warning(text);
      setManualInsights(prev => [{ text, type: 'warning', priority: 3 }, ...prev.filter(i => i.text !== text)].slice(0, 6));
    }
    participants.forEach(p => {
      if (!p.audioMuted || !p.videoMuted || !p.inactiveSince) return;
      if (now - p.inactiveSince < 30000) return;
      const lastWarn = inactiveWarningRef.current.get(p.identity) || 0;
      if (now - lastWarn < 90000) return;
      inactiveWarningRef.current.set(p.identity, now);
      const text = `${p.name} has been inactive, they might have something to contribute!`;
      toast.warning(text);
      setManualInsights(prev => [{ text, type: 'warning', priority: 3 }, ...prev.filter(i => i.text !== text)].slice(0, 6));
    });
  }, [isConnected, liveStats.irrelevantSeconds, liveStats.silentSeconds, participants]);

  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => {
      setScoreHistory(prev => {
        const last = prev[prev.length - 1];
        const point: ScorePoint = {
          timestamp: Date.now(),
          meetingSecond: meetingTime,
          score: liveStats.intelligenceScore,
          keywordHits: liveStats.keywordHits,
          agendaHits: liveStats.agendaHits,
          irrelevantHits: liveStats.irrelevantHits,
          reason: liveStats.scoreReason,
        };
        if (last && last.meetingSecond === point.meetingSecond) return prev;
        return [...prev.slice(-119), point];
      });
    }, 5000);
    return () => clearInterval(id);
  }, [isConnected, meetingTime, liveStats]);

  useEffect(() => {
    if (!isConnected) return;
    const firstTimer = setTimeout(() => { runAnalysis(); }, 8000);
    analysisIntervalRef.current = setInterval(() => { runAnalysis(); }, 15000);
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
    if (!nameInput.trim()) {
      toast.error("Please enter your name to join");
      return;
    }
    setHasJoined(true);
    await connect();
  };

  const handleLeave = async () => {
    await disconnect();
    navigate('/');
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/meeting-analysis?room=${encodeURIComponent(roomName)}&org=${encodeURIComponent(org)}&title=${encodeURIComponent(title)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied — share it with your team");
    setTimeout(() => setCopied(false), 2000);
  };

  const localParticipant = participants.find(p => p.isLocal);

  // Pre-join screen — invitees enter their name here
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
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: theme.muted }}>Your name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                placeholder="Enter your name"
                autoFocus
                className="w-full px-4 py-3 rounded-xl outline-none focus:ring-2"
                style={{
                  background: 'hsl(0 0% 100% / 0.08)',
                  border: `1px solid ${theme.border}`,
                  color: theme.text,
                }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: theme.muted }}>Room</span>
              <span className="font-mono text-xs">{roomName}</span>
            </div>
          </div>
          <button onClick={handleJoin}
                  disabled={!nameInput.trim()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium disabled:opacity-50"
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
                    <div className="text-lg font-bold">{liveStats.avgResponseSeconds}s</div>
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
