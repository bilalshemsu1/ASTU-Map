package com.astu.map.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.astu.map.model.Building
import com.astu.map.model.MapTileType
import com.astu.map.model.SearchResult

data class CategoryChipData(
    val id: String,
    val label: String,
    val icon: ImageVector,
    val color: Color
)

val CAMPUS_CATEGORIES = listOf(
    CategoryChipData("dining", "Cafes", Icons.Default.Restaurant, Color(0xFFD97706)),
    CategoryChipData("library", "Libraries", Icons.AutoMirrored.Filled.MenuBook, Color(0xFF2563EB)),
    CategoryChipData("administrative", "Admin", Icons.Default.AccountBalance, Color(0xFF4F46E5)),
    CategoryChipData("academic", "Faculties", Icons.Default.School, Color(0xFF059669)),
    CategoryChipData("dormitory", "Dorms", Icons.Default.MeetingRoom, Color(0xFF9333EA)),
    CategoryChipData("sports", "Sports", Icons.Default.FitnessCenter, Color(0xFFEA580C))
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopSearchBar(
    query: String,
    onQueryChanged: (String) -> Unit,
    searchResults: List<SearchResult>,
    onSelectBuilding: (Building) -> Unit,
    selectedCategory: String?,
    onCategorySelected: (String) -> Unit,
    mapTileType: MapTileType,
    onToggleMapTileType: () -> Unit,
    onOpenAiGuide: () -> Unit,
    onRecenterGps: () -> Unit,
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        // Space-efficient translucent Search Bar
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(4.dp, RoundedCornerShape(22.dp)),
            shape = RoundedCornerShape(22.dp),
            color = Color.White.copy(alpha = 0.90f) // Translucent glass surface
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search",
                    tint = Color(0xFF5F6368),
                    modifier = Modifier
                        .padding(start = 4.dp, end = 4.dp)
                        .size(18.dp)
                )

                TextField(
                    value = query,
                    onValueChange = onQueryChanged,
                    placeholder = {
                        Text(
                            text = "Search ASTU (e.g. B7, SOEEC, Library)…",
                            fontSize = 13.sp,
                            color = Color(0xFF5F6368)
                        )
                    },
                    modifier = Modifier.weight(1f),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        disabledContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent
                    ),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { focusManager.clearFocus() })
                )

                if (query.isNotEmpty()) {
                    IconButton(
                        onClick = {
                            onQueryChanged("")
                            focusManager.clearFocus()
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                    }
                }

                // AI Guide Sparkle
                IconButton(
                    onClick = onOpenAiGuide,
                    modifier = Modifier
                        .size(32.dp)
                        .background(Color(0xFF6366F1).copy(alpha = 0.15f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = "AI Campus Guide",
                        tint = Color(0xFF6366F1),
                        modifier = Modifier.size(16.dp)
                    )
                }

                Spacer(modifier = Modifier.width(4.dp))

                // Map Layer Switcher
                IconButton(
                    onClick = onToggleMapTileType,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = if (mapTileType == MapTileType.SATELLITE) Icons.Default.Layers else Icons.Default.Map,
                        contentDescription = "Layer Switcher",
                        tint = Color(0xFF1A73E8),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // Search Results Dropdown List (translucent)
        AnimatedVisibility(visible = query.isNotEmpty() && searchResults.isNotEmpty()) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
                    .shadow(6.dp, RoundedCornerShape(14.dp)),
                shape = RoundedCornerShape(14.dp),
                color = Color.White.copy(alpha = 0.94f)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 220.dp)
                ) {
                    items(searchResults) { res ->
                        val b = res.building
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onSelectBuilding(b)
                                    onQueryChanged("")
                                    focusManager.clearFocus()
                                }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .background(Color(0xFFE8F0FE), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.LocationOn,
                                    contentDescription = null,
                                    tint = Color(0xFF1A73E8),
                                    modifier = Modifier.size(16.dp)
                                )
                            }

                            Spacer(modifier = Modifier.width(10.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = b.name,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.5.sp,
                                    color = Color(0xFF202124)
                                )
                                Text(
                                    text = if (res.matchingRoom != null) {
                                        "Room: ${res.matchingRoom.name} • Block ${b.code}"
                                    } else {
                                        "Block ${b.code} • ${b.category.replaceFirstChar { it.uppercase() }}"
                                    },
                                    fontSize = 11.5.sp,
                                    color = Color(0xFF5F6368)
                                )
                            }
                        }
                        HorizontalDivider(color = Color.LightGray.copy(alpha = 0.3f))
                    }
                }
            }
        }

        // Horizontal Category Chips Row (Translucent, space-efficient)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            CAMPUS_CATEGORIES.forEach { cat ->
                val isSelected = selectedCategory == cat.id
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = if (isSelected) cat.color.copy(alpha = 0.92f) else Color.White.copy(alpha = 0.85f),
                    shadowElevation = 2.dp,
                    modifier = Modifier.clickable { onCategorySelected(cat.id) }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = cat.icon,
                            contentDescription = cat.label,
                            tint = if (isSelected) Color.White else cat.color,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = cat.label,
                            fontSize = 11.5.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else Color(0xFF3C4043)
                        )
                    }
                }
            }
        }
    }
}
