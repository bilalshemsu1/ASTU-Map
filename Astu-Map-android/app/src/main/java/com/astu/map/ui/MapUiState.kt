package com.astu.map.ui

import com.astu.map.location.UserLocationState
import com.astu.map.model.*

data class MapUiState(
    val campusData: CampusData = CampusData(),
    val isLoadingData: Boolean = true,
    val selectedBuilding: Building? = null,
    val searchQuery: String = "",
    val searchResults: List<SearchResult> = emptyList(),
    val selectedCategory: String? = null,
    val mapTileType: MapTileType = MapTileType.SATELLITE,

    // Navigation & Routing
    val isDirectionsMode: Boolean = false,
    val startNode: PathNode? = null,
    val targetNode: PathNode? = null,
    val routeResult: RouteResult? = null,
    val isWheelchairMode: Boolean = false,
    val isNavigating: Boolean = false,
    val activeStepIndex: Int = 0,
    val isSimulating: Boolean = false,
    val isVoiceMuted: Boolean = false,

    // User Location & Orientation
    val userLocation: UserLocationState? = null,
    val compassHeading: Float = 0f,
    val isCompassFollowEnabled: Boolean = false,
    val cameraRecenterTrigger: Long = 0L,

    // AI Assistant
    val isAiAssistantOpen: Boolean = false,
    val chatMessages: List<ChatMessage> = emptyList(),
    val isAiLoading: Boolean = false
)
