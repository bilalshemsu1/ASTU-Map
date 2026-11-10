package com.astu.map.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.astu.map.data.AstuApiClient
import com.astu.map.data.CampusRepository
import com.astu.map.domain.DijkstraRouter
import com.astu.map.domain.SearchEngine
import com.astu.map.location.LocationTracker
import com.astu.map.location.TtsManager
import com.astu.map.location.UserLocationState
import com.astu.map.model.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class MapViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = CampusRepository(application)
    private val apiClient = AstuApiClient()
    val ttsManager = TtsManager(application)
    private val locationTracker = LocationTracker(application)
    private val compassSensor = com.astu.map.location.CompassSensor(application)

    private val _uiState = MutableStateFlow(MapUiState())
    val uiState: StateFlow<MapUiState> = _uiState.asStateFlow()

    private var simulationJob: Job? = null
    private var locationJob: Job? = null
    private var compassJob: Job? = null

    init {
        loadInitialData()
        startLocationTracking()
        startCompassTracking()
    }

    private fun loadInitialData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingData = true) }
            val data = repository.getCampusData()
            _uiState.update {
                it.copy(
                    campusData = data,
                    isLoadingData = false
                )
            }

            // Background attempt to sync newest campus changes if web server is online
            val remoteData = apiClient.syncCampusData()
            if (remoteData != null && remoteData.buildings.isNotEmpty()) {
                repository.updateCampusData(remoteData)
                _uiState.update { it.copy(campusData = remoteData) }
            }
        }
    }

    fun startLocationTracking() {
        locationJob?.cancel()
        locationJob = viewModelScope.launch {
            try {
                locationTracker.getLocationUpdates().collect { loc ->
                    _uiState.update { it.copy(userLocation = loc) }
                }
            } catch (e: Exception) {
                // Permission not granted or sensor unavailable
            }
        }
    }

    fun startCompassTracking() {
        compassJob?.cancel()
        compassJob = viewModelScope.launch {
            try {
                compassSensor.getCompassHeading().collect { heading ->
                    _uiState.update { it.copy(compassHeading = heading) }
                }
            } catch (e: Exception) {
                // Compass sensor unavailable
            }
        }
    }

    fun toggleCompassFollowMode() {
        _uiState.update { it.copy(isCompassFollowEnabled = !it.isCompassFollowEnabled) }
    }

    fun onSearchQueryChanged(query: String) {
        val campusData = _uiState.value.campusData
        val results = if (query.isNotBlank()) {
            SearchEngine.searchCampus(query, campusData)
        } else {
            emptyList()
        }
        _uiState.update {
            it.copy(
                searchQuery = query,
                searchResults = results
            )
        }
    }

    fun selectBuilding(building: Building?) {
        _uiState.update {
            it.copy(
                selectedBuilding = building,
                searchQuery = "",
                searchResults = emptyList(),
                cameraRecenterTrigger = System.currentTimeMillis()
            )
        }
    }

    fun filterByCategory(category: String?) {
        _uiState.update {
            val newCategory = if (it.selectedCategory == category) null else category
            it.copy(selectedCategory = newCategory)
        }
    }

    fun toggleMapTileType() {
        _uiState.update {
            val next = if (it.mapTileType == MapTileType.SATELLITE) MapTileType.ROADMAP else MapTileType.SATELLITE
            it.copy(mapTileType = next)
        }
    }

    fun recenterCamera() {
        _uiState.update { it.copy(cameraRecenterTrigger = System.currentTimeMillis()) }
    }

    // Directions & Routing
    fun openDirections(
        targetBuilding: Building? = null,
        targetRoom: Room? = null
    ) {
        val campusData = _uiState.value.campusData
        val userLoc = _uiState.value.userLocation?.coordinates ?: campusData.meta.center

        val startNode = PathNode(
            id = "user_start",
            lat = userLoc.lat,
            lng = userLoc.lng,
            label = "My Location"
        )

        val targetNode = targetBuilding?.let { b ->
            val node = campusData.nodes.find { it.id == b.entranceNodeId }
            node ?: PathNode(b.id, b.center.lat, b.center.lng, b.name)
        }

        _uiState.update {
            it.copy(
                isDirectionsMode = true,
                startNode = startNode,
                targetNode = targetNode,
                selectedBuilding = targetBuilding
            )
        }

        if (targetNode != null) {
            calculateRoute(startNode, targetNode)
        }
    }

    fun closeDirections() {
        stopSimulation()
        _uiState.update {
            it.copy(
                isDirectionsMode = false,
                isNavigating = false,
                routeResult = null,
                activeStepIndex = 0
            )
        }
    }

    fun setOrigin(node: PathNode) {
        _uiState.update { it.copy(startNode = node) }
        val target = _uiState.value.targetNode
        if (target != null) {
            calculateRoute(node, target)
        }
    }

    fun setDestination(node: PathNode) {
        _uiState.update { it.copy(targetNode = node) }
        val start = _uiState.value.startNode
        if (start != null) {
            calculateRoute(start, node)
        }
    }

    fun swapOriginDestination() {
        val currentStart = _uiState.value.startNode
        val currentTarget = _uiState.value.targetNode
        _uiState.update {
            it.copy(
                startNode = currentTarget,
                targetNode = currentStart
            )
        }
        if (currentTarget != null && currentStart != null) {
            calculateRoute(currentTarget, currentStart)
        }
    }

    fun toggleWheelchairMode() {
        val newMode = !_uiState.value.isWheelchairMode
        _uiState.update { it.copy(isWheelchairMode = newMode) }
        val start = _uiState.value.startNode
        val target = _uiState.value.targetNode
        if (start != null && target != null) {
            calculateRoute(start, target, newMode)
        }
    }

    private fun calculateRoute(
        start: PathNode,
        target: PathNode,
        wheelchair: Boolean = _uiState.value.isWheelchairMode
    ) {
        val campusData = _uiState.value.campusData
        val result = DijkstraRouter.fetchWalkingRoute(
            start = LatLng(start.lat, start.lng),
            target = LatLng(target.lat, target.lng),
            startNodeId = start.id,
            targetNodeId = target.id,
            campusData = campusData,
            wheelchairAccessible = wheelchair
        )

        _uiState.update {
            it.copy(
                routeResult = result,
                activeStepIndex = 0,
                cameraRecenterTrigger = System.currentTimeMillis()
            )
        }
    }

    // Live Navigation & Simulation
    fun startNavigation() {
        _uiState.update {
            it.copy(
                isNavigating = true,
                activeStepIndex = 0
            )
        }
        val firstStep = _uiState.value.routeResult?.steps?.firstOrNull()
        if (firstStep != null) {
            ttsManager.speak(firstStep.instruction)
        }
    }

    fun stopNavigation() {
        stopSimulation()
        _uiState.update { it.copy(isNavigating = false) }
        ttsManager.stop()
    }

    fun nextStep() {
        val steps = _uiState.value.routeResult?.steps ?: return
        val current = _uiState.value.activeStepIndex
        if (current < steps.size - 1) {
            val next = current + 1
            _uiState.update { it.copy(activeStepIndex = next) }
            ttsManager.speak(steps[next].instruction)
        }
    }

    fun prevStep() {
        val steps = _uiState.value.routeResult?.steps ?: return
        val current = _uiState.value.activeStepIndex
        if (current > 0) {
            val prev = current - 1
            _uiState.update { it.copy(activeStepIndex = prev) }
            ttsManager.speak(steps[prev].instruction)
        }
    }

    fun toggleVoiceMute() {
        val muted = !_uiState.value.isVoiceMuted
        ttsManager.isMuted = muted
        _uiState.update { it.copy(isVoiceMuted = muted) }
    }

    fun startSimulation() {
        val route = _uiState.value.routeResult ?: return
        if (route.steps.isEmpty()) return

        stopSimulation()
        _uiState.update { it.copy(isSimulating = true, isNavigating = true) }

        simulationJob = viewModelScope.launch {
            val steps = route.steps
            for (i in _uiState.value.activeStepIndex until steps.size) {
                _uiState.update { it.copy(activeStepIndex = i) }
                ttsManager.speak(steps[i].instruction)
                // Simulate walking time per step (roughly 3 seconds per step for demo)
                delay(3500)
            }
            _uiState.update { it.copy(isSimulating = false) }
            ttsManager.speak("You have arrived at your destination.")
        }
    }

    fun stopSimulation() {
        simulationJob?.cancel()
        simulationJob = null
        _uiState.update { it.copy(isSimulating = false) }
    }

    // AI Assistant
    fun openAiAssistant() {
        _uiState.update { it.copy(isAiAssistantOpen = true) }
        if (_uiState.value.chatMessages.isEmpty()) {
            _uiState.update {
                it.copy(
                    chatMessages = listOf(
                        ChatMessage(
                            role = "assistant",
                            content = "Hello! I am your ASTU Campus Guide. Ask me anything about faculties, laboratories, student cafeterias, libraries, or administrative services."
                        )
                    )
                )
            }
        }
    }

    fun closeAiAssistant() {
        _uiState.update { it.copy(isAiAssistantOpen = false) }
    }

    fun sendAiMessage(userText: String) {
        if (userText.isBlank()) return

        val userMessage = ChatMessage(role = "user", content = userText)
        _uiState.update {
            it.copy(
                chatMessages = it.chatMessages + userMessage,
                isAiLoading = true
            )
        }

        viewModelScope.launch {
            val campusData = _uiState.value.campusData
            val response = apiClient.sendChatMessage(userText, campusData)

            val aiMessage = ChatMessage(
                role = "assistant",
                content = response.reply,
                suggestedPlaces = response.suggestedPlaces,
                actions = response.actions
            )

            _uiState.update {
                it.copy(
                    chatMessages = it.chatMessages + aiMessage,
                    isAiLoading = false
                )
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        simulationJob?.cancel()
        locationJob?.cancel()
        compassJob?.cancel()
        ttsManager.shutdown()
    }
}
