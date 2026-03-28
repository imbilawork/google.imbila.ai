// POST /api/assess — AI-generated quiz for Google AI Academy modules
// Returns structured JSON quiz questions

interface Env {
  AI: any;
}

interface AssessRequest {
  module: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: AssessRequest;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { module } = body;

  if (!module || typeof module !== 'string') {
    return Response.json({ error: 'module is required and must be a string' }, { status: 400 });
  }

  const systemPrompt = `Generate a quiz for the Google AI module: ${module}. Return ONLY valid JSON: {"questions": [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": 0, "explanation": "..."}]}. 4 questions testing practical understanding of Google AI tools and concepts.`;

  try {
    const result = await context.env.AI.run('@cf/google/gemma-3-12b-it', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a 4-question quiz for the module: ${module}` },
      ],
    });

    const responseText = result.response || '';

    // Try to parse JSON from the response
    let quiz;
    try {
      // Try direct parse first
      quiz = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code blocks or surrounding text
      const jsonMatch = responseText.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        quiz = JSON.parse(jsonMatch[0]);
      } else {
        return Response.json({
          error: 'Failed to generate valid quiz format',
          raw: responseText,
        }, { status: 502 });
      }
    }

    return Response.json(quiz);
  } catch (err: any) {
    return Response.json({
      error: 'Assessment generation failed',
      detail: err.message || 'Unknown error',
    }, { status: 502 });
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
