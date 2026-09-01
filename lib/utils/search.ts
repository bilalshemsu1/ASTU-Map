import { Building, Room, CampusData } from '../types/map';

export interface SearchResult {
  building: Building;
  matchingRoom?: Room;
  score: number;
}

export function searchCampus(query: string, campusData: CampusData): SearchResult[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.toLowerCase().trim();

  const results: SearchResult[] = [];

  for (const b of campusData.buildings) {
    let bestScore = 0;
    let matchedRoom: Room | undefined = undefined;

    // Check building code (e.g. B7)
    if (b.code.toLowerCase() === q) {
      bestScore = Math.max(bestScore, 100);
    } else if (b.code.toLowerCase().includes(q)) {
      bestScore = Math.max(bestScore, 80);
    }

    // Check building name
    const bName = b.name.toLowerCase();
    if (bName === q) {
      bestScore = Math.max(bestScore, 95);
    } else if (bName.includes(q)) {
      bestScore = Math.max(bestScore, 75);
    }

    // Check aliases
    for (const alias of b.aliases) {
      const a = alias.toLowerCase();
      if (a === q) {
        bestScore = Math.max(bestScore, 90);
      } else if (a.includes(q)) {
        bestScore = Math.max(bestScore, 70);
      }
    }

    // Check rooms
    for (const room of b.rooms) {
      const rName = room.name.toLowerCase();
      const fullRoomCode = `${b.code} ${room.name}`.toLowerCase();

      if (rName === q || fullRoomCode === q) {
        bestScore = Math.max(bestScore, 95);
        matchedRoom = room;
      } else if (rName.includes(q) || fullRoomCode.includes(q)) {
        if (bestScore < 85) {
          bestScore = 85;
          matchedRoom = room;
        }
      }

      if (room.aliases) {
        for (const ra of room.aliases) {
          if (ra.toLowerCase().includes(q)) {
            if (bestScore < 80) {
              bestScore = 80;
              matchedRoom = room;
            }
          }
        }
      }
    }

    if (bestScore > 0) {
      results.push({
        building: b,
        matchingRoom: matchedRoom,
        score: bestScore
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
