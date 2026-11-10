package com.astu.map.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import com.astu.map.model.LatLng
import com.google.android.gms.location.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

data class UserLocationState(
    val coordinates: LatLng,
    val accuracyMeters: Float,
    val bearing: Float? = null,
    val speedMps: Float? = null,
    val provider: String? = null
)

class LocationTracker(private val context: Context) {
    private val fusedClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    private val locationManager: LocationManager =
        context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    @SuppressLint("MissingPermission")
    fun getLocationUpdates(): Flow<UserLocationState> = callbackFlow {
        var currentBestLocation: Location? = null

        fun isBetterLocation(location: Location, currentBest: Location?): Boolean {
            if (currentBest == null) return true

            val timeDelta = location.time - currentBest.time
            val isSignificantlyNewer = timeDelta > 30000 // 30 seconds
            val isSignificantlyOlder = timeDelta < -30000
            val isNewer = timeDelta > 0

            if (isSignificantlyNewer) return true
            if (isSignificantlyOlder) return false

            val accuracyDelta = (location.accuracy - currentBest.accuracy).toInt()
            val isMoreAccurate = accuracyDelta < 0
            val isLessAccurate = accuracyDelta > 0
            val isSignificantlyLessAccurate = accuracyDelta > 30

            // If new location fix is very coarse (> 50m, likely cell-tower) and we already have a decent fix, reject it
            if (location.accuracy > 50f && currentBest.accuracy <= 30f) {
                return false
            }

            val isFromSameProvider = location.provider == currentBest.provider

            return when {
                isMoreAccurate -> true
                isNewer && !isLessAccurate -> true
                isNewer && !isSignificantlyLessAccurate && isFromSameProvider -> true
                location.provider == LocationManager.GPS_PROVIDER && location.accuracy <= 25f -> true
                else -> false
            }
        }

        fun handleLocation(loc: Location) {
            if (isBetterLocation(loc, currentBestLocation)) {
                currentBestLocation = loc
                trySend(
                    UserLocationState(
                        coordinates = LatLng(loc.latitude, loc.longitude),
                        accuracyMeters = loc.accuracy,
                        bearing = if (loc.hasBearing()) loc.bearing else null,
                        speedMps = if (loc.hasSpeed()) loc.speed else null,
                        provider = loc.provider
                    )
                )
            }
        }

        // 1. Direct Hardware GPS Satellite Listener
        val gpsListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                handleLocation(location)
            }
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }

        // 2. High-Accuracy Fused Location Request with Fine Granularity
        val fusedRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
            .setMinUpdateIntervalMillis(500L)
            .setMinUpdateDistanceMeters(0f)
            .setGranularity(Granularity.GRANULARITY_FINE)
            .setWaitForAccurateLocation(true)
            .build()

        val fusedCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { loc ->
                    handleLocation(loc)
                }
            }
        }

        try {
            // Direct GPS provider (satellite hardware)
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    0f,
                    gpsListener,
                    Looper.getMainLooper()
                )
            }

            // Fused Location Provider
            fusedClient.requestLocationUpdates(fusedRequest, fusedCallback, Looper.getMainLooper())

            // Immediate high-accuracy current location fix
            fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc ->
                    if (loc != null) handleLocation(loc)
                }
        } catch (e: SecurityException) {
            close(e)
        }

        awaitClose {
            try {
                locationManager.removeUpdates(gpsListener)
                fusedClient.removeLocationUpdates(fusedCallback)
            } catch (e: Exception) {
                // Ignore cleanup error
            }
        }
    }
}
