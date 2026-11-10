package com.astu.map.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.astu.map.domain.OperatingHoursEngine
import com.astu.map.model.Building
import com.astu.map.model.OperatingStatus
import com.astu.map.model.Room

@Composable
fun PlaceDetailBottomSheet(
    building: Building,
    onClose: () -> Unit,
    onDirectionsClick: (Building, Room?) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val opStatus = remember(building) {
        OperatingHoursEngine.getFacilityOperatingStatus(building)
    }

    var selectedFloor by remember { mutableStateOf<Int?>(null) }
    var roomSearchQuery by remember { mutableStateOf("") }

    val distinctFloors = remember(building) {
        building.rooms.map { it.floor }.distinct().sorted()
    }

    val filteredRooms = remember(building, selectedFloor, roomSearchQuery) {
        building.rooms.filter { room ->
            val matchFloor = selectedFloor == null || room.floor == selectedFloor
            val matchQuery = roomSearchQuery.isBlank() ||
                    room.name.contains(roomSearchQuery, ignoreCase = true) ||
                    room.workDescription?.contains(roomSearchQuery, ignoreCase = true) == true ||
                    room.equipment.any { it.contains(roomSearchQuery, ignoreCase = true) }
            matchFloor && matchQuery
        }
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight(0.87f),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        color = Color.White.copy(alpha = 0.94f), // Translucent glass sheet
        tonalElevation = 4.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            // Drag handle & close button
            Box(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .size(36.dp, 3.5.dp)
                        .background(Color.LightGray, RoundedCornerShape(2.dp))
                        .align(Alignment.Center)
                )
                IconButton(
                    onClick = onClose,
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .size(24.dp)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.Gray, modifier = Modifier.size(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Building Header & Code
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = building.name,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF202124)
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(top = 2.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0xFFE8F0FE)
                        ) {
                            Text(
                                text = "Block ${building.code}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1A73E8),
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = building.category.replaceFirstChar { it.uppercase() },
                            fontSize = 11.5.sp,
                            color = Color(0xFF5F6368)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Live Operating Status Badge
            val statusColor = when (opStatus.status) {
                OperatingStatus.OPEN, OperatingStatus.OPEN_24_7 -> Color(0xFF059669)
                OperatingStatus.CLOSING_SOON, OperatingStatus.LUNCH_BREAK -> Color(0xFFD97706)
                OperatingStatus.CLOSED -> Color(0xFFDC2626)
            }

            Surface(
                shape = RoundedCornerShape(6.dp),
                color = statusColor.copy(alpha = 0.12f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .background(statusColor, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = opStatus.badgeLabel,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.5.sp,
                        color = statusColor
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "• ${opStatus.badgeDetail}",
                        fontSize = 11.sp,
                        color = Color(0xFF5F6368)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Quick Actions Row (Compact)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                ActionCircleButton(
                    icon = Icons.Default.Directions,
                    label = "Directions",
                    isPrimary = true,
                    onClick = { onDirectionsClick(building, null) }
                )

                building.details?.phone?.let { phone ->
                    ActionCircleButton(
                        icon = Icons.Default.Phone,
                        label = "Call",
                        onClick = {
                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
                            context.startActivity(intent)
                        }
                    )
                }

                building.details?.email?.let { email ->
                    ActionCircleButton(
                        icon = Icons.Default.Email,
                        label = "Email",
                        onClick = {
                            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$email"))
                            context.startActivity(intent)
                        }
                    )
                }

                building.details?.website?.let { web ->
                    ActionCircleButton(
                        icon = Icons.Default.Language,
                        label = "Web",
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(web))
                            context.startActivity(intent)
                        }
                    )
                }

                ActionCircleButton(
                    icon = Icons.Default.Share,
                    label = "Share",
                    onClick = {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "ASTU: ${building.name} (Block ${building.code})"
                            )
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Location"))
                    }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Color.LightGray.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(6.dp))

            // Scrollable Content: Description & Room Directory
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                // Description
                building.details?.description?.let { desc ->
                    item {
                        Text(
                            text = desc,
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            color = Color(0xFF5F6368)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                // Room Directory Section
                if (building.rooms.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Rooms (${building.rooms.size})",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        // Floor Filter Tabs
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            FilterChip(
                                selected = selectedFloor == null,
                                onClick = { selectedFloor = null },
                                label = { Text("All", fontSize = 11.sp) },
                                modifier = Modifier.height(28.dp)
                            )
                            distinctFloors.forEach { floor ->
                                FilterChip(
                                    selected = selectedFloor == floor,
                                    onClick = { selectedFloor = floor },
                                    label = { Text(if (floor == 0) "G" else "F$floor", fontSize = 11.sp) },
                                    modifier = Modifier.height(28.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        // Room search filter field
                        OutlinedTextField(
                            value = roomSearchQuery,
                            onValueChange = { roomSearchQuery = it },
                            placeholder = { Text("Filter room or lab…", fontSize = 11.5.sp) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            singleLine = true,
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(15.dp)) }
                        )

                        Spacer(modifier = Modifier.height(6.dp))
                    }

                    items(filteredRooms) { room ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFF8F9FA)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = room.name,
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 12.5.sp
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Surface(
                                            shape = RoundedCornerShape(3.dp),
                                            color = Color(0xFFE8F0FE)
                                        ) {
                                            Text(
                                                text = if (room.floor == 0) "Ground" else "Floor ${room.floor}",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF1A73E8),
                                                modifier = Modifier.padding(horizontal = 3.dp, vertical = 1.dp)
                                            )
                                        }
                                    }

                                    room.workDescription?.let { desc ->
                                        Text(
                                            text = desc,
                                            fontSize = 11.sp,
                                            color = Color(0xFF5F6368)
                                        )
                                    }
                                }

                                IconButton(
                                    onClick = { onDirectionsClick(building, room) },
                                    modifier = Modifier.size(26.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Navigation,
                                        contentDescription = "Navigate",
                                        tint = Color(0xFF1A73E8),
                                        modifier = Modifier.size(15.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ActionCircleButton(
    icon: ImageVector,
    label: String,
    isPrimary: Boolean = false,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(
                    if (isPrimary) Color(0xFF1A73E8) else Color(0xFFF1F3F4),
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (isPrimary) Color.White else Color(0xFF3C4043),
                modifier = Modifier.size(17.dp)
            )
        }
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = label,
            fontSize = 9.5.sp,
            fontWeight = if (isPrimary) FontWeight.Bold else FontWeight.Normal,
            color = if (isPrimary) Color(0xFF1A73E8) else Color(0xFF3C4043)
        )
    }
}
