// POST /api/tutor — AI tutor for Google AI Academy
// Streaming SSE response using Cloudflare Workers AI

interface Env {
  AI: any;
}

interface TutorRequest {
  message: string;
  module: string;
  history?: Array<{ role: string; content: string }>;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: TutorRequest;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, module, history = [] } = body;

  if (!message || typeof message !== 'string') {
    return Response.json({ error: 'message is required and must be a string' }, { status: 400 });
  }

  if (!module || typeof module !== 'string') {
    return Response.json({ error: 'module is required and must be a string' }, { status: 400 });
  }

  // Limit history to last 10 messages to stay within context window
  const trimmedHistory = history.slice(-10);

  const systemPrompt = `You are an AI tutor for the Imbila.AI Google Academy. You teach how to build with Google AI — Gemini, Google AI Studio, and Google Cloud AI. You are currently teaching: ${module}. Be practical, give code examples where relevant, use South African business scenarios. Keep answers to 2-3 paragraphs. Encourage hands-on experimentation with Google AI Studio.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: message },
  ];

  try {
    const stream = await context.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages,
      stream: true,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return Response.json({
      error: 'Tutor inference failed',
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
