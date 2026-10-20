import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import campusJson from '@/lib/data/campus.json';
import { CampusData } from '@/lib/types/map';
import {
  buildSystemPrompt,
  generateLocalFallbackResponse,
  AIChatResponse,
} from '@/lib/utils/aiAssistant';

const campusData = campusJson as unknown as CampusData;

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestPayload {
  message: string;
  history?: ChatMessageInput[];
}

export async function POST(req: NextRequest) {
  let message = '';
  try {
    const body = (await req.json()) as RequestPayload;
    message = (body?.message || '').trim();

    if (!message) {
      return NextResponse.json(
        { error: 'Message cannot be empty.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    // If no GROQ_API_KEY configured, use intelligent campus search fallback
    if (!apiKey) {
      const fallback = generateLocalFallbackResponse(message);
      return NextResponse.json<AIChatResponse>(fallback);
    }

    const groq = new Groq({ apiKey });

    // Build grounding system prompt with compact campus building directory
    const systemPrompt = buildSystemPrompt(message);

    // Format chat conversation history for Groq
    const history = (body.history || []).slice(-6).map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: typeof msg.content === 'string' ? msg.content : '',
    }));

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: message },
    ];

    // Determine Groq Model from environment or fallback to llama-3.3-70b-versatile
    const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';

    // Request structured JSON completion from Groq
    const completion = await groq.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(rawContent) as {
        reply?: string;
        suggestedPlaces?: Array<{
          buildingId: string;
          buildingName: string;
          buildingCode: string;
          roomName?: string;
          reason?: string;
        }>;
      };

      if (parsed.reply) {
        // Only return suggested places if they actually match real buildings in campus.json
        const rawPlaces = Array.isArray(parsed.suggestedPlaces) ? parsed.suggestedPlaces : [];
        const validatedPlaces = rawPlaces.filter((p) => {
          if (!p || typeof p.buildingId !== 'string') return false;
          return campusData.buildings.some(
            (b) =>
              b.id.toLowerCase() === p.buildingId.toLowerCase() ||
              b.code.toLowerCase() === p.buildingCode?.toLowerCase()
          );
        });

        return NextResponse.json<AIChatResponse>({
          reply: parsed.reply,
          suggestedPlaces: validatedPlaces,
          isFallback: false,
        });
      }
    } catch {
      // In case JSON parsing fails, return text content cleanly
      return NextResponse.json<AIChatResponse>({
        reply: rawContent,
        suggestedPlaces: [],
        isFallback: false,
      });
    }

    // Fallback if empty reply was produced
    const fallback = generateLocalFallbackResponse(message);
    return NextResponse.json<AIChatResponse>(fallback);
  } catch (error: any) {
    console.error('Groq API chat route error:', error);

    // Graceful fallback on API or network error so user experience remains uninterrupted
    const fallback = generateLocalFallbackResponse(message || 'ASTU campus');
    return NextResponse.json<AIChatResponse>(fallback);
  }
}
