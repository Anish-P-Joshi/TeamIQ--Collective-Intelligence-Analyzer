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
    const { organization, meetingTitle, participantSize, keywords } = await req.json();

    console.log('Analytics simulation request:', { organization, meetingTitle, participantSize, keywords });

    // Generate a unique simulation ID based on organization details
    const simulationId = btoa(`${organization}-${meetingTitle}-${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    
    // Return the demo URL with org-specific parameters
    const demoUrl = `https://collective-intelligence-analyzer.lovable.app/meeting-demo?sim=${simulationId}&org=${encodeURIComponent(organization)}&meeting=${encodeURIComponent(meetingTitle)}`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        demoUrl,
        simulationId,
        message: 'Custom analytics simulation prepared'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in analytics-simulate function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});