import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { transcript, participants, organization, meetingTitle, monitoredKeywords = [], agendaTerms = [], meetingTimeSeconds } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(JSON.stringify({ error: "transcript is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are an AI meeting intelligence analyst for TeamIQ. Analyze the real-time meeting transcript and provide structured insights.

Organization: ${organization || 'Unknown'}
Meeting: ${meetingTitle || 'Team Meeting'}
Participants: ${participants?.join(', ') || 'Unknown'}
Meeting duration so far: ${Math.floor((meetingTimeSeconds || 0) / 60)} minutes
Monitored keywords from the setup form: ${Array.isArray(monitoredKeywords) && monitoredKeywords.length ? monitoredKeywords.join(', ') : 'None'}
Agenda relevance terms: ${Array.isArray(agendaTerms) && agendaTerms.length ? agendaTerms.join(', ') : 'None'}

The transcript is formatted as "SpeakerName: utterance" lines. Use that to attribute talk time and ideas per participant.
Score the meeting against the monitored keywords and agenda terms. Reward keyword and agenda-aligned discussion. Penalize sustained off-agenda discussion and silence. If the transcript contains off-topic drift, return a warning insight using this exact text when appropriate: "Conversation shifting, advice to stick to agenda.".

You MUST respond with a JSON object using this exact structure (no markdown, no code blocks, just raw JSON):
{
  "intelligenceScore": <number 1-10>,
  "participationBalance": <number 0-100>,
  "ideaDiversity": <number 0-100>,
  "currentTopics": [<3-5 strings>],
  "currentSpeaker": "<name of the most recent speaker>",
  "aiInsights": [{"text": "<insight>", "type": "warning|info|positive", "priority": <1-3>}],
  "keyDecisions": [<strings>],
  "actionItems": [<strings>],
  "sentimentOverall": "<positive|neutral|negative|mixed>",
  "engagementLevel": "<high|medium|low>",
  "suggestedQuestions": [<2-3 strings>],
  "participantInsights": [{"name": "<name>", "talkTimePercent": <number>, "ideas": <number>, "sentiment": "<positive|neutral|negative>"}],
  "convergenceScore": <number 0-100>,
  "noveltyScore": <number 0-100>,
  "perspectiveRange": <number 0-100>,
  "balanceScore": <number 0-1, decimal>,
  "dominantVoices": <integer count>,
  "silentMembers": <integer count>,
  "interactions": [{"from": "<name>", "to": "<name>", "weight": <number 1-10>}],
  "convergenceTimeline": [{"minute": <number>, "consensus": <0-100>, "ideas": <0-100>, "conflicts": <0-100>}],
  "qualityScore": <number 0-100>
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the latest meeting transcript to analyze:\n\n${transcript}` }
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    // Parse JSON from the response, handling potential markdown wrapping
    let analysis;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      analysis = {
        intelligenceScore: 7,
        participationBalance: 70,
        ideaDiversity: 65,
        currentTopics: ["Discussion in progress"],
        currentSpeaker: "",
        aiInsights: [{ text: "Analysis in progress - gathering more data", type: "info", priority: 2 }],
        keyDecisions: [],
        actionItems: [],
        sentimentOverall: "neutral",
        engagementLevel: "medium",
        suggestedQuestions: [],
        participantInsights: [],
        convergenceScore: 50,
        noveltyScore: 50,
        perspectiveRange: 50,
        balanceScore: 0.5,
        dominantVoices: 0,
        silentMembers: 0,
        interactions: [],
        convergenceTimeline: [],
        qualityScore: 50,
      };
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });
  } catch (error) {
    console.error('Error in analyze-meeting:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});
