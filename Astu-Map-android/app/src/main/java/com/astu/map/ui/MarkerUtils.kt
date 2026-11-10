package com.astu.map.ui

import android.content.Context
import android.graphics.*
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable

object MarkerUtils {

    /**
     * Creates a custom "Man standing" avatar icon for user's live location.
     * Replaces any ugly default indicator hands.
     */
    fun createManStandingMarker(context: Context, heading: Float? = null): Drawable {
        val size = 110 // pixel diameter
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val cx = size / 2f
        val cy = size / 2f

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // 1. Heading cone / arrow if available
        if (heading != null) {
            canvas.save()
            canvas.rotate(heading, cx, cy)
            val conePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(90, 37, 99, 235) // Soft blue cone
                style = Paint.Style.FILL
            }
            val conePath = Path().apply {
                moveTo(cx, cy)
                lineTo(cx - 28f, 6f)
                lineTo(cx + 28f, 6f)
                close()
            }
            canvas.drawPath(conePath, conePaint)
            canvas.restore()
        }

        // 2. Outer pulsing translucent halo
        paint.color = Color.argb(60, 37, 99, 235)
        paint.style = Paint.Style.FILL
        canvas.drawCircle(cx, cy, 38f, paint)

        // 3. Inner solid white circle with blue border
        paint.color = Color.WHITE
        canvas.drawCircle(cx, cy, 26f, paint)

        paint.color = Color.rgb(26, 115, 232) // Google Blue
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 4f
        canvas.drawCircle(cx, cy, 26f, paint)

        // 4. Draw standing man silhouette in the center
        paint.style = Paint.Style.FILL
        paint.color = Color.rgb(26, 115, 232)

        // Head
        canvas.drawCircle(cx, cy - 12f, 5.5f, paint)

        // Body / Torso
        val torsoPath = Path().apply {
            moveTo(cx - 6f, cy - 5f)
            lineTo(cx + 6f, cy - 5f)
            lineTo(cx + 5f, cy + 8f)
            lineTo(cx - 5f, cy + 8f)
            close()
        }
        canvas.drawPath(torsoPath, paint)

        // Legs (standing upright)
        paint.strokeWidth = 3f
        paint.style = Paint.Style.STROKE
        paint.strokeCap = Paint.Cap.ROUND
        canvas.drawLine(cx - 3f, cy + 8f, cx - 3f, cy + 18f, paint)
        canvas.drawLine(cx + 3f, cy + 8f, cx + 3f, cy + 18f, paint)

        // Arms (resting by side)
        canvas.drawLine(cx - 7f, cy - 3f, cx - 8f, cy + 6f, paint)
        canvas.drawLine(cx + 7f, cy - 3f, cx + 8f, cy + 6f, paint)

        return BitmapDrawable(context.resources, bitmap)
    }

    /**
     * Creates a HUGE, vibrant YELLOW target destination pin without any hand indicator.
     */
    fun createHugeTargetMarker(context: Context): Drawable {
        val width = 120
        val height = 150
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val cx = width / 2f
        val cy = 52f
        val radius = 42f

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // 1. Drop shadow under the pin tip
        val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(100, 0, 0, 0)
            style = Paint.Style.FILL
        }
        canvas.drawOval(RectF(cx - 18f, height - 16f, cx + 18f, height - 2f), shadowPaint)

        // 2. Draw Yellow Location Pin Body
        val pinPath = Path().apply {
            moveTo(cx, height - 12f) // Bottom sharp point
            cubicTo(
                cx - 14f, height - 45f,
                cx - radius, cy + 28f,
                cx - radius, cy
            )
            arcTo(
                RectF(cx - radius, cy - radius, cx + radius, cy + radius),
                180f,
                180f,
                false
            )
            cubicTo(
                cx + radius, cy + 28f,
                cx + 14f, height - 45f,
                cx, height - 12f
            )
            close()
        }

        // Fill with bright, rich yellow (#FACC15 / #EAB308)
        paint.color = Color.rgb(250, 204, 21)
        paint.style = Paint.Style.FILL
        canvas.drawPath(pinPath, paint)

        // Pin dark border for crisp contrast on satellite basemaps
        paint.color = Color.rgb(180, 83, 9) // Amber-dark outline
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 5f
        canvas.drawPath(pinPath, paint)

        // 3. Inner White & Dark Center Circle
        paint.style = Paint.Style.FILL
        paint.color = Color.WHITE
        canvas.drawCircle(cx, cy, 18f, paint)

        paint.color = Color.rgb(17, 24, 39) // Dark navy center dot
        canvas.drawCircle(cx, cy, 9f, paint)

        return BitmapDrawable(context.resources, bitmap)
    }

    /**
     * Creates a clean modern circular badge for buildings showing their code (e.g. "B7", "B11").
     * Completely removes the default OSMDroid pointing hand.
     */
    fun createBuildingBadgeMarker(
        context: Context,
        code: String,
        category: String,
        isSelected: Boolean
    ): Drawable {
        val width = 80
        val height = 48
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        val bgColor = if (isSelected) {
            Color.rgb(239, 68, 68) // Bright red when selected
        } else {
            when (category) {
                "library" -> Color.rgb(37, 99, 235)
                "dining" -> Color.rgb(217, 119, 6)
                "administrative" -> Color.rgb(79, 70, 229)
                "academic" -> Color.rgb(16, 185, 129)
                "dormitory" -> Color.rgb(147, 51, 234)
                "sports" -> Color.rgb(234, 88, 12)
                else -> Color.rgb(75, 85, 99)
            }
        }

        // Draw pill background with white outline
        val rect = RectF(4f, 4f, width - 4f, height - 4f)
        paint.color = bgColor
        paint.style = Paint.Style.FILL
        canvas.drawRoundRect(rect, 20f, 20f, paint)

        paint.color = Color.WHITE
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3f
        canvas.drawRoundRect(rect, 20f, 20f, paint)

        // Draw text code in the center
        paint.style = Paint.Style.FILL
        paint.color = Color.WHITE
        paint.textSize = 20f
        paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        paint.textAlign = Paint.Align.CENTER

        val textY = (height / 2f) - ((paint.descent() + paint.ascent()) / 2f)
        val displayCode = if (code.length > 5) code.take(4) + "…" else code
        canvas.drawText(displayCode, width / 2f, textY, paint)

        return BitmapDrawable(context.resources, bitmap)
    }
}
