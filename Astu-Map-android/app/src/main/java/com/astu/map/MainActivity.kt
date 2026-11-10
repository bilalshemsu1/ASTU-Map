package com.astu.map

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.astu.map.ui.*

class MainActivity : ComponentActivity() {

    private val viewModel: MapViewModel by viewModels()

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fineGranted || coarseGranted) {
            viewModel.startLocationTracking()
            viewModel.startCompassTracking()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF1A73E8),
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFE8F0FE),
                    surface = Color.White,
                    onSurface = Color(0xFF202124),
                    surfaceVariant = Color(0xFFF1F3F4)
                )
            ) {
                val uiState by viewModel.uiState.collectAsState()

                Box(modifier = Modifier.fillMaxSize()) {
                    // 1. Map Canvas Layer
                    MapViewContainer(
                        uiState = uiState,
                        onSelectBuilding = { building ->
                            viewModel.selectBuilding(building)
                        }
                    )

                    // 2. Top Search Bar & Category Chips (Translucent & Space-Efficient)
                    if (!uiState.isNavigating) {
                        TopSearchBar(
                            query = uiState.searchQuery,
                            onQueryChanged = { viewModel.onSearchQueryChanged(it) },
                            searchResults = uiState.searchResults,
                            onSelectBuilding = { building ->
                                viewModel.selectBuilding(building)
                            },
                            selectedCategory = uiState.selectedCategory,
                            onCategorySelected = { viewModel.filterByCategory(it) },
                            mapTileType = uiState.mapTileType,
                            onToggleMapTileType = { viewModel.toggleMapTileType() },
                            onOpenAiGuide = { viewModel.openAiAssistant() },
                            onRecenterGps = { viewModel.recenterCamera() },
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .statusBarsPadding()
                        )
                    }

                    // 3. Navigation HUD (Translucent compact Forest Green guidance)
                    if (uiState.isNavigating && uiState.routeResult != null) {
                        NavigationHUD(
                            routeResult = uiState.routeResult!!,
                            activeStepIndex = uiState.activeStepIndex,
                            isSimulating = uiState.isSimulating,
                            isVoiceMuted = uiState.isVoiceMuted,
                            onNextStep = { viewModel.nextStep() },
                            onPrevStep = { viewModel.prevStep() },
                            onToggleVoice = { viewModel.toggleVoiceMute() },
                            onToggleSimulation = {
                                if (uiState.isSimulating) viewModel.stopSimulation()
                                else viewModel.startSimulation()
                            },
                            onStopNavigation = { viewModel.stopNavigation() },
                            modifier = Modifier
                                .align(Alignment.TopCenter)
                                .statusBarsPadding()
                        )
                    }

                    // 4. Floating Action Buttons (Compass Rotate, Recenter GPS, Quick Directions)
                    if (!uiState.isNavigating && !uiState.isDirectionsMode && uiState.selectedBuilding == null) {
                        Column(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .padding(end = 12.dp, bottom = 24.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Compass Follow / Phone Direction Toggle FAB
                            FloatingActionButton(
                                onClick = { viewModel.toggleCompassFollowMode() },
                                containerColor = if (uiState.isCompassFollowEnabled) Color(0xFF1A73E8) else Color.White.copy(alpha = 0.90f),
                                contentColor = if (uiState.isCompassFollowEnabled) Color.White else Color(0xFF1A73E8),
                                shape = CircleShape,
                                modifier = Modifier.size(42.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Explore,
                                    contentDescription = "Compass Follow Mode",
                                    modifier = Modifier.size(20.dp)
                                )
                            }

                            // Recenter GPS FAB
                            FloatingActionButton(
                                onClick = { viewModel.recenterCamera() },
                                containerColor = Color.White.copy(alpha = 0.90f),
                                contentColor = Color(0xFF1A73E8),
                                shape = CircleShape,
                                modifier = Modifier.size(42.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.MyLocation,
                                    contentDescription = "Recenter",
                                    modifier = Modifier.size(20.dp)
                                )
                            }

                            // Directions FAB
                            FloatingActionButton(
                                onClick = { viewModel.openDirections() },
                                containerColor = Color(0xFF1A73E8),
                                contentColor = Color.White,
                                shape = CircleShape,
                                modifier = Modifier.size(48.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Directions,
                                    contentDescription = "Directions",
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }

                    // 5. Selected Place Bottom Sheet (Translucent, compact)
                    if (uiState.selectedBuilding != null && !uiState.isDirectionsMode && !uiState.isNavigating) {
                        PlaceDetailBottomSheet(
                            building = uiState.selectedBuilding!!,
                            onClose = { viewModel.selectBuilding(null) },
                            onDirectionsClick = { building, room ->
                                viewModel.openDirections(building, room)
                            },
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .navigationBarsPadding()
                        )
                    }

                    // 6. Directions Panel (Origin/Destination & ETA summary)
                    if (uiState.isDirectionsMode && !uiState.isNavigating) {
                        DirectionsPanel(
                            startNode = uiState.startNode,
                            targetNode = uiState.targetNode,
                            routeResult = uiState.routeResult,
                            isWheelchairMode = uiState.isWheelchairMode,
                            onSwap = { viewModel.swapOriginDestination() },
                            onToggleWheelchair = { viewModel.toggleWheelchairMode() },
                            onStartNavigation = { viewModel.startNavigation() },
                            onStartSimulation = { viewModel.startSimulation() },
                            onClose = { viewModel.closeDirections() },
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .navigationBarsPadding()
                                .padding(horizontal = 8.dp, vertical = 6.dp)
                        )
                    }

                    // 7. AI Campus Assistant Dialog
                    if (uiState.isAiAssistantOpen) {
                        AiChatDialog(
                            messages = uiState.chatMessages,
                            isLoading = uiState.isAiLoading,
                            onSendMessage = { viewModel.sendAiMessage(it) },
                            onSelectPlace = { place ->
                                val building = uiState.campusData.buildings.find { it.id == place.id }
                                if (building != null) {
                                    viewModel.closeAiAssistant()
                                    viewModel.openDirections(building)
                                }
                            },
                            onDismiss = { viewModel.closeAiAssistant() }
                        )
                    }
                }
            }
        }
    }
}
