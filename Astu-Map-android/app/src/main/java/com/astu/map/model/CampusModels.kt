package com.astu.map.model

import kotlinx.serialization.Serializable

@Serializable
data class LatLng(
    val lat: Double,
    val lng: Double
)

@Serializable
data class Room(
    val id: String,
    val name: String,
    val floor: Int = 0,
    val aliases: List<String> = emptyList(),
    val capacity: Int? = null,
    val type: String? = null,
    val workDescription: String? = null,
    val equipment: List<String> = emptyList()
)

@Serializable
data class Meals(
    val breakfast: String? = null,
    val lunch: String? = null,
    val dinner: String? = null
)

@Serializable
data class FacilitySchedule(
    val days: String? = null,
    val open: String? = null,
    val close: String? = null,
    val is24x7: Boolean = false,
    val lunchStart: String? = null,
    val lunchEnd: String? = null,
    val meals: Meals? = null
)

@Serializable
data class PlaceDetails(
    val images: List<String> = emptyList(),
    val description: String? = null,
    val history: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val website: String? = null,
    val hours: String? = null,
    val operatingHours: FacilitySchedule? = null,
    val features: List<String> = emptyList(),
    val department: String? = null,
    val headOfDepartment: String? = null,
    val totalCapacity: Int? = null,
    val verified: Boolean = false
)

@Serializable
data class Building(
    val id: String,
    val name: String,
    val code: String = "",
    val aliases: List<String> = emptyList(),
    val category: String = "other",
    val polygon: List<LatLng> = emptyList(),
    val center: LatLng,
    val rooms: List<Room> = emptyList(),
    val entranceNodeId: String = "",
    val details: PlaceDetails? = null
)

@Serializable
data class PathNode(
    val id: String,
    val lat: Double,
    val lng: Double,
    val label: String? = null
)

@Serializable
data class PathEdge(
    val id: String,
    val source: String,
    val target: String,
    val weight: Double? = null,
    val type: String? = "paved_walkway",
    val isOneWay: Boolean = false,
    val handicapAccessible: Boolean = true
)

@Serializable
data class CampusMeta(
    val name: String = "ASTU Campus Map",
    val center: LatLng = LatLng(8.5638, 39.2905),
    val zoom: Int = 17
)

@Serializable
data class CampusSummary(
    val buildingsCount: Int = 0,
    val nodesCount: Int = 0,
    val edgesCount: Int = 0
)

@Serializable
data class CampusData(
    val meta: CampusMeta = CampusMeta(),
    val summary: CampusSummary? = null,
    val buildings: List<Building> = emptyList(),
    val nodes: List<PathNode> = emptyList(),
    val edges: List<PathEdge> = emptyList()
)

@Serializable
data class RouteStep(
    val instruction: String,
    val distanceMeters: Int,
    val fromNode: PathNode,
    val toNode: PathNode
)

@Serializable
data class RouteResult(
    val path: List<PathNode>,
    val totalDistanceMeters: Int,
    val estimatedTimeMinutes: Int,
    val steps: List<RouteStep>,
    val alternativePaths: List<List<PathNode>> = emptyList()
)

enum class OperatingStatus {
    OPEN,
    CLOSING_SOON,
    LUNCH_BREAK,
    CLOSED,
    OPEN_24_7
}

data class OperatingHoursStatus(
    val status: OperatingStatus,
    val badgeLabel: String,
    val badgeDetail: String,
    val statusDetail: String,
    val scheduleSummary: String
)

@Serializable
data class SuggestedPlace(
    val id: String,
    val name: String,
    val code: String = "",
    val category: String = "",
    val center: LatLng? = null,
    val entranceNodeId: String = ""
)

@Serializable
data class ChatAction(
    val type: String,
    val targetId: String? = null,
    val label: String? = null
)

@Serializable
data class AIChatResponse(
    val reply: String,
    val suggestedPlaces: List<SuggestedPlace> = emptyList(),
    val actions: List<ChatAction> = emptyList(),
    val source: String? = null
)

data class ChatMessage(
    val id: String = java.util.UUID.randomUUID().toString(),
    val role: String,
    val content: String,
    val suggestedPlaces: List<SuggestedPlace> = emptyList(),
    val actions: List<ChatAction> = emptyList(),
    val timestamp: Long = System.currentTimeMillis()
)

data class SearchResult(
    val building: Building,
    val matchingRoom: Room? = null,
    val score: Int
)

enum class MapTileType {
    SATELLITE,
    ROADMAP
}
