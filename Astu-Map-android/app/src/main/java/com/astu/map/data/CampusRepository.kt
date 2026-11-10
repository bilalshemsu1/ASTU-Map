package com.astu.map.data

import android.content.Context
import com.astu.map.model.CampusData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

class CampusRepository(private val context: Context) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private var cachedCampusData: CampusData? = null

    suspend fun getCampusData(): CampusData = withContext(Dispatchers.IO) {
        cachedCampusData?.let { return@withContext it }

        try {
            context.assets.open("campus.json").use { inputStream ->
                val jsonString = inputStream.bufferedReader().use { it.readText() }
                val parsed = json.decodeFromString<CampusData>(jsonString)
                cachedCampusData = parsed
                parsed
            }
        } catch (e: Exception) {
            e.printStackTrace()
            CampusData()
        }
    }

    fun updateCampusData(newData: CampusData) {
        cachedCampusData = newData
    }
}
