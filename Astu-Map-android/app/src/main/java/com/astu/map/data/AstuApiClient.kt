package com.astu.map.data

import com.astu.map.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class AstuApiClient(
    var baseUrl: String = "https://astu-map.vercel.app/"
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun checkApiHealth(): Boolean = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api")
                .get()
                .build()
            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            false
        }
    }

    suspend fun syncCampusData(): CampusData? = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/campus")
                .get()
                .build()
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: return@withContext null
                    json.decodeFromString<CampusData>(body)
                } else null
            }
        } catch (e: Exception) {
            null
        }
    }

    suspend fun sendChatMessage(
        message: String,
        campusData: CampusData
    ): AIChatResponse = withContext(Dispatchers.IO) {
        try {
            val payload = buildJsonObject {
                put("message", message)
            }
            val requestBody = json.encodeToString(payload).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl/api/chat")
                .post(requestBody)
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (body != null) {
                        return@withContext json.decodeFromString<AIChatResponse>(body)
                    }
                }
            }
        } catch (e: Exception) {
            // Fallback handled below
        }

        // Local Smart Fallback if server is offline or unreachable
        return@withContext generateLocalAiFallback(message, campusData)
    }

    private fun generateLocalAiFallback(query: String, campusData: CampusData): AIChatResponse {
        val q = query.lowercase().trim()

        val matchingBuildings = campusData.buildings.filter { b ->
            b.name.lowercase().contains(q) ||
            b.code.lowercase().contains(q) ||
            b.aliases.any { it.lowercase().contains(q) } ||
            b.category.lowercase().contains(q) ||
            b.rooms.any { r -> r.name.lowercase().contains(q) || r.workDescription?.lowercase()?.contains(q) == true }
        }

        if (matchingBuildings.isNotEmpty()) {
            val primary = matchingBuildings.first()
            val places = matchingBuildings.take(4).map {
                SuggestedPlace(
                    id = it.id,
                    name = it.name,
                    code = it.code,
                    category = it.category,
                    center = it.center,
                    entranceNodeId = it.entranceNodeId
                )
            }
            val actions = listOf(
                ChatAction(type = "direct_to_place", targetId = primary.id, label = "Take me to ${primary.name}")
            )
            return AIChatResponse(
                reply = "I found ${primary.name} (${primary.code}) on campus. It has ${primary.rooms.size} registered rooms/labs. Tap below to navigate directly there.",
                suggestedPlaces = places,
                actions = actions,
                source = "ASTU Campus Navigator (Local Fallback)"
            )
        }

        return AIChatResponse(
            reply = "Welcome to ASTU! You can search for academic blocks (SOEEC, Architecture, Chemical), libraries, cafeterias, freshman dorms, or administrative services. Tap any suggested location to begin walking navigation.",
            suggestedPlaces = campusData.buildings.take(3).map {
                SuggestedPlace(it.id, it.name, it.code, it.category, it.center, it.entranceNodeId)
            },
            source = "ASTU Campus Guide (Offline)"
        )
    }
}
