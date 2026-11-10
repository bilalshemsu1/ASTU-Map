package com.astu.map.domain

import com.astu.map.model.Building
import com.astu.map.model.FacilitySchedule
import com.astu.map.model.OperatingHoursStatus
import com.astu.map.model.OperatingStatus
import java.time.LocalTime
import java.time.format.DateTimeFormatter

object OperatingHoursEngine {

    private fun parseTimeToMinutes(timeStr: String?): Int? {
        if (timeStr.isNullOrBlank()) return null
        val match = Regex("^(\\d{1,2}):(\\d{2})").find(timeStr.trim()) ?: return null
        val hours = match.groupValues[1].toIntOrNull() ?: return null
        val minutes = match.groupValues[2].toIntOrNull() ?: return null
        return hours * 60 + minutes
    }

    fun formatTime12h(timeStr: String?): String {
        val mins = parseTimeToMinutes(timeStr) ?: return timeStr ?: ""
        val h = mins / 60
        val m = mins % 60
        val period = if (h >= 12) "PM" else "AM"
        val displayH = if (h % 12 == 0) 12 else h % 12
        val displayM = if (m < 10) "0$m" else "$m"
        return "$displayH:$displayM $period"
    }

    fun getFacilityOperatingStatus(
        building: Building,
        nowTime: LocalTime = LocalTime.now()
    ): OperatingHoursStatus {
        val schedule = building.details?.operatingHours
        val rawHours = building.details?.hours

        if (schedule == null) {
            return OperatingHoursStatus(
                status = OperatingStatus.OPEN,
                badgeLabel = "Hours Unspecified",
                badgeDetail = rawHours ?: "Inquire on site",
                statusDetail = rawHours ?: "General campus access",
                scheduleSummary = rawHours ?: "Schedule not published"
            )
        }

        if (schedule.is24x7) {
            return OperatingHoursStatus(
                status = OperatingStatus.OPEN_24_7,
                badgeLabel = "Open 24/7",
                badgeDetail = "Always accessible",
                statusDetail = "Open 24 hours daily",
                scheduleSummary = "Open 24 hours (including weekends)"
            )
        }

        val nowMinutes = nowTime.hour * 60 + nowTime.minute
        val openMinutes = parseTimeToMinutes(schedule.open)
        val closeMinutes = parseTimeToMinutes(schedule.close)
        val lunchStart = parseTimeToMinutes(schedule.lunchStart)
        val lunchEnd = parseTimeToMinutes(schedule.lunchEnd)

        val openFormatted = formatTime12h(schedule.open)
        val closeFormatted = formatTime12h(schedule.close)
        val scheduleSummary = "${schedule.days ?: "Mon - Fri"}: $openFormatted - $closeFormatted"

        // Check Lunch Break
        if (lunchStart != null && lunchEnd != null && nowMinutes in lunchStart until lunchEnd) {
            val lunchEndFormatted = formatTime12h(schedule.lunchEnd)
            return OperatingHoursStatus(
                status = OperatingStatus.LUNCH_BREAK,
                badgeLabel = "Lunch Break",
                badgeDetail = "Reopens at $lunchEndFormatted",
                statusDetail = "Closed for lunch ($lunchStart - $lunchEnd). Reopens at $lunchEndFormatted",
                scheduleSummary = scheduleSummary
            )
        }

        if (openMinutes != null && closeMinutes != null) {
            if (nowMinutes in openMinutes until closeMinutes) {
                // Closing soon check (within 45 minutes)
                if (closeMinutes - nowMinutes in 1..45) {
                    val remaining = closeMinutes - nowMinutes
                    return OperatingHoursStatus(
                        status = OperatingStatus.CLOSING_SOON,
                        badgeLabel = "Closing Soon",
                        badgeDetail = "Closes in ${remaining}m",
                        statusDetail = "Closes at $closeFormatted (${remaining}m remaining)",
                        scheduleSummary = scheduleSummary
                    )
                }

                return OperatingHoursStatus(
                    status = OperatingStatus.OPEN,
                    badgeLabel = "Open Now",
                    badgeDetail = "Closes at $closeFormatted",
                    statusDetail = "Open today until $closeFormatted",
                    scheduleSummary = scheduleSummary
                )
            } else {
                return OperatingHoursStatus(
                    status = OperatingStatus.CLOSED,
                    badgeLabel = "Closed",
                    badgeDetail = if (openMinutes > nowMinutes) "Opens at $openFormatted" else "Opens tomorrow",
                    statusDetail = "Closed now. Standard hours: $scheduleSummary",
                    scheduleSummary = scheduleSummary
                )
            }
        }

        return OperatingHoursStatus(
            status = OperatingStatus.OPEN,
            badgeLabel = "Open",
            badgeDetail = rawHours ?: "Regular hours",
            statusDetail = rawHours ?: "Regular hours",
            scheduleSummary = scheduleSummary
        )
    }
}
