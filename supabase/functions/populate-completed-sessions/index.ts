const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// DEPRECATED: This function no longer generates fake data.
// Kept as a no-op to avoid breaking any existing callers.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Deprecated — no fake data is generated. Groups now start cleanly from their starting session number.',
      results: { attendance: 0, quizzes: 0, quizSubmissions: 0, assignments: 0, assignmentSubmissions: 0, evaluations: 0 },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
