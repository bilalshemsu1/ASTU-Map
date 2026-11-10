package com.astu.map.location

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class CompassSensor(context: Context) {
    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    fun getCompassHeading(): Flow<Float> = callbackFlow {
        val rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

        if (rotationSensor != null) {
            val listener = object : SensorEventListener {
                private val rotationMatrix = FloatArray(9)
                private val orientationAngles = FloatArray(3)

                override fun onSensorChanged(event: SensorEvent) {
                    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                    SensorManager.getOrientation(rotationMatrix, orientationAngles)
                    val azimuthInRadians = orientationAngles[0]
                    val azimuthInDegrees = Math.toDegrees(azimuthInRadians.toDouble()).toFloat()
                    val normalizedDegrees = (azimuthInDegrees + 360f) % 360f
                    trySend(normalizedDegrees)
                }

                override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
            }

            sensorManager.registerListener(listener, rotationSensor, SensorManager.SENSOR_DELAY_UI)
            awaitClose { sensorManager.unregisterListener(listener) }
        } else {
            // Fallback to accelerometer + magnetometer
            val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

            val listener = object : SensorEventListener {
                private val lastAccelerometer = FloatArray(3)
                private val lastMagnetometer = FloatArray(3)
                private var lastAccelerometerSet = false
                private var lastMagnetometerSet = false
                private val r = FloatArray(9)
                private val orientation = FloatArray(3)

                override fun onSensorChanged(event: SensorEvent) {
                    if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
                        System.arraycopy(event.values, 0, lastAccelerometer, 0, event.values.size)
                        lastAccelerometerSet = true
                    } else if (event.sensor.type == Sensor.TYPE_MAGNETIC_FIELD) {
                        System.arraycopy(event.values, 0, lastMagnetometer, 0, event.values.size)
                        lastMagnetometerSet = true
                    }

                    if (lastAccelerometerSet && lastMagnetometerSet) {
                        if (SensorManager.getRotationMatrix(r, null, lastAccelerometer, lastMagnetometer)) {
                            SensorManager.getOrientation(r, orientation)
                            val azimuthInRadians = orientation[0]
                            val azimuthInDegrees = Math.toDegrees(azimuthInRadians.toDouble()).toFloat()
                            val normalizedDegrees = (azimuthInDegrees + 360f) % 360f
                            trySend(normalizedDegrees)
                        }
                    }
                }

                override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
            }

            if (accelerometer != null) {
                sensorManager.registerListener(listener, accelerometer, SensorManager.SENSOR_DELAY_UI)
            }
            if (magnetometer != null) {
                sensorManager.registerListener(listener, magnetometer, SensorManager.SENSOR_DELAY_UI)
            }

            awaitClose { sensorManager.unregisterListener(listener) }
        }
    }
}
