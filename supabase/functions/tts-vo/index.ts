// One-off edge function to synthesize VO via ElevenLabs.
// POST { text: string } -> raw mp3 bytes.
const VOICE_ID = "nPczCjzI2devNBz1zQrb"; // Brian

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) return new Response("ELEVENLABS_API_KEY missing", { status: 500, headers: corsHeaders });

  const { text } = await req.json();
  if (!text) return new Response("text required", { status: 400, headers: corsHeaders });

  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
          speed: 1.05,
        },
      }),
    }
  );

  if (!r.ok) {
    const err = await r.text();
    return new Response(`ElevenLabs ${r.status}: ${err}`, { status: 500, headers: corsHeaders });
  }

  return new Response(r.body, {
    headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
  });
});
