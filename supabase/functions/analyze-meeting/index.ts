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

    const { transcript, participants, organization, meetingTitle, meetingTimeSeconds } = await req.json();

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

You MUST respond with a JSON object using this exact structure (no markdown, no code blocks, just raw JSON):
{
  "intelligenceScore": <number 1-10, based on quality of discussion, diversity of ideas, constructiveness>,
  "participationBalance": <number 0-100, how evenly distributed the conversation is>,
  "ideaDiversity": <number 0-100, variety of unique perspectives and ideas>,
  "currentTopics": [<string array of 3-5 current discussion topics>],
  "aiInsights": [
    {"text": "<insight text>", "type": "warning|info|positive", "priority": <1-3>}
  ],
  "keyDecisions": [<string array of any decisions made>],
  "actionItems": [<string array of any action items identified>],
  "sentimentOverall": "<positive|neutral|negative|mixed>",
  "engagementLevel": "<high|medium|low>",
  "suggestedQuestions": [<string array of 2-3 questions to deepen discussion>],
  "participantInsights": [
    {"name": "<participant name or Speaker>", "talkTimePercent": <number>, "ideas": <number>, "sentiment": "<positive|neutral|negative>"}
  ],
  "convergenceScore": <number 0-100, how much the group is converging on consensus>,
  "noveltyScore": <number 0-100, how novel/creative the ideas are>
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
        aiInsights: [{ text: "Analysis in progress - gathering more data", type: "info", priority: 2 }],
        keyDecisions: [],
        actionItems: [],
        sentimentOverall: "neutral",
        engagementLevel: "medium",
        suggestedQuestions: [],
        participantInsights: [],
        convergenceScore: 50,
        noveltyScore: 50
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
