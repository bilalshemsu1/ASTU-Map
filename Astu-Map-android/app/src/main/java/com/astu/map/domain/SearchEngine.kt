package com.astu.map.domain

import com.astu.map.model.Building
import com.astu.map.model.CampusData
import com.astu.map.model.Room
import com.astu.map.model.SearchResult

object SearchEngine {

    private val STOPWORDS = setOf(
        "where", "is", "the", "how", "do", "i", "get", "to", "can", "find", "what",
        "a", "an", "in", "at", "for", "of", "and", "or", "on", "tell", "me", "about",
        "show", "please", "located", "there", "any"
    )

    private val GREETINGS = setOf(
        "hi", "hello", "hey", "greetings", "selam", "morning", "afternoon", "evening",
        "yo", "sup", "hola", "good morning", "good afternoon", "good evening"
    )

    private fun matchesWord(target: String?, query: String): Boolean {
        if (target.isNullOrEmpty() || query.isEmpty()) return false
        val t = target.lowercase()
        val q = query.lowercase()

        if (t == q) return true
        if (q.length < 3) {
            val regex = Regex("(^|[^a-z0-9])${Regex.escape(q)}([^a-z0-9]|$)", RegexOption.IGNORE_CASE)
            return regex.containsMatchIn(t)
        }
        return t.contains(q)
    }

    fun searchCampus(query: String, campusData: CampusData): List<SearchResult> {
        val rawQ = query.lowercase().trim()
        val cleanQ = rawQ.replace(Regex("[?!.,;:()'\"/]"), "").trim()
        if (cleanQ.isEmpty() || cleanQ in GREETINGS) return emptyList()

        val keywords = cleanQ.split(Regex("\\s+")).filter { it.isNotEmpty() && it !in STOPWORDS }

        val results = mutableListOf<SearchResult>()

        for (building in campusData.buildings) {
            var bestScore = 0
            var matchedRoom: Room? = null

            val code = building.code.lowercase().trim()
            val name = building.name.lowercase().trim()

            // 1. Building Code Match
            if (code == cleanQ) {
                bestScore += 150
            } else if (code.startsWith(cleanQ)) {
                bestScore += 100
            } else if (matchesWord(code, cleanQ)) {
                bestScore += 70
            }

            // 2. Building Name Match
            if (name == cleanQ) {
                bestScore += 120
            } else if (name.startsWith(cleanQ)) {
                bestScore += 90
            } else if (matchesWord(name, cleanQ)) {
                bestScore += 60
            }

            // 3. Keyword Matches in Name & Code
            keywords.forEach { kw ->
                if (matchesWord(name, kw)) bestScore += 35
                if (matchesWord(code, kw)) bestScore += 40
            }

            // 4. Aliases
            building.aliases.forEach { alias ->
                if (alias.equals(cleanQ, ignoreCase = true)) {
                    bestScore += 80
                } else if (matchesWord(alias, cleanQ)) {
                    bestScore += 45
                }
            }

            // 5. Category & Department
            if (matchesWord(building.category, cleanQ)) bestScore += 30
            building.details?.department?.let { dept ->
                if (matchesWord(dept, cleanQ)) bestScore += 40
            }

            // 6. Rooms Directory Inspection
            for (room in building.rooms) {
                var roomScore = 0
                val rName = room.name.lowercase()

                if (rName == cleanQ) {
                    roomScore += 95
                } else if (rName.startsWith(cleanQ)) {
                    roomScore += 75
                } else if (matchesWord(rName, cleanQ)) {
                    roomScore += 50
                }

                room.aliases.forEach { rAlias ->
                    if (rAlias.equals(cleanQ, ignoreCase = true)) roomScore += 60
                    else if (matchesWord(rAlias, cleanQ)) roomScore += 35
                }

                room.workDescription?.let { desc ->
                    if (matchesWord(desc, cleanQ)) roomScore += 30
                }

                room.equipment.forEach { eq ->
                    if (matchesWord(eq, cleanQ)) roomScore += 25
                }

                if (roomScore > 0 && (matchedRoom == null || roomScore > bestScore)) {
                    bestScore = maxOf(bestScore, roomScore + 20)
                    matchedRoom = room
                }
            }

            if (bestScore > 0) {
                results.add(SearchResult(building = building, matchingRoom = matchedRoom, score = bestScore))
            }
        }

        return results.sortedByDescending { it.score }
    }
}
