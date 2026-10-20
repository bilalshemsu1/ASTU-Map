import { Building, Room, CampusData } from '../types/map';

export interface SearchResult {
  building: Building;
  matchingRoom?: Room;
  score: number;
}

const STOPWORDS = new Set([
  'where', 'is', 'the', 'how', 'do', 'i', 'get', 'to', 'can', 'find', 'what',
  'a', 'an', 'in', 'at', 'for', 'of', 'and', 'or', 'on', 'tell', 'me', 'about',
  'show', 'please', 'located', 'there', 'any'
]);

const GREETINGS = new Set([
  'hi', 'hello', 'hey', 'greetings', 'selam', 'morning', 'afternoon', 'evening',
  'yo', 'sup', 'hola', 'good morning', 'good afternoon', 'good evening'
]);

/**
 * Checks whether target text matches the query string.
 * For queries under 3 characters (e.g. "hi", "in", "to"), requires exact whole-word boundaries
 * so it never falsely matches substrings like "hi" inside "Graphics" or "Architecture".
 */
function matchesWord(target: string, query: string): boolean {
  if (!target || !query) return false;
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  if (t === q) return true;

  if (q.length < 3) {
    const regex = new RegExp(`(^|[^a-z0-9])${q}([^a-z0-9]|$)`, 'i');
    return regex.test(t);
  }

  return t.includes(q);
}

export function searchCampus(query: string, campusData: CampusData): SearchResult[] {
  if (!query || query.trim().length === 0) return [];
  const rawQ = query.toLowerCase().trim();
  const cleanQ = rawQ.replace(/[?!.,;:()'"]/g, '').trim();

  // If the query is purely a conversational greeting, do not return buildings
  if (GREETINGS.has(cleanQ)) {
    return [];
  }

  // Extract non-stopword keywords from natural queries like "where is the library?"
  const keywords = cleanQ
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));

  const results: SearchResult[] = [];

  for (const b of campusData.buildings) {
    let bestScore = 0;
    let matchedRoom: Room | undefined = undefined;

    const bCode = b.code.toLowerCase();
    const bName = b.name.toLowerCase();

    // 1. Check exact building code (e.g. B7, CLIB, SCAFE)
    if (bCode === cleanQ) {
      bestScore = Math.max(bestScore, 100);
    } else if (matchesWord(b.code, cleanQ)) {
      bestScore = Math.max(bestScore, 85);
    }

    // 2. Check building name
    if (bName === cleanQ) {
      bestScore = Math.max(bestScore, 95);
    } else if (matchesWord(b.name, cleanQ)) {
      bestScore = Math.max(bestScore, 80);
    }

    // 3. Check aliases
    for (const alias of b.aliases) {
      const a = alias.toLowerCase();
      if (a === cleanQ) {
        bestScore = Math.max(bestScore, 90);
      } else if (matchesWord(alias, cleanQ)) {
        bestScore = Math.max(bestScore, 75);
      }
    }

    // 4. Check rooms
    for (const room of b.rooms) {
      const rName = room.name.toLowerCase();
      const fullRoomCode = `${b.code} ${room.name}`.toLowerCase();

      if (rName === cleanQ || fullRoomCode === cleanQ) {
        bestScore = Math.max(bestScore, 95);
        matchedRoom = room;
      } else if (matchesWord(room.name, cleanQ) || matchesWord(fullRoomCode, cleanQ)) {
        if (bestScore < 85) {
          bestScore = 85;
          matchedRoom = room;
        }
      }

      if (room.aliases) {
        for (const ra of room.aliases) {
          if (matchesWord(ra, cleanQ)) {
            if (bestScore < 80) {
              bestScore = 80;
              matchedRoom = room;
            }
          }
        }
      }
    }

    // 5. If no full match, check multi-keyword matches from natural language questions
    if (bestScore === 0 && keywords.length > 0) {
      let keywordHits = 0;
      for (const k of keywords) {
        if (k.length < 3) continue; // Skip single/two letter noise words
        if (matchesWord(b.name, k) || matchesWord(b.code, k) || b.aliases.some((a) => matchesWord(a, k))) {
          keywordHits++;
        } else {
          // Check rooms
          for (const room of b.rooms) {
            if (matchesWord(room.name, k) || (room.workDescription && matchesWord(room.workDescription, k))) {
              keywordHits++;
              matchedRoom = room;
              break;
            }
          }
        }
      }

      if (keywordHits > 0) {
        // Score based on percentage of keywords matched
        const hitRatio = keywordHits / keywords.length;
        bestScore = Math.round(70 + hitRatio * 20); // 70 to 90
      }
    }

    if (bestScore > 0) {
      results.push({
        building: b,
        matchingRoom: matchedRoom,
        score: bestScore,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
