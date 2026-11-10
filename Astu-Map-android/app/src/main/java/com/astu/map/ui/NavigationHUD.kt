package com.astu.map.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.astu.map.model.RouteResult

@Composable
fun NavigationHUD(
    routeResult: RouteResult,
    activeStepIndex: Int,
    isSimulating: Boolean,
    isVoiceMuted: Boolean,
    onNextStep: () -> Unit,
    onPrevStep: () -> Unit,
    onToggleVoice: () -> Unit,
    onToggleSimulation: () -> Unit,
    onStopNavigation: () -> Unit,
    modifier: Modifier = Modifier
) {
    val steps = routeResult.steps
    val currentStep = steps.getOrNull(activeStepIndex) ?: return
    val nextStep = steps.getOrNull(activeStepIndex + 1)

    val maneuverIcon: ImageVector = when {
        currentStep.instruction.contains("right", ignoreCase = true) -> Icons.Default.TurnRight
        currentStep.instruction.contains("left", ignoreCase = true) -> Icons.Default.TurnLeft
        currentStep.instruction.contains("arrive", ignoreCase = true) -> Icons.Default.Place
        else -> Icons.Default.Straight
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        // Space-efficient translucent Green Navigation Card
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(6.dp, RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            color = Color(0xEE15803D) // Translucent Forest Green
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                // Top row: Step counter, voice toggle, simulation, close
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color.Black.copy(alpha = 0.25f)
                    ) {
                        Text(
                            text = "Step ${activeStepIndex + 1}/${steps.size}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Voice Mute Toggle
                        IconButton(
                            onClick = onToggleVoice,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                imageVector = if (isVoiceMuted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp,
                                contentDescription = "Voice",
                                tint = Color.White,
                                modifier = Modifier.size(17.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        // Simulation toggle
                        OutlinedButton(
                            onClick = onToggleSimulation,
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(Color.White.copy(alpha = 0.5f))
                            ),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier.height(26.dp)
                        ) {
                            Icon(
                                imageVector = if (isSimulating) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = null,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(if (isSimulating) "Pause" else "Sim", fontSize = 11.sp)
                        }

                        Spacer(modifier = Modifier.width(6.dp))

                        // Stop Navigation Button
                        IconButton(
                            onClick = onStopNavigation,
                            modifier = Modifier
                                .size(26.dp)
                                .background(Color.Black.copy(alpha = 0.3f), CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Exit",
                                tint = Color.White,
                                modifier = Modifier.size(15.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Maneuver icon + Distance & Instruction
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .background(Color.White.copy(alpha = 0.2f), RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = maneuverIcon,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(10.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${currentStep.distanceMeters} m",
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White
                        )
                        Text(
                            text = currentStep.instruction,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White.copy(alpha = 0.95f),
                            lineHeight = 16.sp
                        )
                    }

                    // Compact step switcher
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = onPrevStep,
                            enabled = activeStepIndex > 0,
                            modifier = Modifier
                                .background(Color.White.copy(alpha = if (activeStepIndex > 0) 0.2f else 0.05f), CircleShape)
                                .size(30.dp)
                        ) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Prev", tint = Color.White, modifier = Modifier.size(18.dp))
                        }

                        Spacer(modifier = Modifier.width(4.dp))

                        IconButton(
                            onClick = onNextStep,
                            enabled = activeStepIndex < steps.size - 1,
                            modifier = Modifier
                                .background(Color.White.copy(alpha = if (activeStepIndex < steps.size - 1) 0.2f else 0.05f), CircleShape)
                                .size(30.dp)
                        ) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Next", tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                }

                // Next Step Preview if available
                if (nextStep != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Color.Black.copy(alpha = 0.2f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Then: ",
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White.copy(alpha = 0.7f)
                            )
                            Text(
                                text = nextStep.instruction,
                                fontSize = 11.sp,
                                color = Color.White,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }
    }
}
