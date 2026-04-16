import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { toast } from "@/hooks/use-toast";
import { Mic, MicOff, ExternalLink, BarChart3, Brain, Users, TrendingUp, MessageSquare, Lightbulb, ArrowLeft, Activity, Target, Zap } from "lucide-react";

interface AnalysisData {
  intelligenceScore: number;
  participationBalance: number;
  ideaDiversity: number;
  currentTopics: string[];
  aiInsights: { text: string; type: string; priority: number }[];
  keyDecisions: string[];
  actionItems: string[];
  sentimentOverall: string;
  engagementLevel: string;
  suggestedQuestions: string[];
  participantInsights: { name: string; talkTimePercent: number; ideas: number; sentiment: string }[];
  convergenceScore: number;
  noveltyScore: number;
}

const defaultAnalysis: AnalysisData = {
  intelligenceScore: 0,
  participationBalance: 0,
  ideaDiversity: 0,
  currentTopics: [],
  aiInsights: [{ text: "Waiting for meeting audio... Start speaking to begin analysis.", type: "info", priority: 1 }],
  keyDecisions: [],
  actionItems: [],
  sentimentOverall: "neutral",
  engagementLevel: "low",
  suggestedQuestions: [],
  participantInsights: [],
  convergenceScore: 0,
  noveltyScore: 0,
};

const MeetingAnalysis = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const meetLink = searchParams.get("meetLink") || "";
  const org = searchParams.get("org") || "";
  const title = searchParams.get("title") || "Team Meeting";
  const participantsParam = searchParams.get("participants") || "";
  const participants = participantsParam ? participantsParam.split(",").map(p => p.trim()) : [];

  const { isListening, transcript, interimTranscript, error: speechError, isSupported, start, stop } = useSpeechRecognition();
  const [analysis, setAnalysis] = useState<AnalysisData>(defaultAnalysis);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [scoreHistory, setScoreHistory] = useState<{ time: number; score: number; consensus: number }[]>([]);
  const lastAnalyzedRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout>();
  const analysisIntervalRef = useRef<NodeJS.Timeout>();

  // Meeting timer
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => setMeetingTime(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isListening]);

  // Periodic AI analysis
  const runAnalysis = useCallback(async () => {
    if (!transcript || transcript === lastAnalyzedRef.current || isAnalyzing) return;
    lastAnalyzedRef.current = transcript;
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-meeting', {
        body: { transcript, participants, organization: org, meetingTitle: title, meetingTimeSeconds: meetingTime }
      });
      
      if (error) {
        console.error('Analysis error:', error);
        return;
      }
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setScoreHistory(prev => [...prev, { 
          time: meetingTime, 
          score: data.analysis.intelligenceScore, 
          consensus: data.analysis.convergenceScore 
        }]);
      }
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [transcript, participants, org, title, meetingTime, isAnalyzing]);

  useEffect(() => {
    if (isListening) {
      analysisIntervalRef.current = setInterval(runAnalysis, 20000); // Every 20s
    }
    return () => { if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current); };
  }, [isListening, runAnalysis]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const insightColor = (type: string) => {
    if (type === 'warning') return 'text-amber-400';
    if (type === 'positive') return 'text-emerald-400';
    return 'text-blue-400';
  };

  const insightDot = (type: string) => {
    if (type === 'warning') return 'bg-amber-400';
    if (type === 'positive') return 'bg-emerald-400';
    return 'bg-blue-400';
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white">
      {/* Top Bar */}
      <header className="bg-[#1e2538] border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg">TeamIQ</span>
          </div>
          <div className="hidden sm:block h-6 w-px bg-white/20" />
          <h1 className="hidden sm:block text-sm text-gray-300 truncate max-w-[200px]">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {isListening && (
            <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Live • {formatTime(meetingTime)}
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
              <Activity className="w-3 h-3 animate-spin" />
              Analyzing
            </div>
          )}
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="text-sm text-gray-400 hover:text-white px-3 py-1 rounded border border-white/10 hover:border-white/30 transition"
          >
            {showAnalytics ? 'Hide' : 'Show'} Analytics
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
        {/* Left: Meeting + Transcript */}
        <div className={`flex-1 flex flex-col ${showAnalytics ? 'lg:w-2/3' : 'lg:w-full'} overflow-hidden`}>
          {/* Meeting Controls */}
          <div className="p-4 space-y-4">
            {/* Google Meet Link */}
            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1e2538] border border-white/10 rounded-xl p-3 hover:border-emerald-500/50 transition group"
              >
                <ExternalLink className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-gray-300 group-hover:text-white truncate">{meetLink}</span>
                <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Open Meet</span>
              </a>
            )}

            {/* Microphone Control */}
            <div className="flex items-center gap-3">
              <button
                onClick={isListening ? stop : start}
                disabled={!isSupported}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
                  isListening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </button>
              {!isListening && !transcript && (
                <p className="text-sm text-gray-500">
                  Click to start capturing meeting audio through your microphone
                </p>
              )}
              {speechError && <p className="text-sm text-red-400">{speechError}</p>}
            </div>
          </div>

          {/* Live Transcript */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="bg-[#1e2538] rounded-xl border border-white/10 p-4 h-full">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-gray-300">Live Transcript</h3>
                {isListening && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              </div>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {transcript || (
                  <span className="text-gray-500 italic">
                    {isListening ? 'Listening for speech...' : 'Transcript will appear here once you start listening.'}
                  </span>
                )}
                {interimTranscript && (
                  <span className="text-gray-500 italic">{interimTranscript}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Analytics Panel */}
        {showAnalytics && (
          <div className="lg:w-[400px] border-l border-white/10 overflow-y-auto bg-[#161b2e]">
            <div className="p-4 space-y-4">
              {/* Intelligence Score */}
              <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Intelligence Score</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold">{analysis.intelligenceScore.toFixed(1)}<span className="text-lg text-gray-500">/10</span></div>
                <p className="text-xs text-gray-500 mt-1">Based on discussion quality & diversity</p>
              </div>

              {/* Balance & Diversity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-gray-400">Participation Balance</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">{analysis.participationBalance}%</div>
                </div>
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-gray-400">Idea Diversity</span>
                  <div className="text-2xl font-bold text-blue-400 mt-1">{analysis.ideaDiversity}%</div>
                </div>
              </div>

              {/* Engagement & Sentiment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1e2538] rounded-xl p-3 border border-white/10">
                  <span className="text-xs text-gray-400">Engagement</span>
                  <div className={`text-sm font-bold mt-1 capitalize ${
                    analysis.engagementLevel === 'high' ? 'text-emerald-400' : 
                    analysis.engagementLevel === 'medium' ? 'text-amber-400' : 'text-red-400'
                  }`}>{analysis.engagementLevel}</div>
                </div>
                <div className="bg-[#1e2538] rounded-xl p-3 border border-white/10">
                  <span className="text-xs text-gray-400">Sentiment</span>
                  <div className={`text-sm font-bold mt-1 capitalize ${
                    analysis.sentimentOverall === 'positive' ? 'text-emerald-400' : 
                    analysis.sentimentOverall === 'negative' ? 'text-red-400' : 'text-gray-300'
                  }`}>{analysis.sentimentOverall}</div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-medium">AI Insights</h3>
                </div>
                <div className="space-y-2">
                  {analysis.aiInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${insightDot(insight.type)}`} />
                      <p className={`text-xs ${insightColor(insight.type)}`}>{insight.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Topics */}
              {analysis.currentTopics.length > 0 && (
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-medium">Current Topics</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.currentTopics.map((topic, i) => (
                      <span key={i} className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1 text-gray-300">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Participation Heatmap */}
              {analysis.participantInsights.length > 0 && (
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-medium">Participation Heatmap</h3>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Live</span>
                  </div>
                  <div className="space-y-3">
                    {analysis.participantInsights.map((p, i) => {
                      const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-cyan-500', 'bg-pink-500'];
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-300">{p.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">{p.ideas} ideas</span>
                              <span className="font-medium">{p.talkTimePercent}%</span>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-1000`} style={{ width: `${p.talkTimePercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Diversity Meter */}
              <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <h3 className="text-sm font-medium">Diversity Meter</h3>
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Live</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Idea Diversity', value: analysis.ideaDiversity },
                    { label: 'Novelty Score', value: analysis.noveltyScore },
                    { label: 'Convergence', value: analysis.convergenceScore },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">{item.label}</span>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-1000" style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Questions */}
              {analysis.suggestedQuestions.length > 0 && (
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-medium">Suggested Questions</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.suggestedQuestions.map((q, i) => (
                      <p key={i} className="text-xs text-gray-400 bg-white/5 rounded-lg p-2 border border-white/5">
                        💡 {q}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Decisions */}
              {analysis.keyDecisions.length > 0 && (
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> Key Decisions
                  </h3>
                  {analysis.keyDecisions.map((d, i) => (
                    <p key={i} className="text-xs text-gray-300 mb-1">• {d}</p>
                  ))}
                </div>
              )}

              {/* Action Items */}
              {analysis.actionItems.length > 0 && (
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="text-blue-400">→</span> Action Items
                  </h3>
                  {analysis.actionItems.map((a, i) => (
                    <p key={i} className="text-xs text-gray-300 mb-1">• {a}</p>
                  ))}
                </div>
              )}

              {/* Score History */}
              {scoreHistory.length > 1 && (
                <div className="bg-[#1e2538] rounded-xl p-4 border border-white/10">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Score Over Time
                  </h3>
                  <div className="flex items-end gap-1 h-16">
                    {scoreHistory.map((s, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-500 to-cyan-500 rounded-t transition-all duration-500"
                          style={{ height: `${(s.score / 10) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Start</span>
                    <span>Now</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingAnalysis;
