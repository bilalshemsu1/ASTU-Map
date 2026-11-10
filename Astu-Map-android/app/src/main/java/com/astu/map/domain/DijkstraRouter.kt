package com.astu.map.domain

import com.astu.map.model.*
import java.util.PriorityQueue
import kotlin.math.*

object DijkstraRouter {

    private const val EARTH_RADIUS_METERS = 6371000.0

    fun calculateHaversineDistance(p1: LatLng, p2: LatLng): Double {
        val dLat = Math.toRadians(p2.lat - p1.lat)
        val dLng = Math.toRadians(p2.lng - p1.lng)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(p1.lat)) * cos(Math.toRadians(p2.lat)) * sin(dLng / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return EARTH_RADIUS_METERS * c
    }

    fun calculateBearing(p1: LatLng, p2: LatLng): Double {
        val startLat = Math.toRadians(p1.lat)
        val startLng = Math.toRadians(p1.lng)
        val destLat = Math.toRadians(p2.lat)
        val destLng = Math.toRadians(p2.lng)

        val y = sin(destLng - startLng) * cos(destLat)
        val x = cos(startLat) * sin(destLat) - sin(startLat) * cos(destLat) * cos(destLng - startLng)
        val brng = Math.toDegrees(atan2(y, x))
        return (brng + 360.0) % 360.0
    }

    fun isGenericLabel(label: String?): Boolean {
        if (label == null || label.trim().isEmpty()) return true
        val regex = Regex("^(Road Point|Node|Waypoint|Path Point|Campus Road|Path)", RegexOption.IGNORE_CASE)
        return regex.containsMatchIn(label.trim())
    }

    private fun getTurnDirection(diff: Double): String {
        return when {
            diff > 45 && diff < 135 -> "Turn right"
            diff >= 135 -> "Make a sharp turn right"
            diff < -45 && diff > -135 -> "Turn left"
            diff <= -135 -> "Make a sharp turn left"
            else -> "Continue straight"
        }
    }

    private data class StepGroup(
        val fromNode: PathNode,
        var toNode: PathNode,
        var distanceMeters: Int,
        val direction: String,
        val isFirst: Boolean,
        val isFinal: Boolean,
        var lastBearing: Double
    )

    fun generateRouteSteps(path: List<PathNode>): List<RouteStep> {
        if (path.size < 2) return emptyList()

        if (path.size == 2) {
            val from = path[0]
            val to = path[1]
            val stepDist = calculateHaversineDistance(LatLng(from.lat, from.lng), LatLng(to.lat, to.lng)).roundToInt()
            val instruction = if (!isGenericLabel(to.label)) "Arrive at ${to.label}" else "Arrive at destination"
            return listOf(RouteStep(instruction, stepDist, from, to))
        }

        data class RawSegment(
            val from: PathNode,
            val to: PathNode,
            val dist: Double,
            val bearing: Double,
            val diff: Double,
            val direction: String
        )

        val rawSegments = mutableListOf<RawSegment>()
        for (i in 0 until path.size - 1) {
            val from = path[i]
            val to = path[i + 1]
            val dist = calculateHaversineDistance(LatLng(from.lat, from.lng), LatLng(to.lat, to.lng))
            val bearing = calculateBearing(LatLng(from.lat, from.lng), LatLng(to.lat, to.lng))
            var diff = 0.0
            var direction = "Continue straight"

            if (i > 0) {
                val prev = path[i - 1]
                val prevBearing = calculateBearing(LatLng(prev.lat, prev.lng), LatLng(from.lat, from.lng))
                diff = ((bearing - prevBearing + 540.0) % 360.0) - 180.0
                direction = getTurnDirection(diff)
            }

            rawSegments.add(RawSegment(from, to, dist, bearing, diff, direction))
        }

        // Consolidate consecutive straight segments along roughly the same bearing (< 22 degrees)
        val consolidated = mutableListOf<StepGroup>()
        for (i in rawSegments.indices) {
            val seg = rawSegments[i]
            val isFirst = i == 0
            val isFinal = i == rawSegments.size - 1

            if (consolidated.isEmpty()) {
                consolidated.add(
                    StepGroup(
                        fromNode = seg.from,
                        toNode = seg.to,
                        distanceMeters = seg.dist.roundToInt(),
                        direction = if (isFirst) "Head" else seg.direction,
                        isFirst = isFirst,
                        isFinal = isFinal,
                        lastBearing = seg.bearing
                    )
                )
            } else {
                val lastGroup = consolidated.last()
                val bearingChange = abs(((seg.bearing - lastGroup.lastBearing + 540.0) % 360.0) - 180.0)
                val isSmoothStraight = seg.direction == "Continue straight" && bearingChange < 22.0
                val passingLandmark = !isGenericLabel(seg.to.label) && isFinal

                if (isSmoothStraight && !passingLandmark && !lastGroup.isFinal) {
                    lastGroup.toNode = seg.to
                    lastGroup.distanceMeters += seg.dist.roundToInt()
                    lastGroup.lastBearing = seg.bearing
                } else {
                    consolidated.add(
                        StepGroup(
                            fromNode = seg.from,
                            toNode = seg.to,
                            distanceMeters = seg.dist.roundToInt(),
                            direction = seg.direction,
                            isFirst = isFirst,
                            isFinal = isFinal,
                            lastBearing = seg.bearing
                        )
                    )
                }
            }
        }

        return consolidated.map { group ->
            val to = group.toNode
            val dist = group.distanceMeters
            val isLandmark = !isGenericLabel(to.label)

            val instruction = when {
                group.isFinal -> {
                    if (isLandmark) "Arrive at ${to.label}" else "Arrive at destination"
                }
                group.isFirst -> {
                    if (isLandmark) "Head towards ${to.label} for ${dist}m" else "Walk straight for ${dist}m"
                }
                group.direction.startsWith("Turn") || group.direction.startsWith("Make") -> {
                    if (isLandmark) "${group.direction} towards ${to.label}" else "${group.direction} and walk ${dist}m"
                }
                else -> {
                    if (isLandmark) "Continue straight towards ${to.label}" else "Continue straight for ${dist}m"
                }
            }

            RouteStep(instruction, dist, group.fromNode, group.toNode)
        }
    }

    private data class EdgeNeighbor(val targetId: String, val weight: Double, val edgeId: String)
    private data class NodeDist(val id: String, val dist: Double) : Comparable<NodeDist> {
        override fun compareTo(other: NodeDist) = dist.compareTo(other.dist)
    }

    fun findShortestPath(
        startNodeId: String,
        targetNodeId: String,
        campusData: CampusData,
        wheelchairAccessible: Boolean = false,
        bannedEdgePairs: Set<String> = emptySet()
    ): RouteResult? {
        val nodeMap = campusData.nodes.associateBy { it.id }
        if (startNodeId !in nodeMap || targetNodeId !in nodeMap) return null

        val adj = mutableMapOf<String, MutableList<EdgeNeighbor>>()
        campusData.nodes.forEach { adj[it.id] = mutableListOf() }

        campusData.edges.forEach { edge ->
            if (wheelchairAccessible && (edge.type == "stairs" || !edge.handicapAccessible)) {
                return@forEach
            }

            val pair1 = "${edge.source}-${edge.target}"
            val pair2 = "${edge.target}-${edge.source}"
            if (pair1 in bannedEdgePairs || pair2 in bannedEdgePairs) {
                return@forEach
            }

            val n1 = nodeMap[edge.source] ?: return@forEach
            val n2 = nodeMap[edge.target] ?: return@forEach

            var baseDist = calculateHaversineDistance(LatLng(n1.lat, n1.lng), LatLng(n2.lat, n2.lng))
            if (edge.type == "stairs") baseDist *= 2.5
            else if (edge.type == "dirt_path") baseDist *= 1.2
            val weight = edge.weight ?: baseDist

            adj[edge.source]?.add(EdgeNeighbor(edge.target, weight, edge.id))
            if (!edge.isOneWay) {
                adj[edge.target]?.add(EdgeNeighbor(edge.source, weight, edge.id))
            }
        }

        val distances = mutableMapOf<String, Double>().withDefault { Double.POSITIVE_INFINITY }
        val previous = mutableMapOf<String, String?>()
        val pq = PriorityQueue<NodeDist>()

        distances[startNodeId] = 0.0
        pq.add(NodeDist(startNodeId, 0.0))

        while (pq.isNotEmpty()) {
            val (currentId, currentDist) = pq.poll() ?: break
            if (currentId == targetNodeId) break
            if (currentDist > distances.getValue(currentId)) continue

            adj[currentId]?.forEach { (neighborId, weight) ->
                val newDist = currentDist + weight
                if (newDist < distances.getValue(neighborId)) {
                    distances[neighborId] = newDist
                    previous[neighborId] = currentId
                    pq.add(NodeDist(neighborId, newDist))
                }
            }
        }

        if (distances.getValue(targetNodeId) == Double.POSITIVE_INFINITY) return null

        val path = mutableListOf<PathNode>()
        var curr: String? = targetNodeId
        while (curr != null) {
            nodeMap[curr]?.let { path.add(0, it) }
            curr = previous[curr]
        }

        val totalDist = distances.getValue(targetNodeId).roundToInt()
        val estimatedTimeMinutes = max(1, ceil(totalDist / 80.0).toInt())
        val steps = generateRouteSteps(path)

        return RouteResult(
            path = path,
            totalDistanceMeters = totalDist,
            estimatedTimeMinutes = estimatedTimeMinutes,
            steps = steps
        )
    }

    fun fetchWalkingRoute(
        start: LatLng,
        target: LatLng,
        startNodeId: String?,
        targetNodeId: String?,
        campusData: CampusData,
        wheelchairAccessible: Boolean = false
    ): RouteResult? {
        if (campusData.nodes.isEmpty()) return null

        fun findClosestNode(coord: LatLng, roadOnly: Boolean = false): PathNode {
            var closest = campusData.nodes[0]
            var minDist = Double.MAX_VALUE
            campusData.nodes.forEach { n ->
                if (roadOnly && !n.id.startsWith("r_")) return@forEach
                val d = calculateHaversineDistance(coord, LatLng(n.lat, n.lng))
                if (d < minDist) {
                    minDist = d
                    closest = n
                }
            }
            return closest
        }

        var actualStartNode = (startNodeId?.let { id -> campusData.nodes.find { it.id == id } })
            ?: findClosestNode(start, roadOnly = true)

        var actualTargetNode = (targetNodeId?.let { id -> campusData.nodes.find { it.id == id } })
            ?: findClosestNode(target, roadOnly = false)

        var localResult = findShortestPath(actualStartNode.id, actualTargetNode.id, campusData, wheelchairAccessible)

        if (localResult == null || localResult.path.isEmpty()) {
            actualStartNode = findClosestNode(start, roadOnly = true)
            actualTargetNode = findClosestNode(target, roadOnly = true)
            localResult = findShortestPath(actualStartNode.id, actualTargetNode.id, campusData, wheelchairAccessible)
        }

        if (localResult == null || localResult.path.isEmpty()) return null

        val mutablePath = localResult.path.toMutableList()
        val mutableSteps = localResult.steps.toMutableList()
        var totalDist = localResult.totalDistanceMeters

        val firstNode = mutablePath.first()
        val distToFirst = calculateHaversineDistance(start, LatLng(firstNode.lat, firstNode.lng))
        if (distToFirst > 6.0) {
            val userStartNode = PathNode("user_start", start.lat, start.lng, "Start Position")
            mutablePath.add(0, userStartNode)
            totalDist += distToFirst.roundToInt()
            val roadLabel = if (!isGenericLabel(firstNode.label)) firstNode.label!! else "campus walkway"
            mutableSteps.add(
                0,
                RouteStep(
                    "Walk ${distToFirst.roundToInt()}m to join campus path ($roadLabel)",
                    distToFirst.roundToInt(),
                    userStartNode,
                    firstNode
                )
            )
        }

        val lastNode = mutablePath.last()
        val distToLast = calculateHaversineDistance(target, LatLng(lastNode.lat, lastNode.lng))
        if (distToLast > 6.0) {
            val targetBuilding = campusData.buildings.find {
                it.entranceNodeId == targetNodeId || it.id == targetNodeId
            }
            val destLabel = targetBuilding?.name ?: if (!isGenericLabel(lastNode.label)) lastNode.label!! else "destination"
            val userTargetNode = PathNode("user_target", target.lat, target.lng, destLabel)
            mutablePath.add(userTargetNode)
            totalDist += distToLast.roundToInt()
            mutableSteps.add(
                RouteStep(
                    "Arrive at $destLabel",
                    distToLast.roundToInt(),
                    lastNode,
                    userTargetNode
                )
            )
        }

        val alternatives = mutableListOf<List<PathNode>>()
        val banned = mutableSetOf<String>()
        for (pass in 0 until 2) {
            val pathToBan = if (pass == 0) localResult.path else alternatives.lastOrNull() ?: break
            for (i in 0 until pathToBan.size - 1) {
                banned.add("${pathToBan[i].id}-${pathToBan[i + 1].id}")
                banned.add("${pathToBan[i + 1].id}-${pathToBan[i].id}")
            }
            val alt = findShortestPath(actualStartNode.id, actualTargetNode.id, campusData, wheelchairAccessible, banned)
            if (alt != null && alt.path.isNotEmpty()) {
                alternatives.add(alt.path)
            }
        }

        val estimatedMinutes = max(1, ceil(totalDist / 80.0).toInt())

        return RouteResult(
            path = mutablePath,
            totalDistanceMeters = totalDist,
            estimatedTimeMinutes = estimatedMinutes,
            steps = mutableSteps,
            alternativePaths = alternatives
        )
    }
}
