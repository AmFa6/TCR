// Initialize the map with TAF-style design
let map;
let layerGroups = {};
let activeFilters = {}; // Store active filters per layer
let highlightedLayer = null; // Store reference to currently highlighted layer
let originalStyle = null; // Store original style of highlighted layer

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', async function() {
    initializeMap();
    setupLegendControls();
    await loadSampleData();
});

function initializeMap() {
    // Initialize map centered on West of England area (Bristol coordinates)
    map = L.map('map', {
        zoomControl: true  // Explicitly enable zoom controls
    }).setView([51.4545, -2.5879], 11);

    // Add CartoDB Positron (light background) as the only base map
    const lightBaseMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd'
    });

    // Add the light base map
    lightBaseMap.addTo(map);

    // Create map panes for layer ordering (similar to TAF)
    map.createPane('boundaryLayers').style.zIndex = 300;
    map.createPane('dataLayers').style.zIndex = 400;
    map.createPane('transportLayers').style.zIndex = 500;
    map.createPane('pointLayers').style.zIndex = 600;

    // Initialize layer groups - only add default layers to map
    layerGroups.growthZones = L.layerGroup().addTo(map);
    layerGroups.housing = L.layerGroup().addTo(map);
    layerGroups.ptal = L.layerGroup(); // Don't add to map by default
    layerGroups.busLines = L.layerGroup(); // Don't add to map by default
    layerGroups.busStops = L.layerGroup(); // Don't add to map by default
    layerGroups.railStations = L.layerGroup().addTo(map);
    layerGroups.tcrSchemes = L.layerGroup().addTo(map);

    // Add scale control
    L.control.scale({position: 'bottomleft'}).addTo(map);
    
    // Setup multi-layer popup system
    setupMultiLayerPopups();
}

// Convert MultiPolygon features to individual Polygon features
function convertMultiPolygonToPolygons(geoJson) {
    const features = [];
    const featureCounts = {};
    
    geoJson.features.forEach(feature => {
        if (feature.geometry.type === 'MultiPolygon') {
            // Count occurrences of each feature for unique naming
            const baseId = feature.properties.id || feature.properties.ID || feature.properties.objectid || 'feature';
            featureCounts[baseId] = (featureCounts[baseId] || 0) + 1;
            
            // Split MultiPolygon into individual Polygons
            feature.geometry.coordinates.forEach((polygonCoords, index) => {
                const newFeature = {
                    type: 'Feature',
                    properties: {
                        ...feature.properties,
                        // Add a suffix to distinguish split polygons
                        originalId: baseId,
                        polygonIndex: index
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: polygonCoords
                    }
                };
                features.push(newFeature);
            });
        } else {
            // Keep non-MultiPolygon features as they are
            features.push(feature);
        }
    });
    
    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Global variables for multi-layer popup system
let currentPopupLayers = [];
let currentPopupIndex = 0;
let activePopup = null;
let isNavigating = false; // Flag to prevent popup close cleanup during navigation

function setupMultiLayerPopups() {
    // Override the default popup behavior with higher priority
    map.on('click', function(e) {
        handleMapClick(e);
    });
    
    // Clean up highlights when popup is closed (but not during navigation)
    map.on('popupclose', function(e) {
        // Only clear state if we're not in the middle of navigation
        console.log('popupclose event, currentPopupLayers.length:', currentPopupLayers.length, 'isNavigating:', isNavigating);
        if (!isNavigating) {
            removeHighlight();
            currentPopupLayers = [];
            currentPopupIndex = 0;
            activePopup = null;
        } else {
            console.log('Skipping cleanup during navigation');
            // Don't call removeHighlight during navigation!
        }
    });
}

function handleMapClick(e) {
    // Clear any existing popup and highlights
    map.closePopup();
    removeHighlight();
    currentPopupLayers = [];
    currentPopupIndex = 0;
    activePopup = null;
    
    // Find all layers at click point
    const clickedLayers = findLayersAtPoint(e.latlng, e.containerPoint);
    
    if (clickedLayers.length === 0) {
        return; // No layers clicked
    }
    
    // Store the layers for navigation
    currentPopupLayers = clickedLayers;
    currentPopupIndex = 0;
    
    // Show the first popup
    showPopupAtIndex(0, e.latlng);
}

function isLayerVisible(groupName) {
    // Convert camelCase back to kebab-case for checkbox ID
    const checkboxId = groupName.replace(/([A-Z])/g, '-$1').toLowerCase();
    const checkbox = document.getElementById(checkboxId);
    
    // Handle special cases for nested layers - remove this since transport-infrastructure checkbox doesn't exist
    // For rail stations, bus lines, and bus stops, just check their individual checkboxes
    
    // For PTAL subcategories, check individual PTAL checkboxes
    if (groupName.startsWith('ptal')) {
        const ptalMainCheckbox = document.getElementById('ptal');
        if (!ptalMainCheckbox || !ptalMainCheckbox.checked) {
            return false;
        }
        
        // Check individual PTAL category checkboxes
        const ptalCategories = ['ptal-0', 'ptal-1a', 'ptal-1b', 'ptal-2', 'ptal-3', 'ptal-4', 'ptal-5', 'ptal-6a', 'ptal-6b'];
        return ptalCategories.some(categoryId => {
            const categoryCheckbox = document.getElementById(categoryId);
            return categoryCheckbox && categoryCheckbox.checked;
        });
    }
    
    // For all other layers, check the main checkbox
    return checkbox && checkbox.checked;
}

function findLayersAtPoint(latlng, point) {
    const foundLayers = [];
    
    // Iterate through all active layer groups
    Object.keys(layerGroups).forEach(groupName => {
        const layerGroup = layerGroups[groupName];
        
        // Debug logging
        const hasLayer = map.hasLayer(layerGroup);
        const isVisible = isLayerVisible(groupName);
        
        // Only search layers that are currently visible on the map AND have their checkbox checked
        if (hasLayer && isVisible) {
            // Recursively search through layers
            searchLayerGroup(layerGroup, latlng, point, groupName, foundLayers);
        }
    });
    
    return foundLayers;
}

function searchLayerGroup(layerGroup, latlng, point, groupName, foundLayers) {
    layerGroup.eachLayer(layer => {
        if (layer instanceof L.LayerGroup) {
            // Recursively search nested layer groups
            searchLayerGroup(layer, latlng, point, groupName, foundLayers);
        } else if (layer.feature || layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polygon || layer instanceof L.Polyline) {
            // Skip layers that are marked as filtered out
            if (layer.options && layer.options.filteredOut) {
                console.log('Skipping filtered out layer from popup');
                return;
            }
            
            // Skip layers that are hidden by filters (opacity 0 or invisible style)
            const isLayerVisible = !layer.options || 
                                 (layer.options.opacity !== 0 && 
                                  layer.options.fillOpacity !== 0 && 
                                  layer.options.weight !== 0);
            
            // Check if this layer contains the click point AND is currently visible
            if (isLayerVisible && isLayerAtPoint(layer, latlng, point)) {
                // For layers without feature property, create a basic feature object
                const feature = layer.feature || {
                    properties: {
                        'Layer Type': layer.constructor.name,
                        'Coordinates': layer.getLatLng ? `${layer.getLatLng().lat.toFixed(5)}, ${layer.getLatLng().lng.toFixed(5)}` : 'N/A'
                    }
                };
                
                // Double-check if this feature passes current filters for this layer
                if (passesActiveFilters(feature, groupName)) {
                    console.log('Adding feature to popup list:', feature.properties);
                    foundLayers.push({
                        layer: layer,
                        feature: feature,
                        groupName: groupName
                    });
                } else {
                    console.log('Feature filtered out from popup:', feature.properties);
                }
            } else {
                if (!isLayerVisible) {
                    console.log('Layer hidden by filter, skipping from popup');
                }
            }
        } else {
        }
    });
}

function isLayerAtPoint(layer, latlng, point) {
    try {
        // For point features (markers, circle markers)
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
            const layerPoint = map.latLngToContainerPoint(layer.getLatLng());
            const distance = Math.sqrt(
                Math.pow(layerPoint.x - point.x, 2) + 
                Math.pow(layerPoint.y - point.y, 2)
            );
            return distance <= 15; // 15 pixel tolerance for better detection
        }
        
        // For polygon features
        if (layer instanceof L.Polygon) {
            const result = isPointInPolygon(latlng, layer.getLatLngs());
            return result;
        }
        
        // For polyline features
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
            return isPointNearPolyline(latlng, layer.getLatLngs(), point);
        }
        
        // For other layer types, try to use Leaflet's built-in bounds checking
        if (layer.getBounds && typeof layer.getBounds === 'function') {
            const bounds = layer.getBounds();
            if (bounds.contains && typeof bounds.contains === 'function') {
                return bounds.contains(latlng);
            }
        }
        
        // Fallback: check if layer has a getLatLng method (for point-like features)
        if (layer.getLatLng && typeof layer.getLatLng === 'function') {
            const layerLatLng = layer.getLatLng();
            const layerPoint = map.latLngToContainerPoint(layerLatLng);
            const distance = Math.sqrt(
                Math.pow(layerPoint.x - point.x, 2) + 
                Math.pow(layerPoint.y - point.y, 2)
            );
            return distance <= 15;
        }
        
    } catch (error) {
        return false;
    }
    
    return false;
}

function isPointInPolygon(point, polygon) {
    // Handle nested arrays (polygons with holes)
    let coords;
    if (Array.isArray(polygon) && polygon.length > 0) {
        // Handle different polygon structures
        if (Array.isArray(polygon[0])) {
            // Polygon with potential holes - use outer ring
            coords = polygon[0];
        } else if (polygon[0] && polygon[0].lat !== undefined) {
            // Direct coordinate array
            coords = polygon;
        } else {
            return false;
        }
    } else {
        return false;
    }
        
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const xi = coords[i].lat || coords[i][1];
        const yi = coords[i].lng || coords[i][0];
        const xj = coords[j].lat || coords[j][1];
        const yj = coords[j].lng || coords[j][0];
        
        if (((yi > point.lng) !== (yj > point.lng)) &&
            (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

function isPointNearPolyline(point, polyline, clickPoint) {
    // Simple distance check for lines
    const coords = Array.isArray(polyline[0]) ? polyline[0] : polyline;
    const threshold = 20; // pixels
    
    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = map.latLngToContainerPoint(coords[i]);
        const p2 = map.latLngToContainerPoint(coords[i + 1]);
        
        const distance = distanceToLineSegment(clickPoint, p1, p2);
        if (distance <= threshold) {
            return true;
        }
    }
    return false;
}

function distanceToLineSegment(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    const t = Math.max(0, Math.min(1, dot / lenSq));
    const projection = {
        x: lineStart.x + t * C,
        y: lineStart.y + t * D
    };
    
    const dx = point.x - projection.x;
    const dy = point.y - projection.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculatePopupPosition(layer, clickedLatLng) {
    try {
        // For point features, offset the popup slightly
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
            const layerLatLng = layer.getLatLng();
            const offset = 0.001; // Small offset in degrees
            return [layerLatLng.lat + offset, layerLatLng.lng + offset];
        }
        
        // For polygon and line features, try to get bounds
        if (layer.getBounds && typeof layer.getBounds === 'function') {
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                // Position popup at the northeast corner of bounds with small offset
                const ne = bounds.getNorthEast();
                const offset = 0.001;
                return [ne.lat + offset, ne.lng + offset];
            }
        }
        
        // Fallback to clicked position with small offset
        return [clickedLatLng.lat + 0.001, clickedLatLng.lng + 0.001];
        
    } catch (error) {
        return clickedLatLng;
    }
}

function passesActiveFilters(feature, groupName) {
    // Get the layer name that matches the activeFilters structure
    const layerName = getLayerDisplayName(groupName);
    const layerFilterData = activeFilters[layerName];
    
    // If no filters are active for this layer, show the feature
    if (!layerFilterData || !layerFilterData.filters || layerFilterData.filters.length === 0) {
        return true;
    }
    
    const properties = feature.properties || {};
    const camelCaseId = toCamelCase(layerName);
    const filterResults = [];
    
    // Check each filter
    for (const filter of layerFilterData.filters) {
        let searchAttribute = filter.attribute;
        
        console.log('Popup filter check - Processing filter:', filter);
        console.log('Popup filter check - Original attribute:', searchAttribute);
        
        // Handle TCR attribute mapping
        if (camelCaseId === 'tcrSchemes') {
            searchAttribute = getOriginalTCRAttributeName(filter.attribute);
            console.log('Popup filter check - Mapped TCR attribute from', filter.attribute, 'to', searchAttribute);
        }
        
        const propValue = properties[searchAttribute];
        console.log('Popup filter check - Property value for', searchAttribute, ':', propValue);
        let passesFilter = false;
        
        switch (filter.operator) {
            case 'equals':
                // Make comparison case-insensitive for better matching
                const filterValue = filter.value1.toString().toLowerCase();
                const propValueStr = propValue ? propValue.toString().toLowerCase() : '';
                passesFilter = propValueStr === filterValue;
                break;
            case 'contains':
                passesFilter = propValue && propValue.toString().toLowerCase().includes(filter.value1.toLowerCase());
                break;
            case 'greater':
                passesFilter = parseFloat(propValue) > parseFloat(filter.value1);
                break;
            case 'less':
                passesFilter = parseFloat(propValue) < parseFloat(filter.value1);
                break;
            case 'between':
                const num = parseFloat(propValue);
                passesFilter = num >= parseFloat(filter.value1) && num <= parseFloat(filter.value2);
                break;
        }
        
        filterResults.push(passesFilter);
    }
    
    // Apply AND/OR logic
    if (layerFilterData.logic === 'AND') {
        // ALL filters must pass
        return filterResults.every(result => result === true);
    } else {
        // ANY filter can pass (OR logic)
        return filterResults.some(result => result === true);
    }
}

function showPopupAtIndex(index, latlng) {
    console.log('showPopupAtIndex called with index:', index, 'total layers:', currentPopupLayers.length);
    
    if (index < 0 || index >= currentPopupLayers.length) {
        console.log('Invalid index, returning');
        return;
    }
    
    // Update the current popup index to stay in sync
    currentPopupIndex = index;
    console.log('Updated currentPopupIndex to:', currentPopupIndex);
    
    const layerInfo = currentPopupLayers[index];
    const feature = layerInfo.feature;
    const groupName = layerInfo.groupName;
    const layer = layerInfo.layer;
    
    console.log('Selected layer info:', {groupName, hasFeature: !!feature, hasLayer: !!layer});
    
    // Always remove previous highlight first
    removeHighlight();
    
    // Highlight the current feature
    highlightCurrentFeature(layer, index);
    
    // Use the standardized popup content creation function
    let popupContent = createFullPopupContent(feature, groupName);
    
    // Add navigation header if multiple layers
    if (currentPopupLayers.length > 1) {
        // Insert navigation controls at the beginning of the popup content
        const navigationHTML = `
            <div style="background: #f8f9fa; padding: 8px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button onclick="previousPopup()" ${index === 0 ? 'disabled' : ''} 
                                style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 14px; cursor: ${index === 0 ? 'not-allowed' : 'pointer'}; opacity: ${index === 0 ? '0.5' : '1'};">
                            &lt;
                        </button>
                        <button onclick="nextPopup()" ${index === currentPopupLayers.length - 1 ? 'disabled' : ''} 
                                style="background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 14px; cursor: ${index === currentPopupLayers.length - 1 ? 'not-allowed' : 'pointer'}; opacity: ${index === currentPopupLayers.length - 1 ? '0.5' : '1'};">
                            &gt;
                        </button>
                    </div>
                    <div style="font-size: 11px; color: #6c757d; font-weight: 500;">
                        ${index + 1} of ${currentPopupLayers.length}
                    </div>
                </div>
            </div>
        `;
        
        // Insert navigation before the popup header
        popupContent = popupContent.replace('<div class="popup-header">', navigationHTML + '<div class="popup-header">');
    }
    
    // Calculate optimal popup position outside feature bounds
    const popupPosition = calculatePopupPosition(layer, latlng);
    
    // Create and show popup without arrow tip and make it draggable
    activePopup = L.popup({
        maxWidth: 400,
        className: 'multi-layer-popup',
        closeButton: true,
        autoPan: false,
        closeOnEscapeKey: true,
        closeOnClick: false,
        offset: [0, 0], // Remove offset to eliminate arrow positioning
        autoPanPadding: [5, 5]
    })
    .setLatLng(popupPosition)
    .setContent(popupContent)
    .openOn(map);
    
    // No individual popup remove listener - handle all cleanup through global popupclose event
    
    // Make popup draggable - use a small timeout to ensure DOM is ready
    setTimeout(() => {
        makePopupDraggable(activePopup);
    }, 10);
}

function formatLayerName(groupName) {
    const nameMap = {
        'growthZones': 'Growth Zones',
        'housing': 'Housing',
        'ptal': 'PTAL',
        'busLines': 'Bus Lines',
        'busStops': 'Bus Stops',
        'railStations': 'Rail Stations',
        'tcrSchemes': 'TCR Schemes'
    };
    return nameMap[groupName] || groupName;
}

function getLayerDisplayName(groupName) {
    // This function converts groupName (camelCase) to the display name used in activeFilters
    // which corresponds to what's shown in the filter modal
    return formatLayerName(groupName);
}

function formatPropertyName(key) {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ');
}

function formatPropertyValue(value) {
    if (typeof value === 'number') {
        return value.toLocaleString();
    }
    if (typeof value === 'string') {
        // Remove � characters from string values
        return value.replace(/�/g, '');
    }
    return value;
}

// Global functions for popup navigation (called from popup buttons)
window.previousPopup = function() {
    console.log('previousPopup called, currentPopupIndex:', currentPopupIndex, 'total layers:', currentPopupLayers.length);
    if (currentPopupIndex > 0) {
        isNavigating = true; // Set flag to prevent cleanup during navigation
        currentPopupIndex--;
        console.log('Moving to previous, new index:', currentPopupIndex);
        
        // Get the latlng from the target layer instead of relying on activePopup
        const targetLayer = currentPopupLayers[currentPopupIndex].layer;
        let latlng;
        if (targetLayer.getLatLng) {
            latlng = targetLayer.getLatLng();
        } else if (targetLayer.getBounds) {
            latlng = targetLayer.getBounds().getCenter();
        } else if (activePopup) {
            latlng = activePopup.getLatLng();
        } else {
            console.error('Cannot determine latlng for navigation');
            isNavigating = false;
            return;
        }
        
        showPopupAtIndex(currentPopupIndex, latlng);
        isNavigating = false; // Clear flag after navigation
    }
};

window.nextPopup = function() {
    console.log('nextPopup called, currentPopupIndex:', currentPopupIndex, 'total layers:', currentPopupLayers.length);
    if (currentPopupIndex < currentPopupLayers.length - 1) {
        isNavigating = true; // Set flag to prevent cleanup during navigation
        currentPopupIndex++;
        console.log('Moving to next, new index:', currentPopupIndex);
        
        // Get the latlng from the target layer instead of relying on activePopup
        const targetLayer = currentPopupLayers[currentPopupIndex].layer;
        let latlng;
        if (targetLayer.getLatLng) {
            latlng = targetLayer.getLatLng();
        } else if (targetLayer.getBounds) {
            latlng = targetLayer.getBounds().getCenter();
        } else if (activePopup) {
            latlng = activePopup.getLatLng();
        } else {
            console.error('Cannot determine latlng for navigation');
            isNavigating = false;
            return;
        }
        
        showPopupAtIndex(currentPopupIndex, latlng);
        isNavigating = false; // Clear flag after navigation
    }
};

// Enhanced function to highlight current feature during navigation
function highlightCurrentFeature(layer, index) {
    console.log('highlightCurrentFeature called for index:', index, 'layer type:', layer?.constructor?.name);
    
    // Always remove any existing highlight first
    removeHighlight();
    
    if (!layer) {
        console.log('No layer provided, skipping highlight');
        return;
    }
    
    // Store reference to highlighted layer
    highlightedLayer = layer;
    console.log('Set highlightedLayer to:', layer?.constructor?.name);
    
    // Store original style comprehensively based on layer type
    console.log('Checking layer type:', layer.constructor.name, 'instanceof checks:', {
        CircleMarker: layer instanceof L.CircleMarker,
        Marker: layer instanceof L.Marker,
        Polygon: layer instanceof L.Polygon,
        Polyline: layer instanceof L.Polyline
    });
    
    if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        console.log('Applying point/marker highlighting');
        originalStyle = {
            color: layer.options.color || '#3388ff',
            fillColor: layer.options.fillColor || '#3388ff',
            weight: layer.options.weight || 3,
            opacity: layer.options.opacity || 1,
            fillOpacity: layer.options.fillOpacity || 0.2,
            radius: layer.options.radius || 5
        };
        
        // Apply bright highlight style for points
        layer.setStyle({
            color: '#ff0000',
            fillColor: '#ff0000',
            weight: 4,
            opacity: 1,
            fillOpacity: 0.9,
            radius: Math.max((originalStyle.radius || 5) + 3, 8)
        });
        console.log('Point/marker highlighting applied');
        
    } else if (layer instanceof L.Polygon) {
        console.log('Applying polygon highlighting');
        originalStyle = {
            color: layer.options.color || '#3388ff',
            fillColor: layer.options.fillColor || '#3388ff',
            weight: layer.options.weight || 3,
            opacity: layer.options.opacity || 1,
            fillOpacity: layer.options.fillOpacity || 0.2
        };
        
        // Apply bright highlight style for polygons
        layer.setStyle({
            color: '#ff0000',
            fillColor: '#ff0000',
            weight: 4,
            opacity: 1,
            fillOpacity: 0.4
        });
        console.log('Polygon highlighting applied');
        
    } else if (layer instanceof L.Polyline) {
        console.log('Applying polyline highlighting');
        originalStyle = {
            color: layer.options.color || '#3388ff',
            weight: layer.options.weight || 3,
            opacity: layer.options.opacity || 1,
            dashArray: layer.options.dashArray || null
        };
        
        // Apply bright highlight style for lines
        layer.setStyle({
            color: '#ff0000',
            weight: Math.max(5, (originalStyle.weight || 3) + 2),
            opacity: 1,
            dashArray: null // Remove any dash pattern during highlight
        });
        console.log('Polyline highlighting applied');
        
    } else {
        console.log('Applying fallback highlighting for unknown layer type');
        // Fallback for other layer types
        originalStyle = {
            color: layer.options.color || '#3388ff',
            fillColor: layer.options.fillColor,
            weight: layer.options.weight || 3,
            opacity: layer.options.opacity || 1,
            fillOpacity: layer.options.fillOpacity,
            radius: layer.options.radius
        };
        
        // Apply generic highlight
        const highlightStyle = {
            color: '#ff0000',
            weight: 4,
            opacity: 1
        };
        
        if (originalStyle.fillColor !== undefined) {
            highlightStyle.fillColor = '#ff0000';
            highlightStyle.fillOpacity = 0.4;
        }
        if (originalStyle.radius !== undefined) {
            highlightStyle.radius = Math.max((originalStyle.radius || 5) + 3, 8);
            highlightStyle.fillOpacity = 0.9;
        }
        
        layer.setStyle(highlightStyle);
        console.log('Fallback highlighting applied');
    }
    
    console.log('Highlighting complete for layer:', layer.constructor.name);
    
    // Bring the highlighted layer to front
    if (layer.bringToFront && typeof layer.bringToFront === 'function') {
        layer.bringToFront();
    }
    
    // Add a subtle pulse effect by adjusting the map view slightly if needed
    if (layer.getBounds && typeof layer.getBounds === 'function') {
        const bounds = layer.getBounds();
        if (bounds.isValid() && !map.getBounds().contains(bounds)) {
            map.panTo(bounds.getCenter());
        }
    } else if (layer.getLatLng && typeof layer.getLatLng === 'function') {
        const latLng = layer.getLatLng();
        if (!map.getBounds().contains(latLng)) {
            map.panTo(latLng);
        }
    }
    
}

// Function to highlight a feature (legacy support)
function highlightFeature(layer) {
    highlightCurrentFeature(layer, 0);
}

// Function to remove highlight
function removeHighlight() {
    console.log('removeHighlight called, highlightedLayer:', !!highlightedLayer, 'originalStyle:', !!originalStyle);
    if (highlightedLayer && originalStyle) {
        console.log('Restoring original style for layer:', highlightedLayer.constructor.name);
        // Restore original style
        highlightedLayer.setStyle(originalStyle);
        highlightedLayer = null;
        originalStyle = null;
        console.log('Highlight removed successfully');
    } else {
        console.log('No highlighted layer or original style to restore');
    }
}

function setupLegendControls() {
    // Setup legend category collapsible functionality (TAF style)
    document.querySelectorAll('.legend-category-header').forEach(header => {
        header.addEventListener('click', function() {
            const category = this.closest('.legend-category');
            category.classList.toggle('legend-category-collapsed');
        });
    });
    
    // Setup legend toggle functionality
    const legendHeader = document.querySelector('.legend-header');
    let isLegendExpanded = true;
    
    if (legendHeader) {
        legendHeader.addEventListener('click', function() {
            isLegendExpanded = !isLegendExpanded;
            
            const legend = document.getElementById('legend');
            legend.classList.toggle('collapsed', !isLegendExpanded);
            
            const legendContent = document.getElementById('legend-content-wrapper');
            if (legendContent) {
                legendContent.style.display = isLegendExpanded ? 'block' : 'none';
            }
            
            const toggleIcon = document.getElementById('toggle-legend');
            toggleIcon.classList.toggle('collapsed', !isLegendExpanded);
        });
    }

    // Layer checkboxes
    const layerCheckboxes = document.querySelectorAll('input[type="checkbox"]:not([name]):not([id^="ptal-"])');
    layerCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const layerId = this.id;
            let camelCaseId = toCamelCase(layerId);
            
            if (layerGroups[camelCaseId]) {
                if (this.checked) {
                    // Load data on-demand for heavy layers
                    if (layerId === 'ptal') {
                        // Check if PTAL data is already loaded
                        if (layerGroups.ptal.getLayers().length === 0) {
                            loadPTALDataAsync().then(() => {
                                // Add layer to map after loading
                                map.addLayer(layerGroups.ptal);
                                // Update PTAL layer visibility based on individual checkboxes
                                updatePTALLayer();
                            });
                        } else {
                            map.addLayer(layerGroups.ptal);
                        }
                    } else if (layerId === 'bus-lines') {
                        // Check if bus lines data is already loaded
                        if (layerGroups.busLines.getLayers().length === 0) {
                            loadBusLinesAsync().then(() => {
                                map.addLayer(layerGroups.busLines);
                            });
                        } else {
                            map.addLayer(layerGroups.busLines);
                        }
                    } else if (layerId === 'bus-stops') {
                        // Check if bus stops data is already loaded
                        if (layerGroups.busStops.getLayers().length === 0) {
                            loadBusStopsAsync().then(() => {
                                map.addLayer(layerGroups.busStops);
                            });
                        } else {
                            map.addLayer(layerGroups.busStops);
                        }
                    } else {
                        // For other layers, just add to map
                        map.addLayer(layerGroups[camelCaseId]);
                    }
                } else {
                    map.removeLayer(layerGroups[camelCaseId]);
                }
            }
            
            // Handle PTAL select/deselect all functionality
            if (layerId === 'ptal') {
                // Main PTAL checkbox now acts as select/deselect all
                const ptalCheckboxes = document.querySelectorAll('[id^="ptal-"]:not(#ptal)');
                ptalCheckboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
                if (this.checked && layerGroups.ptal.getLayers().length > 0) {
                    updatePTALLayer();
                }
            }
        });
    });
    
    // Setup PTAL individual controls
    setupPTALControls();
    
    setupFilterModal();
    setupLayerIcons();
    
    // Setup drag and drop for layer reordering
    setupLayerDragAndDrop();
}

function setupFilterModal() {
    const filterModal = document.getElementById('filter-modal');
    const filterCloseBtn = document.querySelector('.filter-close');
    
    if (!filterModal || !filterCloseBtn) {
        return;
    }
    
    // Close filter modal
    filterCloseBtn.onclick = () => filterModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === filterModal) {
            filterModal.style.display = 'none';
        }
    };
    
    // Filter attribute change handler
    const filterAttribute = document.getElementById('filter-attribute');
    const filterControls = document.getElementById('filter-controls');
    if (filterAttribute && filterControls) {
        filterAttribute.addEventListener('change', (e) => {
            filterControls.style.display = e.target.value ? 'block' : 'none';
            // Populate value suggestions when attribute is selected
            if (e.target.value) {
                populateValueSuggestions(e.target.value);
            }
        });
    }
    
    // Filter operator change handler
    const filterOperator = document.getElementById('filter-operator');
    const filterValue2Group = document.getElementById('filter-value2-group');
    if (filterOperator && filterValue2Group) {
        filterOperator.addEventListener('change', (e) => {
            filterValue2Group.style.display = e.target.value === 'between' ? 'block' : 'none';
        });
    }
    
    // Filter buttons
    const addFilterBtn = document.getElementById('add-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (addFilterBtn) {
        addFilterBtn.addEventListener('click', () => {
            addFilterToList();
        });
    }
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            applyAllFilters();
        });
    }
    
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            clearAllFilters();
            updateActiveFiltersDisplay();
            // Don't close the modal - let user continue adding filters
        });
    }
    
    const filterVisibleExtentBtn = document.getElementById('filter-visible-extent');
    if (filterVisibleExtentBtn) {
        filterVisibleExtentBtn.addEventListener('click', () => {
            filterToVisibleExtent();
        });
    }
    
    const clearSpatialFilterBtn = document.getElementById('clear-spatial-filter');
    if (clearSpatialFilterBtn) {
        clearSpatialFilterBtn.addEventListener('click', () => {
            clearSpatialFilter();
        });
    }
}

function setupLayerIcons() {
    // Palette icon handlers
    document.querySelectorAll('.palette-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const layerName = e.currentTarget.getAttribute('data-layer');
            if (layerName) {
                openStylingModal(layerName);
            }
        });
    });
    
    // Zoom icon handlers
    document.querySelectorAll('.zoom-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const layerName = e.currentTarget.getAttribute('data-layer');
            if (layerName) {
                zoomToLayer(layerName);
            }
        });
    });
    
    // Filter icon handlers
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const layerName = e.currentTarget.getAttribute('data-layer');
            if (layerName) {
                openFilterModal(layerName);
            }
        });
    });
}

function setupLayerDragAndDrop() {
    // Get the legend content wrapper
    const legendContent = document.getElementById('legend-content-wrapper');
    if (!legendContent) {
        return;
    }
    
    // Make layer items draggable
    const layerItems = legendContent.children;
    
    // Convert HTMLCollection to Array for easier manipulation
    Array.from(layerItems).forEach((item, index) => {
        // Skip PTAL category content since it has nested items
        if (item.classList.contains('legend-category')) {
            item.draggable = true;
            item.dataset.layerOrder = index;
        } else if (item.style && item.style.display === 'flex') {
            // Individual layer items
            item.draggable = true;
            item.dataset.layerOrder = index;
            item.style.cursor = 'move';
        }
        
        // Add drag event listeners
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.5';
    
    // Add visual feedback
    this.classList.add('dragging');
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // Add visual feedback for drop zone
    this.classList.add('drag-over');
    
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        // Get the parent container
        const container = this.parentNode;
        
        // Get all children as array
        const children = Array.from(container.children);
        
        // Find indices
        const draggedIndex = children.indexOf(draggedElement);
        const targetIndex = children.indexOf(this);
        
        // Remove dragged element from DOM
        draggedElement.parentNode.removeChild(draggedElement);
        
        // Insert at new position
        if (draggedIndex < targetIndex) {
            container.insertBefore(draggedElement, this.nextSibling);
        } else {
            container.insertBefore(draggedElement, this);
        }
        
        // Update layer z-order on map
        updateLayerZOrder();
    }
    
    this.classList.remove('drag-over');
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '';
    this.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    draggedElement = null;
}

function updateLayerZOrder() {
    const legendContent = document.getElementById('legend-content-wrapper');
    const layerItems = Array.from(legendContent.children);
    
    // Layer mapping from HTML IDs to layer group names
    const layerMapping = {
        'growth-zones': 'growthZones',
        'housing': 'housing',
        'ptal': 'ptal',
        'tcr-schemes': 'tcrSchemes',
        'bus-lines': 'busLines',
        'bus-stops': 'busStops',
        'rail-stations': 'railStations'
    };
    
    // Update z-index based on position in DOM (reverse order since last = top)
    layerItems.forEach((item, index) => {
        let layerId = null;
        
        // Get layer ID from different types of elements
        if (item.classList.contains('legend-category')) {
            // Handle categories like PTAL or Transport Infrastructure
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                layerId = checkbox.id;
            }
        } else {
            // Handle individual layer items
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                layerId = checkbox.id;
            }
        }
        
        if (layerId && layerMapping[layerId]) {
            const layerGroup = layerGroups[layerMapping[layerId]];
            if (layerGroup && layerGroup.setZIndex) {
                // Higher index = higher z-order (appears on top)
                const zIndex = (layerItems.length - index) * 100;
                layerGroup.setZIndex(zIndex);
            } else if (layerGroup) {
                // For layer groups without setZIndex, remove and re-add to map
                map.removeLayer(layerGroup);
                map.addLayer(layerGroup);
            }
        }
    });
}

function setupPTALControls() {
    // Setup individual PTAL checkbox handlers
    const ptalCheckboxes = document.querySelectorAll('[id^="ptal-"]:not(#ptal)');
    ptalCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updatePTALLayer);
    });
}

function updatePTALLayer() {
    if (!layerGroups.ptal) return;
    
    const visibleCategories = [];
    const ptalCheckboxes = document.querySelectorAll('[id^="ptal-"]:not(#ptal)');
    
    ptalCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const category = checkbox.id.replace('ptal-', '');
            visibleCategories.push(category);
        }
    });
    
    // Function to recursively update all layers including nested ones
    function updateLayerVisibility(layer) {
        if (layer.getLayers) {
            // This is a layer group, update all sub-layers
            layer.getLayers().forEach(subLayer => updateLayerVisibility(subLayer));
        } else if (layer.feature && layer.feature.properties) {
            // This is a feature layer
            const ptal = (layer.feature.properties.PTAL || layer.feature.properties.ptal || '').toString().toLowerCase();
            if (visibleCategories.includes(ptal)) {
                layer.setStyle({ fillOpacity: 0.7, opacity: 0 });
            } else {
                layer.setStyle({ fillOpacity: 0, opacity: 0 });
            }
        }
    }
    
    // Update all PTAL layers including those loaded in chunks
    updateLayerVisibility(layerGroups.ptal);
}

function zoomToLayer(layerName) {
    if (!layerName) {
        return;
    }
    
    // Alternative mapping for layers that don't follow the simple pattern
    const layerMapping = {
        'growth-zones': layerGroups.growthZones,
        'housing': layerGroups.housing,
        'ptal': layerGroups.ptal,
        'tcr-schemes': layerGroups.tcrSchemes,
        'bus-lines': layerGroups.busLines,
        'bus-stops': layerGroups.busStops,
        'rail-stations': layerGroups.railStations
    };
    
    const targetLayer = layerMapping[layerName];
    
    if (targetLayer && targetLayer.getLayers().length > 0) {
        // Create a feature group to get bounds
        const group = new L.featureGroup(targetLayer.getLayers());
        const bounds = group.getBounds();
        
        if (bounds.isValid()) {
            // Zoom to the layer with some padding
            map.fitBounds(bounds, { padding: [20, 20] });
        } else {
        }
    } else {
        // Fallback to default view if layer is not available
        map.setView([51.4545, -2.5879], 11);
    }
}

function openStylingModal(layerName) {
    const modal = document.getElementById('styling-modal');
    const title = document.getElementById('modal-title');
    
    if (!modal) {
        return;
    }
    
    // Set modal title based on layer
    const layerTitles = {
        'growth-zones': 'Growth Zones Styling',
        'housing': 'Housing Styling',
        'ptal': 'PTAL Styling',
        'tcr-schemes': 'TCR Schemes Styling',
        'bus-lines': 'Bus Lines Styling',
        'bus-stops': 'Bus Stops Styling',
        'rail-stations': 'Rail Stations Styling'
    };
    
    if (title) {
        title.textContent = layerTitles[layerName] || 'Layer Styling';
    }
    modal.setAttribute('data-current-layer', layerName);
    modal.style.display = 'block';
}

function openFilterModal(layerName) {
    const filterModal = document.getElementById('filter-modal');
    const filterTitle = document.getElementById('filter-modal-title');
    const filterAttribute = document.getElementById('filter-attribute');
    
    if (!filterModal) {
        return;
    }
    
    // Set modal title based on layer
    const layerTitles = {
        'growth-zones': 'Growth Zones Filter',
        'housing': 'Housing Filter',
        'ptal': 'PTAL Filter',
        'tcr-schemes': 'TCR Schemes Filter',
        'bus-lines': 'Bus Lines Filter',
        'bus-stops': 'Bus Stops Filter',
        'rail-stations': 'Rail Stations Filter'
    };
    
    if (filterTitle) {
        filterTitle.textContent = layerTitles[layerName] || 'Layer Filter';
    }
    filterModal.setAttribute('data-current-layer', layerName);
    
    // Populate available attributes for the layer
    populateFilterAttributes(layerName);
    
    filterModal.style.display = 'block';
}

function populateFilterAttributes(layerName) {
    const filterAttribute = document.getElementById('filter-attribute');
    filterAttribute.innerHTML = '<option value="">Select attribute...</option>';
    
    // Get layer group and extract attribute names
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    
    // Define the same attribute filters as used in popups
    const layerAttributeFilters = {
        'growthZones': ['Name', 'GrowthType'],
        'housing': ['Path'], // Exclude Path - show all others
        'ptal': ['GRID_ID', 'PTAI', 'PTAL'],
        'railStations': ['XCoord', 'YCoord'], // Exclude XCoord and YCoord - show all others
        'busLines': ['TUEAM', 'TUEBP', 'TUEEP', 'TUEOP', 'SATAM', 'SATBP', 'SATEP', 'SATOP', 'SUNAM', 'SUNBP', 'SUNEP', 'SUNOP'], // Only show these
        'busStops': ['X', 'Y'] // Exclude X and Y - show all others
    };
    
    // Custom attribute display names
    const attributeDisplayNames = {
        'TUEAM': 'Weekday AM Frequency',
        'TUEBP': 'Weekday IP Frequency',
        'TUEEP': 'Weekday PM Frequency',
        'TUEOP': 'Weekday OP Frequency',
        'SATAM': 'Saturday AM Frequency',
        'SATBP': 'Saturday IP Frequency',
        'SATEP': 'Saturday PM Frequency',
        'SATOP': 'Saturday OP Frequency',
        'SUNAM': 'Sunday AM Frequency',
        'SUNBP': 'Sunday IP Frequency',
        'SUNEP': 'Sunday PM Frequency',
        'SUNOP': 'Sunday OP Frequency',
        'Freq_AM': 'AM Frequency',
        'Freq_IP': 'IP Frequency',
        'Freq_PM': 'PM Frequency',
        'Freq_Night': 'OP Frequency'
    };
    
    if (layerGroup) {
        const attributes = new Set();
        let featureCount = 0;
        
        layerGroup.eachLayer(layer => {
            // Function to recursively get all features including nested ones
            function getAllFeatures(currentLayer) {
                if (currentLayer.getLayers) {
                    // This is a layer group, get all sub-layers
                    currentLayer.getLayers().forEach(subLayer => getAllFeatures(subLayer));
                } else if (currentLayer.feature && currentLayer.feature.properties) {
                    // This is a feature layer with properties
                    featureCount++;
                    let properties = currentLayer.feature.properties;
                    
                    // Apply TCR attribute renaming if this is a TCR layer
                    if (camelCaseId === 'tcrSchemes') {
                        properties = renameTCRAttributes(properties);
                    }
                    
                    // Apply the same filtering logic as popups
                    let filteredProperties = {};
                    if (layerAttributeFilters[camelCaseId]) {
                        if (camelCaseId === 'growthZones' || camelCaseId === 'ptal' || camelCaseId === 'busLines') {
                            // Include only specified attributes
                            layerAttributeFilters[camelCaseId].forEach(attr => {
                                if (properties.hasOwnProperty(attr)) {
                                    filteredProperties[attr] = properties[attr];
                                }
                            });
                        } else {
                            // Exclude specified attributes, show all others
                            Object.keys(properties).forEach(key => {
                                if (!layerAttributeFilters[camelCaseId].includes(key)) {
                                    filteredProperties[key] = properties[key];
                                }
                            });
                        }
                    } else {
                        // For other layers, show all attributes
                        filteredProperties = properties;
                    }
                    
                    Object.keys(filteredProperties).forEach(key => {
                        const value = filteredProperties[key];
                        // Include attribute if it has a value (not null, undefined, or empty string)
                        if (value !== null && value !== undefined && value !== '') {
                            attributes.add(key);
                        }
                    });
                }
            }
            
            getAllFeatures(layer);
        });
        
        if (featureCount === 0) {
            // If no features found, show a message
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No features loaded for this layer';
            option.disabled = true;
            filterAttribute.appendChild(option);
            return;
        }
        
        if (attributes.size === 0) {
            // If no attributes found, show a message
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No filterable attributes found';
            option.disabled = true;
            filterAttribute.appendChild(option);
            return;
        }
        
        // Add attributes to dropdown, sorted alphabetically
        Array.from(attributes).sort().forEach(attr => {
            const option = document.createElement('option');
            option.value = attr;
            // Use custom display names if available, otherwise format the attribute name
            option.textContent = attributeDisplayNames[attr] || 
                               attr.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            filterAttribute.appendChild(option);
        });
    } else {
        // Layer group not found
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Layer not available';
        option.disabled = true;
        filterAttribute.appendChild(option);
    }
}

function populateValueSuggestions(attributeName) {
    const filterModal = document.getElementById('filter-modal');
    const datalist = document.getElementById('filter-value-suggestions');
    
    if (!filterModal || !datalist) {
        return;
    }
    
    const layerName = filterModal.getAttribute('data-current-layer');
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    
    // Clear existing suggestions
    datalist.innerHTML = '';
    
    if (layerGroup) {
        const uniqueValues = new Set();
        
        // For TCR schemes, we need to map the displayed attribute name back to the original
        let searchAttributeName = attributeName;
        if (camelCaseId === 'tcrSchemes') {
            searchAttributeName = getOriginalTCRAttributeName(attributeName);
        }
        
        layerGroup.eachLayer(layer => {
            // Function to recursively get all values for the attribute
            function getAllValues(currentLayer) {
                if (currentLayer.getLayers) {
                    // This is a layer group, get all sub-layers
                    currentLayer.getLayers().forEach(subLayer => getAllValues(subLayer));
                } else if (currentLayer.feature && currentLayer.feature.properties) {
                    // This is a feature layer with properties
                    const value = currentLayer.feature.properties[searchAttributeName];
                    if (value !== null && value !== undefined && value !== '') {
                        // Clean the value (remove � characters)
                        let cleanValue = value.toString();
                        if (typeof cleanValue === 'string') {
                            cleanValue = cleanValue.replace(/�/g, '');
                        }
                        if (cleanValue !== '') {
                            uniqueValues.add(cleanValue);
                        }
                    }
                }
            }
            
            getAllValues(layer);
        });
        
        // Add unique values to datalist, sorted alphabetically
        Array.from(uniqueValues).sort((a, b) => {
            // Try to sort numerically if both are numbers
            const aNum = parseFloat(a);
            const bNum = parseFloat(b);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }
            // Otherwise sort alphabetically
            return a.localeCompare(b);
        }).forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            datalist.appendChild(option);
        });
    }
}

function addFilterToList() {
    const filterModal = document.getElementById('filter-modal');
    if (!filterModal) {
        return;
    }
    
    const layerName = filterModal.getAttribute('data-current-layer');
    const attribute = document.getElementById('filter-attribute')?.value;
    const operator = document.getElementById('filter-operator')?.value;
    const value1 = document.getElementById('filter-value')?.value;
    const value2 = document.getElementById('filter-value2')?.value;
    
    if (!attribute || !value1) {
        alert('Please select an attribute and enter a value');
        return;
    }
    
    // Store the filter for this specific layer
    if (!activeFilters[layerName]) {
        activeFilters[layerName] = {
            logic: 'AND',
            filters: []
        };
    }
    
    // Get current logic setting
    const filterLogic = document.getElementById('filter-logic')?.value || 'AND';
    activeFilters[layerName].logic = filterLogic;
    
    // Add new filter to the list
    const newFilter = {
        id: Date.now(), // Unique ID for this filter
        attribute: attribute,
        operator: operator,
        value1: value1,
        value2: value2
    };
    
    console.log('Adding filter:', newFilter);
    console.log('Layer name:', layerName);
    console.log('Camel case:', toCamelCase(layerName));
    
    activeFilters[layerName].filters.push(newFilter);
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Clear the form for next filter
    clearFilterForm();
}

function applyAllFilters() {
    const filterModal = document.getElementById('filter-modal');
    if (!filterModal) {
        return;
    }
    
    const layerName = filterModal.getAttribute('data-current-layer');
    
    // Apply all filters for this layer
    applyLayerFilters(layerName);
    
    // Don't close the modal - let user continue adding filters
    alert('Filters applied successfully!');
}

function clearFilterForm() {
    document.getElementById('filter-attribute').value = '';
    document.getElementById('filter-value').value = '';
    document.getElementById('filter-value2').value = '';
    document.getElementById('filter-controls').style.display = 'none';
    document.getElementById('filter-value2-group').style.display = 'none';
}

function applyAttributeFilter() {
    const filterModal = document.getElementById('filter-modal');
    if (!filterModal) {
        return;
    }
    
    const layerName = filterModal.getAttribute('data-current-layer');
    const attribute = document.getElementById('filter-attribute')?.value;
    const operator = document.getElementById('filter-operator')?.value;
    const value1 = document.getElementById('filter-value')?.value;
    const value2 = document.getElementById('filter-value2')?.value;
    
    if (!attribute || !value1) {
        alert('Please select an attribute and enter a value');
        return;
    }
    
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    
    if (layerGroup) {
        // Store the filter for this specific layer
        if (!activeFilters[layerName]) {
            activeFilters[layerName] = [];
        }
        
        // Remove existing filter for the same attribute to avoid conflicts
        activeFilters[layerName] = activeFilters[layerName].filter(f => f.attribute !== attribute);
        
        // Add new filter
        activeFilters[layerName].push({
            attribute: attribute,
            operator: operator,
            value1: value1,
            value2: value2
        });
        
        // Apply all filters for this layer
        applyLayerFilters(layerName);
        
        // Update active filters display
        updateActiveFiltersDisplay();
        
        // Close modal
        filterModal.style.display = 'none';
    }
}

function applyLayerFilters(layerName) {
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    const layerFilterData = activeFilters[layerName] || { logic: 'AND', filters: [] };
    
    console.log('=== Applying filters to layer:', layerName);
    console.log('Layer filter data:', layerFilterData);
    console.log('Layer group:', layerGroup);
    
    if (!layerGroup) {
        console.log('No layer group found for:', layerName);
        return;
    }
    
    let totalFeatures = 0;
    let visibleFeatures = 0;
    let hiddenFeatures = 0;
    
    // Function to recursively apply all filters to layers
    function applyFiltersToLayer(currentLayer) {
        if (currentLayer.getLayers) {
            // This is a layer group, apply filters to all sub-layers
            currentLayer.getLayers().forEach(subLayer => applyFiltersToLayer(subLayer));
        } else if (currentLayer.feature && currentLayer.feature.properties) {
            // This is a feature layer
            totalFeatures++;
            let showFeature = true;
            
            if (layerFilterData.filters.length > 0) {
                const filterResults = [];
                
                // Check each filter
                for (const filter of layerFilterData.filters) {
                    let searchAttribute = filter.attribute;
                    
                    console.log('Processing filter:', filter);
                    console.log('Original attribute:', searchAttribute);
                    
                    // Handle TCR attribute mapping
                    if (camelCaseId === 'tcrSchemes') {
                        searchAttribute = getOriginalTCRAttributeName(filter.attribute);
                        console.log('Mapped TCR attribute from', filter.attribute, 'to', searchAttribute);
                    }
                    
                    const propValue = currentLayer.feature.properties[searchAttribute];
                    console.log('Property value for', searchAttribute, ':', propValue);
                    console.log('Filter value:', filter.value1);
                    let passesFilter = false;
                    
                    switch (filter.operator) {
                        case 'equals':
                            // Make comparison case-insensitive for better matching
                            const filterValue = filter.value1.toString().toLowerCase();
                            const propValueStr = propValue ? propValue.toString().toLowerCase() : '';
                            passesFilter = propValueStr === filterValue;
                            console.log('Equals comparison result:', passesFilter, '(case-insensitive)');
                            break;
                        case 'contains':
                            passesFilter = propValue && propValue.toString().toLowerCase().includes(filter.value1.toLowerCase());
                            console.log('Contains comparison result:', passesFilter);
                            break;
                        case 'greater':
                            passesFilter = parseFloat(propValue) > parseFloat(filter.value1);
                            console.log('Greater comparison result:', passesFilter);
                            break;
                        case 'less':
                            passesFilter = parseFloat(propValue) < parseFloat(filter.value1);
                            console.log('Less comparison result:', passesFilter);
                            break;
                        case 'between':
                            const num = parseFloat(propValue);
                            passesFilter = num >= parseFloat(filter.value1) && num <= parseFloat(filter.value2);
                            console.log('Between comparison result:', passesFilter);
                            break;
                    }
                    
                    filterResults.push(passesFilter);
                }
                
                // Apply AND/OR logic
                if (layerFilterData.logic === 'AND') {
                    // ALL filters must pass
                    showFeature = filterResults.every(result => result === true);
                } else {
                    // ANY filter can pass (OR logic)
                    showFeature = filterResults.some(result => result === true);
                }
                
                console.log('Filter results:', filterResults, 'Show feature:', showFeature);
            }
            
            // Show or hide the feature based on filter results
            if (showFeature) {
                visibleFeatures++;
                // Make sure the layer is visible - restore original style
                if (currentLayer.setOpacity) {
                    currentLayer.setOpacity(1);
                }
                if (currentLayer.setStyle) {
                    // Store original style if not already stored
                    if (!currentLayer.options.originalStyle) {
                        currentLayer.options.originalStyle = {
                            opacity: currentLayer.options.opacity || 1,
                            fillOpacity: currentLayer.options.fillOpacity || 0.7,
                            weight: currentLayer.options.weight || 2,
                            color: currentLayer.options.color,
                            fillColor: currentLayer.options.fillColor
                        };
                    }
                    currentLayer.setStyle(currentLayer.options.originalStyle);
                }
                // Mark as visible for click detection
                currentLayer.options.filteredOut = false;
            } else {
                hiddenFeatures++;
                // Hide the layer completely by making it non-interactive and invisible
                console.log('Hiding feature layer');
                if (currentLayer.setStyle) {
                    // For polygon/line layers, make them completely invisible and non-interactive
                    currentLayer.setStyle({
                        opacity: 0,
                        fillOpacity: 0,
                        weight: 0,
                        interactive: false
                    });
                } else if (currentLayer.setOpacity) {
                    currentLayer.setOpacity(0);
                }
                // Mark as filtered out for click detection
                currentLayer.options.filteredOut = true;
                
                // Also try to disable mouse events
                if (currentLayer.off) {
                    currentLayer.off('click');
                    currentLayer.off('mouseover');
                    currentLayer.off('mouseout');
                }
            }
        }
    }
    
    // Apply filters to all layers in the group
    applyFiltersToLayer(layerGroup);
    
    console.log('Filter summary - Total:', totalFeatures, 'Visible:', visibleFeatures, 'Hidden:', hiddenFeatures);
}

function clearAllFilters() {
    // Clear all stored filters
    activeFilters = {};
    
    // Reset all layer visibility
    Object.values(layerGroups).forEach(layerGroup => {
        function resetLayerVisibility(currentLayer) {
            if (currentLayer.getLayers) {
                currentLayer.getLayers().forEach(subLayer => resetLayerVisibility(subLayer));
            } else if (currentLayer.feature && currentLayer.feature.properties) {
                // Reset layer visibility
                if (currentLayer.setOpacity) {
                    currentLayer.setOpacity(1);
                }
                if (currentLayer.setStyle) {
                    // Reset to original style
                    const originalStyle = currentLayer.options.originalStyle || {
                        opacity: 1,
                        fillOpacity: 0.7,
                        weight: 2,
                        interactive: true
                    };
                    currentLayer.setStyle(originalStyle);
                }
                // Clear the filtered out flag
                if (currentLayer.options) {
                    currentLayer.options.filteredOut = false;
                }
            }
        }
        layerGroup.eachLayer(resetLayerVisibility);
    });
    
    // Clear active filters display
    updateActiveFiltersDisplay();
}

function filterToVisibleExtent() {
    const bounds = map.getBounds();
    // Implementation for spatial filtering would go here
}

function clearSpatialFilter() {
    // Implementation for clearing spatial filters would go here
}

function updateActiveFiltersDisplay() {
    const activeFiltersList = document.getElementById('active-filters-list');
    if (!activeFiltersList) {
        return;
    }
    
    // Clear existing display
    activeFiltersList.innerHTML = '';
    
    let hasFilters = false;
    
    // Display filters for each layer
    Object.keys(activeFilters).forEach(layerName => {
        const layerFilterData = activeFilters[layerName];
        if (layerFilterData && layerFilterData.filters && layerFilterData.filters.length > 0) {
            hasFilters = true;
            
            // Create layer header with logic indicator
            const layerHeader = document.createElement('div');
            layerHeader.className = 'filter-layer-header';
            layerHeader.innerHTML = `
                <strong>${formatLayerName(toCamelCase(layerName))} (${layerFilterData.logic})</strong>
                <button class="clear-layer-filters" onclick="clearLayerFilters('${layerName}')" title="Clear all filters for this layer">Clear All</button>
            `;
            layerHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px 0;
                border-bottom: 1px solid #ddd;
                margin-bottom: 5px;
            `;
            activeFiltersList.appendChild(layerHeader);
            
            // Add individual filters
            layerFilterData.filters.forEach((filter, index) => {
                const filterText = `${filter.attribute} ${filter.operator} ${filter.value1}${filter.value2 ? ` and ${filter.value2}` : ''}`;
                const filterDiv = document.createElement('div');
                filterDiv.className = 'active-filter';
                filterDiv.innerHTML = `
                    <span>${filterText}</span>
                    <button onclick="removeFilterFromList('${layerName}', ${filter.id})" title="Remove this filter">×</button>
                `;
                filterDiv.style.cssText = `
                    margin-left: 10px;
                    margin-bottom: 3px;
                    padding: 3px 8px;
                    background-color: #f0f0f0;
                    border-radius: 3px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                
                const removeBtn = filterDiv.querySelector('button');
                removeBtn.style.cssText = `
                    background: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 2px 6px;
                    margin-left: 8px;
                    cursor: pointer;
                    font-size: 12px;
                `;
                
                activeFiltersList.appendChild(filterDiv);
            });
        }
    });
    
    if (!hasFilters) {
        activeFiltersList.innerHTML = '<p class="no-filters">No active filters</p>';
    }
}

// Function to remove a specific filter from the list
window.removeFilterFromList = function(layerName, filterId) {
    if (activeFilters[layerName] && activeFilters[layerName].filters) {
        activeFilters[layerName].filters = activeFilters[layerName].filters.filter(f => f.id !== filterId);
        
        // If no filters left, remove the layer from activeFilters
        if (activeFilters[layerName].filters.length === 0) {
            delete activeFilters[layerName];
        }
        
        updateActiveFiltersDisplay();
        applyLayerFilters(layerName);
    }
};

// Function to clear all filters for a specific layer
window.clearLayerFilters = function(layerName) {
    delete activeFilters[layerName];
    updateActiveFiltersDisplay();
    applyLayerFilters(layerName);
};

// Global functions for filter management
window.clearLayerFilters = function(layerName) {
    if (activeFilters[layerName]) {
        delete activeFilters[layerName];
        
        // Reset layer visibility
        const camelCaseId = toCamelCase(layerName);
        const layerGroup = layerGroups[camelCaseId];
        if (layerGroup) {
            function resetLayerVisibility(currentLayer) {
                if (currentLayer.getLayers) {
                    currentLayer.getLayers().forEach(subLayer => resetLayerVisibility(subLayer));
                } else if (currentLayer.setStyle) {
                    currentLayer.setStyle({ opacity: currentLayer.options.opacity || 1, fillOpacity: currentLayer.options.fillOpacity || 0.7 });
                }
            }
            layerGroup.eachLayer(resetLayerVisibility);
        }
        
        // Update display
        updateActiveFiltersDisplay();
    }
};

window.removeLayerFilter = function(layerName, filterIndex) {
    if (activeFilters[layerName] && activeFilters[layerName][filterIndex]) {
        // Remove the specific filter
        activeFilters[layerName].splice(filterIndex, 1);
        
        // If no filters remain for this layer, remove the layer entry
        if (activeFilters[layerName].length === 0) {
            delete activeFilters[layerName];
        }
        
        // Reapply remaining filters for this layer
        applyLayerFilters(layerName);
        
        // Update display
        updateActiveFiltersDisplay();
    }
};

function removeFilter(button, layerName) {
    // Legacy function - redirect to new system
    // This maintains compatibility with any existing calls
    if (activeFilters[layerName]) {
        clearLayerFilters(layerName);
    }
}

function toCamelCase(str) {
    return str.replace(/-([a-z])/g, function(match, letter) {
        return letter.toUpperCase();
    }).replace(/^-/, '');
}

// Function to rename TCR Schemes attributes
function renameTCRAttributes(properties) {
    const attributeMap = {
        'Id': 'Id',
        'MODE': null, // Remove this attribute
        'JLTP5_info': null, // Remove "Mappable" as requested
        'JLTP5_in_1': 'Assumptions',
        'JLTP5_in_2': 'Further info required for mapping',
        'JLTP5_in_3': 'Lead Organisation',
        'JLTP5_in_4': 'Partner Organisations',
        'JLTP5_in_5': 'Action',
        'JLTP5_in_6': 'Mode',
        'JLTP5_in_7': 'Type',
        'JLTP5_in_8': 'Source',
        'JLTP5_in_9': 'Delivery Scale',
        'JLTP5_in10': 'Cost',
        'JLTP5_in11': 'Funding already secured',
        'JLTP5_in12': 'Dependencies',
        'JLTP5_in13': 'Programme',
        'JLTP5_in14': 'Active Travel / LCWIP Package',
        'JLTP5_in15': 'CRSTS2',
        'JLTP5_in16': 'CRSTS2 Rationale',
        'JLTP5_in17': 'Notes / Comments',
        'JLTP5_in18': 'Overview',
        'JLTP5_in19': 'Package Ref',
        'JLTP5_in20': '-',
        'Name': 'Growth Zone'
    };
    
    const renamedProperties = {};
    
    Object.keys(properties).forEach(key => {
        if (attributeMap.hasOwnProperty(key)) {
            const newKey = attributeMap[key];
            if (newKey !== null) { // Only include if not marked for removal
                // Clean the value by removing � characters
                let cleanValue = properties[key];
                if (typeof cleanValue === 'string') {
                    cleanValue = cleanValue.replace(/�/g, '');
                }
                renamedProperties[newKey] = cleanValue;
            }
        } else {
            // Keep attributes not in the map as they are, but clean them
            let cleanValue = properties[key];
            if (typeof cleanValue === 'string') {
                cleanValue = cleanValue.replace(/�/g, '');
            }
            renamedProperties[key] = cleanValue;
        }
    });
    
    return renamedProperties;
}

// Function to get the original TCR attribute name from the renamed one
function getOriginalTCRAttributeName(renamedAttribute) {
    const reverseAttributeMap = {
        'Id': 'Id',
        'Assumptions': 'JLTP5_in_1',
        'Further info required for mapping': 'JLTP5_in_2',
        'Lead Organisation': 'JLTP5_in_3',
        'Partner Organisations': 'JLTP5_in_4',
        'Action': 'JLTP5_in_5',
        'Mode': 'JLTP5_in_6',
        'Type': 'JLTP5_in_7',
        'Source': 'JLTP5_in_8',
        'Delivery Scale': 'JLTP5_in_9',
        'Cost': 'JLTP5_in10',
        'Funding already secured': 'JLTP5_in11',
        'Dependencies': 'JLTP5_in12',
        'Programme': 'JLTP5_in13',
        'Active Travel / LCWIP Package': 'JLTP5_in14',
        'CRSTS2': 'JLTP5_in15',
        'CRSTS2 Rationale': 'JLTP5_in16',
        'Notes / Comments': 'JLTP5_in17',
        'Overview': 'JLTP5_in18',
        'Package Ref': 'JLTP5_in19',
        '-': 'JLTP5_in20'
    };
    
    return reverseAttributeMap[renamedAttribute] || renamedAttribute;
}

// Function to create popup content showing specific attributes per layer
function createFullPopupContent(feature, groupName, layerTitle = null) {
    let properties = feature.properties || {};
    
    // Apply TCR attribute renaming if this is a TCR layer
    if (groupName === 'tcrSchemes') {
        properties = renameTCRAttributes(properties);
    }
    
    // Define which attributes to show for each layer
    const layerAttributeFilters = {
        'growthZones': ['Name', 'GrowthType'],
        'housing': ['Path'], // Exclude Path - show all others
        'ptal': ['GRID_ID', 'PTAI', 'PTAL'],
        'railStations': ['XCoord', 'YCoord'], // Exclude XCoord and YCoord - show all others
        'busLines': ['TUEAM', 'TUEBP', 'TUEEP', 'TUEOP', 'SATAM', 'SATBP', 'SATEP', 'SATOP', 'SUNAM', 'SUNBP', 'SUNEP', 'SUNOP'], // Only show these
        'busStops': ['X', 'Y'] // Exclude X and Y - show all others
    };
    
    // Custom attribute display names
    const attributeDisplayNames = {
        'TUEAM': 'Weekday AM Peak',
        'TUEBP': 'Weekday Between Peaks',
        'TUEEP': 'Weekday Evening Peak',
        'TUEOP': 'Weekday Outside Peak',
        'SATAM': 'Saturday AM Peak',
        'SATBP': 'Saturday Between Peaks',
        'SATEP': 'Saturday Evening Peak',
        'SATOP': 'Saturday Outside Peak',
        'SUNAM': 'Sunday AM Peak',
        'SUNBP': 'Sunday Between Peaks',
        'SUNEP': 'Sunday Evening Peak',
        'SUNOP': 'Sunday Outside Peak',
        'Freq_AM': 'AM Frequency',
        'Freq_IP': 'IP Frequency',
        'Freq_PM': 'PM Frequency',
        'Freq_Night': 'OP Frequency'
    };
    
    // Filter properties based on layer type
    let filteredProperties = {};
    
    if (layerAttributeFilters[groupName]) {
        if (groupName === 'growthZones' || groupName === 'ptal' || groupName === 'busLines') {
            // For these layers, only show specified attributes
            layerAttributeFilters[groupName].forEach(attr => {
                if (properties.hasOwnProperty(attr)) {
                    filteredProperties[attr] = properties[attr];
                }
            });
        } else if (groupName === 'housing' || groupName === 'railStations' || groupName === 'busStops') {
            // For these layers, exclude specified attributes
            Object.keys(properties).forEach(key => {
                if (!layerAttributeFilters[groupName].includes(key)) {
                    filteredProperties[key] = properties[key];
                }
            });
        }
    } else {
        // For other layers (busLines, busStops, tcrSchemes), show all attributes
        filteredProperties = properties;
    }
    
    let popupContent = '<div class="taf-popup">';
    popupContent += `<div class="popup-header">${layerTitle || formatLayerName(groupName)}</div>`;
    popupContent += '<table class="popup-table">';
    
    if (Object.keys(filteredProperties).length > 0) {
        Object.keys(filteredProperties).forEach(key => {
            const value = filteredProperties[key];
            if (value !== null && value !== undefined && value !== '') {
                // Custom display names for specific attributes
                let displayName = key;
                if (attributeDisplayNames[key]) {
                    displayName = attributeDisplayNames[key];
                } else if (key === 'Name' && groupName === 'growthZones') {
                    displayName = 'Name';
                } else if (key === 'GrowthType' && groupName === 'growthZones') {
                    displayName = 'Growth Type';
                } else {
                    displayName = formatPropertyName(key);
                }
                
                popupContent += `<tr><td><strong>${displayName}:</strong></td><td>${formatPropertyValue(value)}</td></tr>`;
            }
        });
    } else {
        popupContent += '<tr><td colspan="2">No attribute data available</td></tr>';
    }
    
    popupContent += '</table></div>';
    return popupContent;
}

// Function to transform British National Grid coordinates to WGS84 using proj4
function transformCoordinates(coords) {
    // Define British National Grid (EPSG:27700) projection
    proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs');
    
    // Check if coordinates are already in WGS84 (rough check)
    if (coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90) {
        // Already in WGS84, return as is
        return coords;
    }
    
    // Transform from British National Grid to WGS84
    const transformed = proj4('EPSG:27700', 'EPSG:4326', coords);
    return [transformed[1], transformed[0]]; // Return as [lat, lng] for Leaflet
}

// Function to detect coordinate system and transform GeoJSON coordinates
function transformGeoJSON(geojson) {
    const transformed = JSON.parse(JSON.stringify(geojson));
    
    transformed.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
            const coords = feature.geometry.coordinates;
            // Check if coordinates are already in WGS84 (longitude, latitude)
            if (coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90) {
                // Already in WGS84, keep as is [lng, lat]
                feature.geometry.coordinates = coords;
            } else {
                // Transform from projected coordinates
                const transformedCoords = transformCoordinates(coords);
                feature.geometry.coordinates = [transformedCoords[1], transformedCoords[0]]; // [lng, lat] for GeoJSON
            }
        } else if (feature.geometry.type === 'MultiLineString') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(lineString =>
                lineString.map(coord => {
                    if (coord[0] >= -180 && coord[0] <= 180 && coord[1] >= -90 && coord[1] <= 90) {
                        return coord; // Already in WGS84
                    } else {
                        const transformed = transformCoordinates(coord);
                        return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                    }
                })
            );
        } else if (feature.geometry.type === 'LineString') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(coord => {
                if (coord[0] >= -180 && coord[0] <= 180 && coord[1] >= -90 && coord[1] <= 90) {
                    return coord; // Already in WGS84
                } else {
                    const transformed = transformCoordinates(coord);
                    return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                }
            });
        } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(ring =>
                ring.map(coord => {
                    if (coord[0] >= -180 && coord[0] <= 180 && coord[1] >= -90 && coord[1] <= 90) {
                        return coord; // Already in WGS84
                    } else {
                        const transformed = transformCoordinates(coord);
                        return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                    }
                })
            );
        } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(polygon =>
                polygon.map(ring => ring.map(coord => {
                    if (coord[0] >= -180 && coord[0] <= 180 && coord[1] >= -90 && coord[1] <= 90) {
                        return coord; // Already in WGS84
                    } else {
                        const transformed = transformCoordinates(coord);
                        return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                    }
                }))
            );
        }
    });
    
    return transformed;
}

async function loadSampleData() {
    // Load priority layers first (visible by default)
    await Promise.all([
        loadGrowthZones(),
        loadHousingData(),
        loadRailStations(),
        loadTCRSchemesData()
    ]);
    
    // Heavy layers (PTAL, Bus Lines, Bus Stops) will only load when user checks them on
}

// Load Growth Zones data
async function loadGrowthZones() {
    try {
        const response = await fetch('./data/growth-zones.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        const convertedData = convertMultiPolygonToPolygons(transformedData);
        
        L.geoJSON(convertedData, {
            style: {
                fillColor: 'transparent', // transparent fill
                weight: 2,
                opacity: 1,
                color: '#000', // black outline
                fillOpacity: 0 // no fill
            },
            onEachFeature: function(feature, layer) {
                // Store the feature on the layer for popup access
                layer.feature = feature;
            }
        }).addTo(layerGroups.growthZones);
    } catch (error) {
    }
}

// Load Housing data
async function loadHousingData() {
    try {
        const response = await fetch('./data/housing.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        const convertedData = convertMultiPolygonToPolygons(transformedData);
        
        // Filter properties to only keep Fid, Id and Layer fields
        const filteredData = {
            ...convertedData,
            features: convertedData.features.map(feature => ({
                ...feature,
                properties: {
                    Fid: feature.properties.Fid || feature.properties.fid || feature.properties.FID,
                    Id: feature.properties.Id || feature.properties.id || feature.properties.ID,
                    Layer: feature.properties.Layer || feature.properties.layer || feature.properties.LAYER
                }
            }))
        };
        
        L.geoJSON(filteredData, {
            style: {
                fillColor: 'transparent',
                weight: 1,
                opacity: 1,
                color: '#000', // black outline
                fillOpacity: 0
            },
            onEachFeature: function(feature, layer) {
                // Store the feature on the layer for popup access
                layer.feature = feature;
            }
        }).addTo(layerGroups.housing);
    } catch (error) {
    }
}

// Load PTAL data
async function loadPTALData() {
    try {
        const response = await fetch('./data/ptal.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        const convertedData = convertMultiPolygonToPolygons(transformedData);
        
        // Define PTAL categories and their colors
        const ptalCategories = {
            '0': '#08306b',
            '1a': '#08306b',
            '1b': '#2171b5',
            '2': '#6baed6',
            '3': '#31a354',
            '4': '#fed976',
            '5': '#fd8d3c',
            '6a': '#e31a1c',
            '6b': '#99000d'
        };
        
        L.geoJSON(convertedData, {
            style: function(feature) {
                const ptal = (feature.properties.PTAL || feature.properties.ptal || '').toString().toLowerCase();
                const fillColor = ptalCategories[ptal] || '#b2df8a';
                
                return {
                    fillColor: fillColor,
                    weight: 0,
                    opacity: 0,
                    color: 'transparent',
                    fillOpacity: 0.7
                };
            },
            onEachFeature: function(feature, layer) {
                // Popup handling is managed by the central multi-layer popup system
            }
        }).addTo(layerGroups.ptal);
    } catch (error) {
    }
}

function createSampleGrowthZones() {
    const growthZones = [
        {
            name: "Bristol Temple Quarter",
            coordinates: [[51.4490, -2.5766], [51.4495, -2.5750], [51.4485, -2.5740], [51.4480, -2.5756], [51.4490, -2.5766]],
            properties: { area: "125 hectares", status: "Active", housing_units: 2500 }
        },
        {
            name: "Bath Riverside",
            coordinates: [[51.3835, -2.3590], [51.3845, -2.3575], [51.3840, -2.3560], [51.3830, -2.3575], [51.3835, -2.3590]],
            properties: { area: "45 hectares", status: "Planning", housing_units: 800 }
        },
        {
            name: "Weston-super-Mare Seafront",
            coordinates: [[51.3460, -2.9775], [51.3470, -2.9760], [51.3465, -2.9745], [51.3455, -2.9760], [51.3460, -2.9775]],
            properties: { area: "80 hectares", status: "Active", housing_units: 1200 }
        }
    ];

    growthZones.forEach(zone => {
        const polygon = L.polygon(zone.coordinates, {
            color: '#ff6b6b',
            fillColor: '#ff6b6b',
            fillOpacity: 0.3,
            weight: 2
        });
        
        const popupContent = `
            <h4>${zone.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Area</td><td>${zone.properties.area}</td></tr>
                <tr><td>Status</td><td>${zone.properties.status}</td></tr>
                <tr><td>Planned Housing</td><td>${zone.properties.housing_units} units</td></tr>
            </table>
        `;
        
        // Popup handling is managed by the central multi-layer popup system
        layerGroups.growthZones.addLayer(polygon);
    });
}

function createSampleHousing() {
    const housingAreas = [
        { name: "Knowle West", coords: [51.4200, -2.6200], units: 850, type: "Social Housing" },
        { name: "Lawrence Weston", coords: [51.4950, -2.6550], units: 650, type: "Mixed Development" },
        { name: "Stockwood", coords: [51.4100, -2.5400], units: 420, type: "Private Housing" },
        { name: "Bath City Centre", coords: [51.3751, -2.3597], units: 300, type: "Apartments" },
        { name: "Weston Village", coords: [51.3200, -2.9500], units: 750, type: "New Build Estate" }
    ];

    housingAreas.forEach(area => {
        const circle = L.circle(area.coords, {
            color: '#4ecdc4',
            fillColor: '#4ecdc4',
            fillOpacity: 0.5,
            radius: Math.sqrt(area.units) * 20
        });
        
        const popupContent = `
            <h4>${area.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Housing Units</td><td>${area.units}</td></tr>
                <tr><td>Type</td><td>${area.type}</td></tr>
            </table>
        `;
        
        // Popup handling is managed by the central multi-layer popup system
        layerGroups.housing.addLayer(circle);
    });
}

function createSamplePTAL() {
    const ptalAreas = [
        { coords: [51.4584, -2.5879], level: 6, area: "Bristol City Centre" },
        { coords: [51.3758, -2.3597], level: 5, area: "Bath City Centre" },
        { coords: [51.3406, -2.9772], level: 4, area: "Weston-super-Mare Centre" },
        { coords: [51.4889, -2.6303], level: 3, area: "Avonmouth" },
        { coords: [51.5200, -2.5000], level: 2, area: "Thornbury" }
    ];

    ptalAreas.forEach(area => {
        const colors = ['#8B0000', '#FF0000', '#FF8C00', '#FFD700', '#90EE90', '#00FF00'];
        const color = colors[area.level - 1] || '#CCCCCC';
        
        const circle = L.circle(area.coords, {
            color: color,
            fillColor: color,
            fillOpacity: 0.4,
            radius: 1500,
            weight: 2
        });
        
        const popupContent = `
            <h4>PTAL Level ${area.level}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Area</td><td>${area.area}</td></tr>
                <tr><td>Accessibility</td><td>${area.level >= 5 ? 'Excellent' : area.level >= 3 ? 'Good' : 'Moderate'}</td></tr>
            </table>
        `;
        
        // Popup handling is managed by the central multi-layer popup system
        layerGroups.ptal.addLayer(circle);
    });
}

async function loadRailStations() {
    try {
        // Load Rail Stations only
        const railStationsResponse = await fetch('data/rail_stations.geojson');
        const railStationsData = await railStationsResponse.json();
        const transformedRailStations = transformGeoJSON(railStationsData);
        
        const railStationsLayer = L.geoJSON(transformedRailStations, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    color: '#8B4513', // brown
                    fillColor: '#8B4513',
                    fillOpacity: 1,
                    radius: 5,
                    weight: 2
                });
            },
            onEachFeature: function(feature, layer) {
                // Store the feature on the layer for popup access
                layer.feature = feature;
            }
        });
        layerGroups.railStations.addLayer(railStationsLayer);

    } catch (error) {
    }
}

// Load PTAL data asynchronously in chunks to avoid freezing UI
async function loadPTALDataAsync() {
    try {
        showLoadingIndicator('Loading PTAL data...');
        
        const response = await fetch('./data/ptal.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        const convertedData = convertMultiPolygonToPolygons(transformedData);
        
        // Define PTAL categories and their colors
        const ptalCategories = {
            '0': '#08306b',
            '1a': '#08306b',
            '1b': '#2171b5',
            '2': '#6baed6',
            '3': '#31a354',
            '4': '#fed976',
            '5': '#fd8d3c',
            '6a': '#e31a1c',
            '6b': '#99000d'
        };
        
        // Process features in chunks to avoid blocking the UI
        const chunkSize = 50; // Process 50 features at a time
        const features = convertedData.features;
        
        for (let i = 0; i < features.length; i += chunkSize) {
            const chunk = features.slice(i, i + chunkSize);
            
            // Process this chunk
            const chunkGeoJSON = {
                type: 'FeatureCollection',
                features: chunk
            };
            
            const chunkLayer = L.geoJSON(chunkGeoJSON, {
                style: function(feature) {
                    const ptal = (feature.properties.PTAL || feature.properties.ptal || '').toString().toLowerCase();
                    const fillColor = ptalCategories[ptal] || '#b2df8a';
                    
                    return {
                        fillColor: fillColor,
                        weight: 0,
                        opacity: 0,
                        color: 'transparent',
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: function(feature, layer) {
                    // Popup handling is managed by the central multi-layer popup system
                }
            });
            
            layerGroups.ptal.addLayer(chunkLayer);
            
            // Yield control back to the browser between chunks using requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Update progress
            const progress = Math.round(((i + chunkSize) / features.length) * 100);
        }
        
        hideLoadingIndicator();
    } catch (error) {
        hideLoadingIndicator();
    }
}

// Load bus lines data asynchronously on-demand
async function loadBusLinesAsync() {
    try {
        showLoadingIndicator('Loading bus lines data...');
        
        const busLinesResponse = await fetch('data/bus-lines.geojson');
        const busLinesData = await busLinesResponse.json();
        const transformedBusLines = transformGeoJSON(busLinesData);
        
        // Process bus lines in chunks
        const chunkSize = 25;
        const busFeatures = transformedBusLines.features;
        
        for (let i = 0; i < busFeatures.length; i += chunkSize) {
            const chunk = busFeatures.slice(i, i + chunkSize);
            const chunkGeoJSON = { type: 'FeatureCollection', features: chunk };
            
            const chunkLayer = L.geoJSON(chunkGeoJSON, {
                style: {
                    color: '#008000', // green
                    weight: 2,
                    opacity: 1
                },
                onEachFeature: function(feature, layer) {
                    // Popup handling is managed by the central multi-layer popup system
                }
            });
            
            layerGroups.busLines.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        hideLoadingIndicator();
    } catch (error) {
        hideLoadingIndicator();
    }
}

// Load bus stops data asynchronously on-demand
async function loadBusStopsAsync() {
    try {
        showLoadingIndicator('Loading bus stops data...');
        
        const busStopsResponse = await fetch('data/bus-stops.geojson');
        const busStopsData = await busStopsResponse.json();
        const transformedBusStops = transformGeoJSON(busStopsData);
        
        // Process bus stops in chunks
        const chunkSize = 25;
        const stopFeatures = transformedBusStops.features;
        
        for (let i = 0; i < stopFeatures.length; i += chunkSize) {
            const chunk = stopFeatures.slice(i, i + chunkSize);
            const chunkGeoJSON = { type: 'FeatureCollection', features: chunk };
            
            const chunkLayer = L.geoJSON(chunkGeoJSON, {
                pointToLayer: function(feature, latlng) {
                    return L.circleMarker(latlng, {
                        color: '#008000', // green
                        fillColor: '#008000',
                        fillOpacity: 1,
                        radius: 4,
                        weight: 1
                    });
                },
                onEachFeature: function(feature, layer) {
                    // Popup handling is managed by the central multi-layer popup system
                }
            });
            
            layerGroups.busStops.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        hideLoadingIndicator();
    } catch (error) {
        hideLoadingIndicator();
    }
}

// Load bus infrastructure asynchronously in chunks
async function loadBusInfrastructureAsync() {
    try {
        showLoadingIndicator('Loading bus infrastructure...');
        
        // Load Bus Lines first
        const busLinesResponse = await fetch('data/bus-lines.geojson');
        const busLinesData = await busLinesResponse.json();
        const transformedBusLines = transformGeoJSON(busLinesData);
        
        // Process bus lines in chunks
        const chunkSize = 25;
        const busFeatures = transformedBusLines.features;
        
        for (let i = 0; i < busFeatures.length; i += chunkSize) {
            const chunk = busFeatures.slice(i, i + chunkSize);
            const chunkGeoJSON = { type: 'FeatureCollection', features: chunk };
            
            const chunkLayer = L.geoJSON(chunkGeoJSON, {
                style: {
                    color: '#008000', // green
                    weight: 2,
                    opacity: 1
                },
                onEachFeature: function(feature, layer) {
                    // Popup handling is managed by the central multi-layer popup system
                }
            });
            
            layerGroups.busLines.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
                
        // Load Bus Stops
        const busStopsResponse = await fetch('data/bus-stops.geojson');
        const busStopsData = await busStopsResponse.json();
        const transformedBusStops = transformGeoJSON(busStopsData);
        
        // Process bus stops in chunks
        const stopFeatures = transformedBusStops.features;
        
        for (let i = 0; i < stopFeatures.length; i += chunkSize) {
            const chunk = stopFeatures.slice(i, i + chunkSize);
            const chunkGeoJSON = { type: 'FeatureCollection', features: chunk };
            
            const chunkLayer = L.geoJSON(chunkGeoJSON, {
                pointToLayer: function(feature, latlng) {
                    return L.circleMarker(latlng, {
                        color: '#008000', // green
                        fillColor: '#008000',
                        fillOpacity: 1,
                        radius: 4,
                        weight: 1
                    });
                },
                onEachFeature: function(feature, layer) {
                    // Popup handling is managed by the central multi-layer popup system
                }
            });
            
            layerGroups.busStops.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        hideLoadingIndicator();
    } catch (error) {
        hideLoadingIndicator();
    }
}

async function loadTransportInfrastructure() {
    // Legacy function - now split into separate functions
    await loadRailStations();
    await loadBusInfrastructure();
}

async function loadTCRSchemesData() {
    try {
        // Load TCR Points
        const tcrPointsResponse = await fetch('data/schemes_pt.geojson');
        const tcrPointsData = await tcrPointsResponse.json();
        const transformedTCRPoints = transformGeoJSON(tcrPointsData);
        
        const tcrPointsLayer = L.geoJSON(transformedTCRPoints, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    color: '#ff00ff', // magenta
                    fillColor: '#ff00ff',
                    fillOpacity: 1,
                    radius: 3,
                    weight: 0.5
                });
            },
            onEachFeature: function(feature, layer) {
                // Store the feature on the layer for popup access
                layer.feature = feature;
            }
        });
        layerGroups.tcrSchemes.addLayer(tcrPointsLayer);

        // Load TCR Lines
        const tcrLinesResponse = await fetch('data/schemes_ln.geojson');
        const tcrLinesData = await tcrLinesResponse.json();
        const transformedTCRLines = transformGeoJSON(tcrLinesData);
        
        const tcrLinesLayer = L.geoJSON(transformedTCRLines, {
            style: {
                color: '#ff00ff', // magenta
                weight: 0.5,
                opacity: 1,
                dashArray: '2, 2'
            },
            onEachFeature: function(feature, layer) {
                // Store the feature on the layer for popup access
                layer.feature = feature;
            }
        });
        layerGroups.tcrSchemes.addLayer(tcrLinesLayer);

        // Load TCR Polygons
        const tcrPolygonsResponse = await fetch('data/schemes_pg.geojson');
        const tcrPolygonsData = await tcrPolygonsResponse.json();
        const transformedTCRPolygons = transformGeoJSON(tcrPolygonsData);
        const convertedTCRPolygons = convertMultiPolygonToPolygons(transformedTCRPolygons);
        
        const tcrPolygonsLayer = L.geoJSON(convertedTCRPolygons, {
            style: {
                color: '#ff00ff', // magenta
                fillColor: 'transparent',
                fillOpacity: 0,
                weight: 0.5,
                dashArray: '2, 2'
            },
            onEachFeature: function(feature, layer) {
                // Store the feature on the layer for popup access
                layer.feature = feature;
            }
        });
        layerGroups.tcrSchemes.addLayer(tcrPolygonsLayer);

    } catch (error) {
    }
}

// Add loading indicator
function showLoadingIndicator(message = 'Loading map data...') {
    // Remove any existing indicator
    hideLoadingIndicator();
    
    const mapElement = document.getElementById('map');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-indicator';
    loadingDiv.id = 'loading-indicator';
    loadingDiv.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>${message}`;
    loadingDiv.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 10px;
        background: rgba(255, 255, 255, 0.95);
        padding: 10px 15px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        font-family: 'Trebuchet MS', sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 1500;
        color: #333;
        border-left: 4px solid #4CAF50;
        max-width: 250px;
        word-wrap: break-word;
        display: flex;
        align-items: center;
    `;
    mapElement.appendChild(loadingDiv);
}

function hideLoadingIndicator() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Function to make popup draggable
function makePopupDraggable(popup) {
    console.log('makePopupDraggable called');
    const popupElement = popup.getElement();
    if (!popupElement) {
        console.log('No popup element found');
        return;
    }
    
    const wrapper = popupElement.querySelector('.leaflet-popup-content-wrapper');
    if (!wrapper) {
        console.log('No popup wrapper found');
        return;
    }
    
    console.log('Popup dragging setup initiated');
    let isDragging = false;
    let startX, startY, startLatLng;
    let dragThreshold = 5; // Minimum pixel movement to start dragging
    let hasMoved = false;
    
    // Add mousedown event listener
    wrapper.addEventListener('mousedown', function(e) {
        console.log('Popup mousedown event triggered');
        // Don't start dragging if clicking on buttons or interactive elements
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || 
            e.target.classList.contains('leaflet-popup-close-button')) {
            console.log('Mousedown on interactive element, ignoring');
            return;
        }
        
        console.log('Starting drag operation');
        startX = e.clientX;
        startY = e.clientY;
        startLatLng = popup.getLatLng();
        hasMoved = false;
        
        // Prevent text selection and default behavior
        e.preventDefault();
        e.stopPropagation();
        
        // Add temporary event listeners for mousemove and mouseup
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Prevent map interactions during potential drag
        map.dragging.disable();
    });
    
    function handleMouseMove(e) {
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);
        
        // Check if we've moved enough to start dragging
        if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
            isDragging = true;
            wrapper.style.cursor = 'grabbing';
            hasMoved = true;
        }
        
        if (isDragging) {
            const totalDeltaX = e.clientX - startX;
            const totalDeltaY = e.clientY - startY;
            
            // Convert pixel movement to lat/lng movement
            const mapBounds = map.getBounds();
            const mapSize = map.getSize();
            
            const latDelta = (totalDeltaY / mapSize.y) * (mapBounds.getNorth() - mapBounds.getSouth());
            const lngDelta = (totalDeltaX / mapSize.x) * (mapBounds.getEast() - mapBounds.getWest());
            
            const newLatLng = L.latLng(
                startLatLng.lat - latDelta,
                startLatLng.lng + lngDelta
            );
            
            popup.setLatLng(newLatLng);
        }
    }
    
    function handleMouseUp(e) {
        // Remove temporary event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Re-enable map dragging
        map.dragging.enable();
        
        if (isDragging) {
            isDragging = false;
            wrapper.style.cursor = 'move';
        }
        
        // If we haven't moved much, treat it as a click rather than a drag
        if (!hasMoved) {
            // Allow the click to propagate normally
            wrapper.style.cursor = 'move';
        }
    }
}

// Export functions for potential external use
window.mapFunctions = {
    map,
    layerGroups
};
