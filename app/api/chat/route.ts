import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import campusJson from '@/lib/data/campus.json';
import { CampusData, LatLng, PathNode } from '@/lib/types/map';
import {
  buildSystemPrompt,
  generateLocalFallbackResponse,
  AIChatResponse,
} from '@/lib/utils/aiAssistant';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';
import { calculateHaversineDistance, formatDistance } from '@/lib/utils/graph';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestPayload {
  message: string;
  history?: ChatMessageInput[];
  userLocation?: LatLng;
}

export interface EnhancedAIChatResponse extends AIChatResponse {
  action?: {
    type: 'NAVIGATE';
    destination: {
      buildingId: string;
      buildingName: string;
      buildingCode: string;
      roomName?: string;
      entrance: LatLng;
      distanceMeters?: number;
      distanceFormatted?: string;
    };
  } | null;
}

function resolveActionFromPlaces(
  places: Array<{ buildingId: string; buildingCode?: string; roomName?: string }>,
  userLocation?: LatLng
): EnhancedAIChatResponse['action'] {
  if (!places || places.length === 0) return null;
  const primaryPlace = places[0];
  const matchedBuilding = campusData.buildings.find(
    (b) =>
      b.id.toLowerCase() === primaryPlace.buildingId.toLowerCase() ||
      (primaryPlace.buildingCode && b.code.toLowerCase() === primaryPlace.buildingCode.toLowerCase())
  );

  if (!matchedBuilding) return null;

  const entranceNode: PathNode | undefined = campusData.nodes.find(
    (n) => n.id === matchedBuilding.entranceNodeId
  );
  const entranceCoord = entranceNode
    ? { lat: entranceNode.lat, lng: entranceNode.lng }
    : matchedBuilding.center;

  let distanceMeters: number | undefined;
  let distanceFormatted: string | undefined;

  if (userLocation?.lat && userLocation?.lng) {
    distanceMeters = Math.round(
      calculateHaversineDistance(userLocation, entranceCoord)
    );
    distanceFormatted = formatDistance(distanceMeters);
  }

  return {
    type: 'NAVIGATE',
    destination: {
      buildingId: matchedBuilding.id,
      buildingName: matchedBuilding.name,
      buildingCode: matchedBuilding.code,
      roomName: primaryPlace.roomName,
      entrance: entranceCoord,
      distanceMeters,
      distanceFormatted,
    },
  };
}

export async function POST(req: NextRequest) {
  let message = '';
  try {
    const body = (await req.json()) as RequestPayload;
    message = (body?.message || '').trim();

    if (!message) {
      return jsonResponse(
        { error: 'Message cannot be empty.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    // If no GROQ_API_KEY configured, use intelligent campus search fallback
    if (!apiKey) {
      const fallback = generateLocalFallbackResponse(message);
      const action = resolveActionFromPlaces(fallback.suggestedPlaces, body.userLocation);
      return jsonResponse<EnhancedAIChatResponse>({
        ...fallback,
        action,
      });
    }

    const groq = new Groq({ apiKey });

    // Build grounding system prompt with compact campus building directory
    let systemPrompt = buildSystemPrompt(message);

    // If mobile client provided user's current GPS location, inject it into prompt
    if (body.userLocation?.lat && body.userLocation?.lng) {
      systemPrompt += `\nUSER CURRENT GPS LOCATION: lat ${body.userLocation.lat}, lng ${body.userLocation.lng}. When relevant, you may mention approximate walking distance.\n`;
    }

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

        // Determine if there is a primary destination to trigger direct mobile navigation action
        const action = resolveActionFromPlaces(validatedPlaces, body.userLocation);

        return jsonResponse<EnhancedAIChatResponse>({
          reply: parsed.reply,
          suggestedPlaces: validatedPlaces,
          action,
          isFallback: false,
        });
      }
    } catch {
      // In case JSON parsing fails, return text content cleanly
      return jsonResponse<EnhancedAIChatResponse>({
        reply: rawContent,
        suggestedPlaces: [],
        action: null,
        isFallback: false,
      });
    }

    // Fallback if empty reply was produced
    const fallback = generateLocalFallbackResponse(message);
    const action = resolveActionFromPlaces(fallback.suggestedPlaces, body.userLocation);
    return jsonResponse<EnhancedAIChatResponse>({
      ...fallback,
      action,
    });
  } catch (error: unknown) {
    console.error('Groq API chat route error:', error);

    // Graceful fallback on API or network error so user experience remains uninterrupted
    const fallback = generateLocalFallbackResponse(message || 'ASTU campus');
    const action = resolveActionFromPlaces(fallback.suggestedPlaces);
    return jsonResponse<EnhancedAIChatResponse>({
      ...fallback,
      action,
    });
  }
}
