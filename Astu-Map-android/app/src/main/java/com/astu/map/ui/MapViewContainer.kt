package com.astu.map.ui

import android.graphics.Color
import android.graphics.Paint
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.astu.map.model.Building
import com.astu.map.model.MapTileType
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.OnlineTileSourceBase
import org.osmdroid.tileprovider.tilesource.TileSourcePolicy
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.util.MapTileIndex
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon
import org.osmdroid.views.overlay.Polyline
import org.osmdroid.views.overlay.gestures.RotationGestureOverlay

val ESRI_SATELLITE_TILE_SOURCE: OnlineTileSourceBase = object : OnlineTileSourceBase(
    "EsriWorldImagery",
    0,
    20,
    256,
    ".jpg",
    arrayOf("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/"),
    "Esri, Maxar, Earthstar Geographics",
    TileSourcePolicy(
        2,
        TileSourcePolicy.FLAG_NO_BULK
                or TileSourcePolicy.FLAG_NO_PREVENTIVE
                or TileSourcePolicy.FLAG_USER_AGENT_MEANINGFUL
                or TileSourcePolicy.FLAG_USER_AGENT_NORMALIZED
    )
) {
    override fun getTileURLString(pMapTileIndex: Long): String {
        val zoom = MapTileIndex.getZoom(pMapTileIndex)
        val x = MapTileIndex.getX(pMapTileIndex)
        val y = MapTileIndex.getY(pMapTileIndex)
        return "$baseUrl$zoom/$y/$x"
    }
}

val CARTO_VOYAGER_TILE_SOURCE: OnlineTileSourceBase = object : OnlineTileSourceBase(
    "CartoVoyager",
    0,
    20,
    256,
    ".png",
    arrayOf(
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/"
    ),
    "© OpenStreetMap contributors © CARTO"
) {
    override fun getTileURLString(pMapTileIndex: Long): String {
        val zoom = MapTileIndex.getZoom(pMapTileIndex)
        val x = MapTileIndex.getX(pMapTileIndex)
        val y = MapTileIndex.getY(pMapTileIndex)
        return "$baseUrl$zoom/$x/$y.png?api_key=cb1_562k_1_79403e51626391e2bf2534cc"
    }
}

@Composable
fun MapViewContainer(
    uiState: MapUiState,
    onSelectBuilding: (Building) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var mapViewRef by remember { mutableStateOf<MapView?>(null) }
    var rotationOverlayRef by remember { mutableStateOf<RotationGestureOverlay?>(null) }

    // Track the last handled camera recenter trigger so we NEVER jump back when user is exploring
    var lastHandledRecenterTrigger by remember { mutableLongStateOf(0L) }

    // Campus boundary limits
    val campusBoundingBox = remember {
        BoundingBox(8.5720, 39.2975, 8.5550, 39.2825)
    }

    DisposableEffect(context) {
        Configuration.getInstance().load(context, context.getSharedPreferences("osmdroid", 0))
        Configuration.getInstance().userAgentValue = "AstuCampusMapAndroid/1.0"
        onDispose {
            mapViewRef?.onDetach()
        }
    }

    AndroidView(
        modifier = modifier.fillMaxSize(),
        factory = { ctx ->
            MapView(ctx).apply {
                mapViewRef = this
                setMultiTouchControls(true)
                zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
                isTilesScaledToDpi = true
                minZoomLevel = 14.5
                maxZoomLevel = 21.0
                setScrollableAreaLimitDouble(campusBoundingBox)

                // Enable 2-Finger 360-degree free rotation
                val rotationOverlay = RotationGestureOverlay(this).apply {
                    isEnabled = true
                }
                rotationOverlayRef = rotationOverlay
                overlays.add(rotationOverlay)

                val centerGeo = GeoPoint(uiState.campusData.meta.center.lat, uiState.campusData.meta.center.lng)
                controller.setZoom(17.5)
                controller.setCenter(centerGeo)
            }
        },
        update = { mapView ->
            // Switch tile layer
            val desiredTileSource = if (uiState.mapTileType == MapTileType.SATELLITE) {
                ESRI_SATELLITE_TILE_SOURCE
            } else {
                CARTO_VOYAGER_TILE_SOURCE
            }

            if (mapView.tileProvider.tileSource.name() != desiredTileSource.name()) {
                mapView.setTileSource(desiredTileSource)
            }

            // Follow phone direction / compass rotation if enabled
            if (uiState.isCompassFollowEnabled) {
                mapView.mapOrientation = -uiState.compassHeading
            }

            // Clear dynamic overlays, preserving RotationGestureOverlay
            mapView.overlays.clear()
            rotationOverlayRef?.let { mapView.overlays.add(it) }

            // 1. Draw Building Polygons
            uiState.campusData.buildings.forEach { building ->
                val isSelected = uiState.selectedBuilding?.id == building.id
                val isTarget = uiState.targetNode?.id == building.entranceNodeId || uiState.targetNode?.id == building.id

                if (building.polygon.size >= 3) {
                    val polygonOverlay = Polygon(mapView)
                    val points = building.polygon.map { GeoPoint(it.lat, it.lng) }
                    polygonOverlay.points = points

                    val isCategoryMatched = uiState.selectedCategory == null || uiState.selectedCategory == building.category

                    val baseColor = when (building.category) {
                        "library" -> Color.argb(160, 37, 99, 235)      // Blue
                        "dining" -> Color.argb(160, 217, 119, 6)       // Amber
                        "administrative" -> Color.argb(160, 79, 70, 229) // Indigo
                        "academic" -> Color.argb(160, 16, 185, 129)     // Emerald
                        "dormitory" -> Color.argb(160, 147, 51, 234)    // Purple
                        "sports" -> Color.argb(160, 234, 88, 12)       // Orange
                        else -> Color.argb(140, 107, 114, 128)          // Gray
                    }

                    polygonOverlay.fillPaint.color = when {
                        isTarget -> Color.argb(220, 245, 158, 11) // Amber-yellow target highlight
                        isSelected -> Color.argb(220, 239, 68, 68) // Bright red selected
                        isCategoryMatched -> baseColor
                        else -> Color.argb(40, 100, 100, 100)
                    }

                    polygonOverlay.outlinePaint.color = if (isTarget) Color.YELLOW else if (isSelected) Color.WHITE else Color.argb(200, 255, 255, 255)
                    polygonOverlay.outlinePaint.strokeWidth = if (isTarget || isSelected) 6f else 2.5f

                    polygonOverlay.setOnClickListener { _, _, _ ->
                        onSelectBuilding(building)
                        true
                    }

                    mapView.overlays.add(polygonOverlay)
                }

                // 2. Building Center Markers (clean badges with code, NO default pointing hand)
                if (isTarget) {
                    // HUGE YELLOW DESTINATION PIN (no indicator hand, bright yellow)
                    val targetMarker = Marker(mapView)
                    targetMarker.position = GeoPoint(building.center.lat, building.center.lng)
                    targetMarker.title = building.name
                    targetMarker.snippet = "Destination: Block ${building.code}"
                    targetMarker.icon = MarkerUtils.createHugeTargetMarker(context)
                    targetMarker.setAnchor(Marker.ANCHOR_CENTER, 0.92f) // Anchor bottom point
                    targetMarker.setOnMarkerClickListener { _, _ ->
                        onSelectBuilding(building)
                        true
                    }
                    mapView.overlays.add(targetMarker)
                } else {
                    // Regular clean building badge with code (e.g. B7, B11)
                    val marker = Marker(mapView)
                    marker.position = GeoPoint(building.center.lat, building.center.lng)
                    marker.title = building.name
                    marker.snippet = "Block ${building.code}"
                    marker.icon = MarkerUtils.createBuildingBadgeMarker(
                        context = context,
                        code = building.code,
                        category = building.category,
                        isSelected = isSelected
                    )
                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    marker.setOnMarkerClickListener { _, _ ->
                        onSelectBuilding(building)
                        true
                    }
                    mapView.overlays.add(marker)
                }
            }

            // 3. Draw Route Polylines
            uiState.routeResult?.let { route ->
                // Alternative paths in subtle gray
                route.alternativePaths.forEach { altPath ->
                    val altPolyline = Polyline(mapView)
                    altPolyline.setPoints(altPath.map { GeoPoint(it.lat, it.lng) })
                    altPolyline.outlinePaint.color = Color.argb(130, 156, 163, 175)
                    altPolyline.outlinePaint.strokeWidth = 7f
                    mapView.overlays.add(altPolyline)
                }

                // Primary path in Google Maps blue
                val mainPolyline = Polyline(mapView)
                mainPolyline.setPoints(route.path.map { GeoPoint(it.lat, it.lng) })
                mainPolyline.outlinePaint.color = Color.rgb(26, 115, 232)
                mainPolyline.outlinePaint.strokeWidth = 13f
                mainPolyline.outlinePaint.strokeCap = Paint.Cap.ROUND
                mapView.overlays.add(mainPolyline)

                // If target is a custom user coordinate (not a building), render the huge yellow pin
                val lastNode = route.path.lastOrNull()
                val isBuildingTarget = uiState.campusData.buildings.any {
                    it.entranceNodeId == uiState.targetNode?.id || it.id == uiState.targetNode?.id
                }
                if (lastNode != null && !isBuildingTarget) {
                    val destMarker = Marker(mapView)
                    destMarker.position = GeoPoint(lastNode.lat, lastNode.lng)
                    destMarker.title = lastNode.label ?: "Destination"
                    destMarker.icon = MarkerUtils.createHugeTargetMarker(context)
                    destMarker.setAnchor(Marker.ANCHOR_CENTER, 0.92f)
                    mapView.overlays.add(destMarker)
                }
            }

            // 4. User Live Location Marker ("Man standing" avatar icon + Accuracy Circle)
            uiState.userLocation?.let { loc ->
                // Visual Accuracy Circle (shows satellite precision)
                if (loc.accuracyMeters > 0) {
                    val accuracyCircle = Polygon(mapView).apply {
                        points = Polygon.pointsAsCircle(
                            GeoPoint(loc.coordinates.lat, loc.coordinates.lng),
                            loc.accuracyMeters.toDouble().coerceIn(3.0, 80.0)
                        )
                        fillPaint.color = Color.argb(32, 26, 115, 232)
                        outlinePaint.color = Color.argb(120, 26, 115, 232)
                        outlinePaint.strokeWidth = 2f
                    }
                    mapView.overlays.add(accuracyCircle)
                }

                val userMarker = Marker(mapView)
                userMarker.position = GeoPoint(loc.coordinates.lat, loc.coordinates.lng)
                userMarker.title = "Your Location (${loc.accuracyMeters.toInt()}m precision)"
                userMarker.icon = MarkerUtils.createManStandingMarker(context, uiState.compassHeading)
                userMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                mapView.overlays.add(userMarker)
            }

            // 5. CAMERA CENTERING: ONLY when user explicitly triggers recenter / place selection
            // DOES NOT lock or jump back when user is casually panning/exploring!
            if (uiState.cameraRecenterTrigger > lastHandledRecenterTrigger) {
                lastHandledRecenterTrigger = uiState.cameraRecenterTrigger

                val targetCenter = when {
                    uiState.isNavigating && uiState.routeResult != null -> {
                        val activeStep = uiState.routeResult.steps.getOrNull(uiState.activeStepIndex)
                        if (activeStep != null) {
                            GeoPoint(activeStep.fromNode.lat, activeStep.fromNode.lng)
                        } else {
                            GeoPoint(uiState.routeResult.path.first().lat, uiState.routeResult.path.first().lng)
                        }
                    }
                    uiState.selectedBuilding != null -> {
                        GeoPoint(uiState.selectedBuilding.center.lat, uiState.selectedBuilding.center.lng)
                    }
                    uiState.userLocation != null -> {
                        GeoPoint(uiState.userLocation.coordinates.lat, uiState.userLocation.coordinates.lng)
                    }
                    else -> {
                        GeoPoint(uiState.campusData.meta.center.lat, uiState.campusData.meta.center.lng)
                    }
                }
                mapView.controller.animateTo(targetCenter)
            }

            mapView.invalidate()
        }
    )
}
