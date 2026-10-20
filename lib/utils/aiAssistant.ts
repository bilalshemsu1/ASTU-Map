import campusJson from '../data/campus.json';
import { CampusData, Building, Room } from '../types/map';
import { searchCampus } from './search';

export interface SuggestedPlace {
  buildingId: string;
  buildingName: string;
  buildingCode: string;
  roomName?: string;
  reason?: string;
}

export interface AIChatResponse {
  reply: string;
  suggestedPlaces: SuggestedPlace[];
  isFallback?: boolean;
}

const campusData = campusJson as unknown as CampusData;

/**
 * Strips out developer artifact coordinates like "located at exact coordinates 8.56..., 39.29..."
 * to keep user-facing text clean, natural, and conversational.
 */
export function cleanBuildingDescription(desc?: string): string {
  if (!desc) return '';
  return desc
    .replace(/\s*located at exact coordinates? [0-9.,\s]+/gi, '')
    .replace(/\s*at exact coordinates? [0-9.,\s]+/gi, '')
    .replace(/\s*\(exact coordinates? [0-9.,\s]+\)/gi, '')
    .replace(/\s*\([0-9.]+\s*,\s*[0-9.]+\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Builds a compact, token-efficient text summary of all campus buildings,
 * rooms, and departments for LLM grounding.
 */
export function buildCampusKnowledgeCatalog(): string {
  return campusData.buildings
    .map((b) => {
      const parts = [
        `ID: "${b.id}" | Code: ${b.code} | Name: "${b.name}" | Category: ${b.category}`,
      ];
      if (b.aliases && b.aliases.length > 0) {
        parts.push(`Aliases: [${b.aliases.join(', ')}]`);
      }
      const cleanDesc = cleanBuildingDescription(b.details?.description);
      if (cleanDesc) {
        parts.push(`Description: ${cleanDesc}`);
      }
      if (b.details?.department) {
        parts.push(`Department: ${b.details.department}`);
      }
      if (b.details?.hours) {
        parts.push(`Hours: ${b.details.hours}`);
      }
      if (b.rooms && b.rooms.length > 0) {
        const roomList = b.rooms.map((r) => {
          const rDetails: string[] = [`Floor ${r.floor}: "${r.name}"`];
          if (r.workDescription) rDetails.push(`Services: ${r.workDescription}`);
          if (r.equipment && r.equipment.length > 0) rDetails.push(`Equipment: ${r.equipment.join(', ')}`);
          return rDetails.join(' - ');
        });
        parts.push(`Rooms/Offices:\n    * ${roomList.join('\n    * ')}`);
      }
      return parts.join('\n  ');
    })
    .join('\n\n');
}

/**
 * Constructs the system prompt for the Groq / Llama LLM, dynamically highlighting
 * candidate buildings that match the user's current query.
 */
export function buildSystemPrompt(userQuery: string): string {
  const catalog = buildCampusKnowledgeCatalog();

  // Pre-filter candidate matches to give the LLM high-confidence focal points
  const candidateMatches = searchCampus(userQuery, campusData).slice(0, 5);
  let candidatesSummary = '';
  if (candidateMatches.length > 0) {
    candidatesSummary = `\nDATABASE MATCHES RELEVANT TO USER QUERY:\n` +
      candidateMatches
        .map((m) => `- "${m.building.name}" (ID: "${m.building.id}", Code: ${m.building.code})${m.matchingRoom ? ` [Room: ${m.matchingRoom.name}]` : ''}`)
        .join('\n') + '\n';
  }

  return `You are the official AI Campus Guide for Adama Science and Technology University (ASTU) in Adama, Ethiopia.
Your mission is to provide accurate, welcoming, concise, and helpful directions and campus information to students, faculty, staff, and visitors.

ASTU CAMPUS BUILDING & FACILITY DIRECTORY (GROUND TRUTH):
=========================================================
${catalog}
=========================================================
${candidatesSummary}

CRITICAL INSTRUCTIONS ON WHEN TO SUGGEST LOCATIONS:
1. ONLY include places in "suggestedPlaces" if the user is explicitly or implicitly asking for a location, building, office, department, room, facility, or walking directions.
2. For greetings ("hello", "hi", "good morning"), general conversational questions ("how are you?", "who are you?", "what is ASTU?"), acknowledgments ("thank you", "ok", "great"), or queries unrelated to a campus place, respond politely and conversationally, and set "suggestedPlaces": [].
3. DO NOT force or invent a campus location match when the conversation is just casual talk.
4. When the user DOES ask about a location, rely strictly on the ASTU Campus Directory. Never invent fake buildings or nonexistent rooms.
5. Never output raw numeric coordinates (like 8.56..., 39.29...) in your text responses.
6. Format lists cleanly using bullet points. Do not use emojis in your responses. Keep explanations conversational, polite, and to the point.
7. Format your response STRICTLY as a valid JSON object matching this schema:
{
  "reply": "Your helpful, conversational markdown explanation here.",
  "suggestedPlaces": [
    {
      "buildingId": "exact_id_from_directory",
      "buildingName": "Exact Building Name",
      "buildingCode": "CODE",
      "roomName": "Optional room name or null",
      "reason": "Brief reason why this place was suggested"
    }
  ]
}

Only return the JSON object, without backticks or markdown formatting around the JSON wrapper.`;
}

/**
 * Intelligent local fallback when GROQ_API_KEY is not configured or network fails.
 * Guarantees the user always gets a direct, accurate answer and map action buttons!
 */
export function generateLocalFallbackResponse(query: string): AIChatResponse {
  const cleanQuery = query.toLowerCase().trim();
  const cleanQ = cleanQuery.replace(/[?!.,;:()'"]/g, '').trim();

  // 1. Conversational Greetings
  const greetings = [
    'hi', 'hello', 'hey', 'greetings', 'selam', 'morning', 'good morning',
    'afternoon', 'good afternoon', 'evening', 'good evening', 'yo', 'sup', 'hola'
  ];
  if (
    greetings.includes(cleanQ) ||
    cleanQ.startsWith('hi ') ||
    cleanQ.startsWith('hello ') ||
    cleanQ.startsWith('hey ')
  ) {
    return {
      reply: `Hello, welcome to the ASTU AI Assistant.\n\nI can help you navigate the campus, find lecture halls, department offices, libraries, student dining, or provide walking directions across campus. What are you looking for today?`,
      suggestedPlaces: [],
      isFallback: true,
    };
  }

  // 2. Gratitude / Casual Acknowledgments
  const closings = [
    'thanks', 'thank you', 'thx', 'thank you so much', 'ok', 'okay',
    'great', 'awesome', 'cool', 'good', 'bye', 'goodbye', 'see you', 'nice'
  ];
  if (closings.includes(cleanQ)) {
    return {
      reply: `You are welcome. Let me know if you need help finding anything else across the ASTU campus.`,
      suggestedPlaces: [],
      isFallback: true,
    };
  }

  // 3. Identity / Capabilities
  if (
    cleanQ.includes('who are you') ||
    cleanQ.includes('what are you') ||
    cleanQ.includes('what can you do') ||
    cleanQ.includes('how do you work') ||
    cleanQ === 'help'
  ) {
    return {
      reply: `I am your **ASTU AI Campus Guide**!\n\nHere is how I can assist you:\n- **Find buildings & labs**: Search by name or code (e.g. *Central Library*, *SOEEC*, *B7*, *SCAFE*).\n- **Locate rooms & services**: Find offices like the Registrar, Visual Arts Club, or student clinics.\n- **Walking directions**: Tap **Get Directions** on any suggested location to calculate turn-by-turn footpaths on the map.`,
      suggestedPlaces: [],
      isFallback: true,
    };
  }

  // 4. General query about ASTU
  if (
    cleanQ === 'astu' ||
    cleanQ.includes('what is astu') ||
    cleanQ.includes('about astu') ||
    cleanQ.includes('where is astu located')
  ) {
    return {
      reply: `**Adama Science and Technology University (ASTU)** is a leading public science and technology institution located in Adama, Oromia, Ethiopia. It specializes in applied engineering, computing, technology innovation, and advanced research.\n\nAsk me about any specific campus building, dormitory, library, or gate to see it on the map!`,
      suggestedPlaces: [],
      isFallback: true,
    };
  }

  // Helper to find building by ID or Code
  const findB = (idOrCode: string) =>
    campusData.buildings.find(
      (b) =>
        b.id.toLowerCase() === idOrCode.toLowerCase() ||
        b.code.toLowerCase() === idOrCode.toLowerCase()
    );

  // 5. Common topic fallback: Dining & Food
  if (
    cleanQ.includes('eat') ||
    cleanQ.includes('food') ||
    cleanQ.includes('cafe') ||
    cleanQ.includes('lunch') ||
    cleanQ.includes('breakfast') ||
    cleanQ.includes('dining') ||
    cleanQ.includes('dinner')
  ) {
    const b = findB('students_cafe') || findB('SCAFE');
    if (b) {
      return {
        reply: `For meals and snacks, visit the **${b.name} (${b.code})**.\n\nIt features the Student Main Dining Hall, providing daily breakfast, lunch, and dinner for ASTU students.`,
        suggestedPlaces: [
          {
            buildingId: b.id,
            buildingName: b.name,
            buildingCode: b.code,
            roomName: 'Student Main Dining Hall',
            reason: 'Main campus student dining hall',
          },
        ],
        isFallback: true,
      };
    }
  }

  // 6. Common topic fallback: Libraries & Study
  if (cleanQ.includes('library') || cleanQ.includes('book') || cleanQ.includes('study')) {
    const clib = findB('central_library') || findB('CLIB');
    const pglib = findB('pg_library') || findB('PGLIB');
    const flib = findB('female_library') || findB('FLIB');
    const aslib = findB('app_sci_lib') || findB('ASLIB');
    const places: SuggestedPlace[] = [];
    if (clib) places.push({ buildingId: clib.id, buildingName: clib.name, buildingCode: clib.code, reason: 'Main Central Library' });
    if (pglib) places.push({ buildingId: pglib.id, buildingName: pglib.name, buildingCode: pglib.code, reason: 'Postgraduate Library' });
    if (flib) places.push({ buildingId: flib.id, buildingName: flib.name, buildingCode: flib.code, reason: 'Female Library' });
    if (aslib) places.push({ buildingId: aslib.id, buildingName: aslib.name, buildingCode: aslib.code, reason: 'Applied Science Library' });

    return {
      reply: `ASTU provides several specialized libraries for quiet study, digital research, and reference literature:\n\n- **ASTU Central Library (CLIB)**: Main university study hall and digital repository.\n- **Postgraduate Library (PGLIB)**: Dedicated study spaces for masters and PhD research.\n- **Female Library (FLIB)**: Focused quiet study center for female students.\n- **Applied Science Library (ASLIB)**: Science & STEM reference literature.`,
      suggestedPlaces: places,
      isFallback: true,
    };
  }

  // 7. Common topic fallback: Sports & Recreation
  if (
    cleanQ.includes('sport') ||
    cleanQ.includes('ball') ||
    cleanQ.includes('gym') ||
    cleanQ.includes('tennis') ||
    cleanQ.includes('stadium')
  ) {
    const stad = findB('astu_stadium') || findB('STAD');
    const tennis = findB('kt_tennis_court') || findB('KTTC');
    const sport = findB('b_sport') || findB('SPORT');
    const places: SuggestedPlace[] = [];
    if (stad) places.push({ buildingId: stad.id, buildingName: stad.name, buildingCode: stad.code, reason: 'Football & athletics stadium' });
    if (sport) places.push({ buildingId: sport.id, buildingName: sport.name, buildingCode: sport.code, reason: 'Basketball court' });
    if (tennis) places.push({ buildingId: tennis.id, buildingName: tennis.name, buildingCode: tennis.code, reason: 'Tennis court' });

    return {
      reply: `ASTU offers several sports and recreational facilities:\n\n- **ASTU Stadium (STAD)**: Main arena for soccer matches, track and field athletics.\n- **Basketball Court (SPORT)**: Outdoor tournament and practice courts.\n- **KT Tennis Court (KTTC)**: Dedicated tennis recreation ground.`,
      suggestedPlaces: places,
      isFallback: true,
    };
  }

  // 8. Common topic fallback: Administration & Leadership
  if (
    cleanQ.includes('admin') ||
    cleanQ.includes('registrar') ||
    cleanQ.includes('office') ||
    cleanQ.includes('president')
  ) {
    const admin = findB('admin_building') || findB('ADMIN');
    if (admin) {
      return {
        reply: `University administrative services are located in the **${admin.name} (${admin.code})**.\n\nHere you will find the President's office, Academic Registrar, Admissions, and university directorates.`,
        suggestedPlaces: [
          {
            buildingId: admin.id,
            buildingName: admin.name,
            buildingCode: admin.code,
            reason: 'Central university administration and registrar',
          },
        ],
        isFallback: true,
      };
    }
  }

  // 9. Database Search Match
  const searchResults = searchCampus(query, campusData);
  const validMatches = searchResults.filter((r) => r.score >= 70);

  if (validMatches.length > 0) {
    const suggestedPlaces: SuggestedPlace[] = [];
    for (const res of validMatches.slice(0, 3)) {
      suggestedPlaces.push({
        buildingId: res.building.id,
        buildingName: res.building.name,
        buildingCode: res.building.code,
        roomName: res.matchingRoom?.name,
        reason: res.matchingRoom
          ? `Room: ${res.matchingRoom.name} (${res.matchingRoom.workDescription || 'Campus facility'})`
          : cleanBuildingDescription(res.building.details?.description) || `Campus ${res.building.category} facility`,
      });
    }

    const top = validMatches[0];
    const topBuilding = top.building;
    const topRoom = top.matchingRoom;

    const sections: string[] = [];

    // Title / Match line
    sections.push(`I found **${topBuilding.name} (${topBuilding.code})** for you.`);

    // Room info if matched
    if (topRoom) {
      let roomText = `**Room**: ${topRoom.name} is located on Floor ${topRoom.floor}.`;
      if (topRoom.workDescription) {
        roomText += `\n*Services*: ${topRoom.workDescription}`;
      }
      sections.push(roomText);
    }

    // Description (cleaned of raw coordinate digits)
    const cleanedDesc = cleanBuildingDescription(topBuilding.details?.description);
    if (cleanedDesc && cleanedDesc !== topBuilding.name) {
      sections.push(cleanedDesc);
    }

    // Department & Hours
    if (topBuilding.details?.department) {
      sections.push(`**Department**: ${topBuilding.details.department}`);
    }
    if (topBuilding.details?.hours) {
      sections.push(`**Hours**: ${topBuilding.details.hours}`);
    }

    return {
      reply: sections.join('\n\n'),
      suggestedPlaces,
      isFallback: true,
    };
  }

  // 10. Fallback when no match exists (DO NOT force location cards!)
  return {
    reply: `I couldn't find a matching campus building or room for "${query}".\n\nTry searching by building code (such as **CLIB**, **SOEEC**, **ADMIN**), or asking for specific facilities like the *library*, *cafeteria*, *dormitory*, or *stadium*.`,
    suggestedPlaces: [],
    isFallback: true,
  };
}
