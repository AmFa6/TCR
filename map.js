// Initialize the map with TAF-style design
let map;
let layerGroups = {};
let activeFilters = {}; // Store active filters per layer

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

// Global variables for multi-layer popup system
let currentPopupLayers = [];
let currentPopupIndex = 0;
let activePopup = null;

function setupMultiLayerPopups() {
    // Override the default popup behavior with higher priority
    map.on('click', function(e) {
        handleMapClick(e);
    });
}

function handleMapClick(e) {
    // Clear any existing popup
    map.closePopup();
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

function findLayersAtPoint(latlng, point) {
    const foundLayers = [];
    
    // Iterate through all active layer groups
    Object.keys(layerGroups).forEach(groupName => {
        const layerGroup = layerGroups[groupName];
        
        // Only search layers that are currently visible on the map
        if (map.hasLayer(layerGroup)) {
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
        } else if (layer.feature || layer instanceof L.Marker || layer instanceof L.CircleMarker) {
            // Check if this layer contains the click point
            if (isLayerAtPoint(layer, latlng, point)) {
                // For layers without feature property, create a basic feature object
                const feature = layer.feature || {
                    properties: {
                        'Layer Type': layer.constructor.name,
                        'Coordinates': layer.getLatLng ? `${layer.getLatLng().lat.toFixed(5)}, ${layer.getLatLng().lng.toFixed(5)}` : 'N/A'
                    }
                };
                
                foundLayers.push({
                    layer: layer,
                    groupName: groupName,
                    feature: feature
                });
            }
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
            return isPointInPolygon(latlng, layer.getLatLngs());
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
        console.warn('Error checking if layer is at point:', error);
        return false;
    }
    
    return false;
}

function isPointInPolygon(point, polygon) {
    // Handle nested arrays (polygons with holes)
    const coords = Array.isArray(polygon[0]) ? polygon[0] : polygon;
    
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        if (((coords[i].lat > point.lat) !== (coords[j].lat > point.lat)) &&
            (point.lng < (coords[j].lng - coords[i].lng) * (point.lat - coords[i].lat) / (coords[j].lat - coords[i].lat) + coords[i].lng)) {
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

function showPopupAtIndex(index, latlng) {
    if (index < 0 || index >= currentPopupLayers.length) {
        return;
    }
    
    const layerInfo = currentPopupLayers[index];
    const feature = layerInfo.feature;
    const groupName = layerInfo.groupName;
    
    // Use the standardized popup content creation function
    let popupContent = createFullPopupContent(feature, groupName);
    
    // Add navigation header if multiple layers
    if (currentPopupLayers.length > 1) {
        // Insert navigation controls at the beginning of the popup content
        const navigationHTML = `
            <div style="background: #f8f9fa; padding: 8px; margin-bottom: 10px; border-bottom: 1px solid #dee2e6; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <strong style="color: #495057; font-size: 12px;">${formatLayerName(groupName)}</strong>
                    <div style="font-size: 11px; color: #6c757d;">
                        ${index + 1} of ${currentPopupLayers.length}
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="previousPopup()" ${index === 0 ? 'disabled' : ''} 
                            style="background: #007bff; color: white; border: none; padding: 3px 8px; border-radius: 3px; font-size: 11px; cursor: ${index === 0 ? 'not-allowed' : 'pointer'};">
                        ← Prev
                    </button>
                    <button onclick="nextPopup()" ${index === currentPopupLayers.length - 1 ? 'disabled' : ''} 
                            style="background: #007bff; color: white; border: none; padding: 3px 8px; border-radius: 3px; font-size: 11px; cursor: ${index === currentPopupLayers.length - 1 ? 'not-allowed' : 'pointer'};">
                        Next →
                    </button>
                </div>
            </div>
        `;
        
        // Insert navigation before the popup header
        popupContent = popupContent.replace('<div class="popup-header">', navigationHTML + '<div class="popup-header">');
    }
    
    // Create and show popup
    activePopup = L.popup({
        maxWidth: 300,
        className: 'multi-layer-popup'
    })
    .setLatLng(latlng)
    .setContent(popupContent)
    .openOn(map);
}

function formatLayerName(groupName) {
    const nameMap = {
        'growthZones': 'Growth Zones',
        'housing': 'Housing',
        'ptal': 'PTAL',
        'busLines': 'Bus Lines',
        'busStops': 'Bus Stops',
        'railStations': 'Rail Stations',
        'tcrSchemes': 'CRSTS2 Schemes'
    };
    return nameMap[groupName] || groupName;
}

function formatPropertyName(key) {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ');
}

function formatPropertyValue(value) {
    if (typeof value === 'number') {
        return value.toLocaleString();
    }
    return value;
}

// Global functions for popup navigation (called from popup buttons)
window.previousPopup = function() {
    if (currentPopupIndex > 0) {
        currentPopupIndex--;
        showPopupAtIndex(currentPopupIndex, activePopup.getLatLng());
    }
};

window.nextPopup = function() {
    if (currentPopupIndex < currentPopupLayers.length - 1) {
        currentPopupIndex++;
        showPopupAtIndex(currentPopupIndex, activePopup.getLatLng());
    }
};

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
                            console.log('Loading PTAL data on-demand...');
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
                            console.log('Loading bus lines data on-demand...');
                            loadBusLinesAsync().then(() => {
                                map.addLayer(layerGroups.busLines);
                            });
                        } else {
                            map.addLayer(layerGroups.busLines);
                        }
                    } else if (layerId === 'bus-stops') {
                        // Check if bus stops data is already loaded
                        if (layerGroups.busStops.getLayers().length === 0) {
                            console.log('Loading bus stops data on-demand...');
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
    
    // Setup styling modal
    setupStylingModal();
    setupFilterModal();
    setupLayerIcons();
}

function setupStylingModal() {
    const modal = document.getElementById('styling-modal');
    const closeBtn = document.querySelector('.close');
    
    if (!modal || !closeBtn) {
        console.warn('Styling modal elements not found, skipping setup');
        return;
    }
    
    // Close modal when clicking X or outside
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Add click handlers for legend elements
    const ptalColorScale = document.getElementById('ptal-color-scale');
    if (ptalColorScale) {
        ptalColorScale.addEventListener('click', () => {
            const modalTitle = document.getElementById('modal-title');
            if (modalTitle) {
                modalTitle.textContent = 'PTAL Styling';
            }
            modal.style.display = 'block';
        });
    }
    
    // Opacity slider handler
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', (e) => {
            opacityValue.textContent = Math.round(e.target.value * 100) + '%';
        });
    }
    
    // Size slider handler
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    if (sizeSlider && sizeValue) {
        sizeSlider.addEventListener('input', (e) => {
            sizeValue.textContent = e.target.value;
        });
    }
    
    // Classification method handler
    const classificationMethod = document.getElementById('classification-method');
    const graduatedOptions = document.getElementById('graduated-options');
    if (classificationMethod && graduatedOptions) {
        classificationMethod.addEventListener('change', (e) => {
            graduatedOptions.style.display = e.target.value === 'graduated' ? 'block' : 'none';
        });
    }
    
    // Apply styling button
    const applyButton = document.getElementById('apply-styling');
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            applyStyling();
            modal.style.display = 'none';
        });
    }
    
    // Reset styling button
    const resetButton = document.getElementById('reset-styling');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            resetStyling();
            modal.style.display = 'none';
        });
    }
}

function applyStyling() {
    const opacity = parseFloat(document.getElementById('opacity-slider').value);
    const size = parseFloat(document.getElementById('size-slider').value);
    const colorScheme = document.getElementById('color-scheme').value;
    
    // Update PTAL styling
    if (layerGroups.ptal) {
        layerGroups.ptal.eachLayer(layer => {
            if (layer.setStyle) {
                const currentStyle = layer.options;
                layer.setStyle({
                    ...currentStyle,
                    fillOpacity: opacity,
                    weight: size * 0.5,
                    opacity: opacity
                });
            }
        });
    }
    
    // Update color scheme if changed
    if (colorScheme !== 'blue-red') {
        updateColorScheme(colorScheme);
    }
}

function resetStyling() {
    // Reset sliders to default values
    document.getElementById('opacity-slider').value = 0.7;
    document.getElementById('size-slider').value = 2;
    document.getElementById('color-scheme').value = 'blue-red';
    document.getElementById('opacity-value').textContent = '70%';
    document.getElementById('size-value').textContent = '2';
    
    // Reload PTAL data to reset styling
    if (layerGroups.ptal) {
        layerGroups.ptal.clearLayers();
        loadPTALData();
    }
}

function updateColorScheme(scheme) {
    const colorSchemes = {
        'viridis': ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58'],
        'plasma': ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a'],
        'cool-warm': ['#3b4cc0', '#5977ce', '#7ba3dc', '#9fcee8', '#c4e8f0', '#f0e0a6', '#f7b668', '#e68441'],
        'greens': ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32']
    };
    
    if (colorSchemes[scheme] && layerGroups.ptal) {
        // This would update the color scheme - implementation depends on specific requirements
        console.log('Color scheme updated to:', scheme);
    }
}

function setupFilterModal() {
    const filterModal = document.getElementById('filter-modal');
    const filterCloseBtn = document.querySelector('.filter-close');
    
    if (!filterModal || !filterCloseBtn) {
        console.warn('Filter modal elements not found, skipping setup');
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
    const applyFilterBtn = document.getElementById('apply-filter');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            applyAttributeFilter();
        });
    }
    
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            clearAllFilters();
            filterModal.style.display = 'none';
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
        console.warn('No layer name provided for zoom function');
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
            console.warn(`No valid bounds found for layer: ${layerName}`);
        }
    } else {
        console.warn(`Layer not found or empty: ${layerName}`);
        // Fallback to default view if layer is not available
        map.setView([51.4545, -2.5879], 11);
    }
}

function openStylingModal(layerName) {
    const modal = document.getElementById('styling-modal');
    const title = document.getElementById('modal-title');
    
    if (!modal) {
        console.warn('Styling modal not found');
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
        console.warn('Filter modal not found');
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
                    Object.keys(currentLayer.feature.properties).forEach(key => {
                        const value = currentLayer.feature.properties[key];
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
            // Clean up attribute name for display (replace underscores with spaces, capitalize)
            option.textContent = attr.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
        console.warn('Filter modal or datalist not found');
        return;
    }
    
    const layerName = filterModal.getAttribute('data-current-layer');
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    
    // Clear existing suggestions
    datalist.innerHTML = '';
    
    if (layerGroup) {
        const uniqueValues = new Set();
        
        layerGroup.eachLayer(layer => {
            // Function to recursively get all values for the attribute
            function getAllValues(currentLayer) {
                if (currentLayer.getLayers) {
                    // This is a layer group, get all sub-layers
                    currentLayer.getLayers().forEach(subLayer => getAllValues(subLayer));
                } else if (currentLayer.feature && currentLayer.feature.properties) {
                    // This is a feature layer with properties
                    const value = currentLayer.feature.properties[attributeName];
                    if (value !== null && value !== undefined && value !== '') {
                        uniqueValues.add(value.toString());
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

function applyAttributeFilter() {
    const filterModal = document.getElementById('filter-modal');
    if (!filterModal) {
        console.warn('Filter modal not found');
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
    const layerFilters = activeFilters[layerName] || [];
    
    if (!layerGroup) return;
    
    // Function to recursively apply all filters to layers
    function applyFiltersToLayer(currentLayer) {
        if (currentLayer.getLayers) {
            // This is a layer group, apply filters to all sub-layers
            currentLayer.getLayers().forEach(subLayer => applyFiltersToLayer(subLayer));
        } else if (currentLayer.feature && currentLayer.feature.properties) {
            // This is a feature layer
            let showFeature = true;
            
            // Check against all active filters for this layer
            for (const filter of layerFilters) {
                const propValue = currentLayer.feature.properties[filter.attribute];
                let passesFilter = false;
                
                switch (filter.operator) {
                    case 'equals':
                        passesFilter = propValue == filter.value1;
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
                
                // If any filter fails, hide the feature
                if (!passesFilter) {
                    showFeature = false;
                    break;
                }
            }
            
            // Show/hide feature based on all filters
            if (currentLayer.setStyle) {
                if (showFeature) {
                    currentLayer.setStyle({ opacity: currentLayer.options.opacity || 1, fillOpacity: currentLayer.options.fillOpacity || 0.7 });
                } else {
                    currentLayer.setStyle({ opacity: 0, fillOpacity: 0 });
                }
            }
        }
    }
    
    // Apply all filters for this layer
    applyFiltersToLayer(layerGroup);
}

function clearAllFilters() {
    // Clear all stored filters
    activeFilters = {};
    
    // Reset all layer visibility
    Object.values(layerGroups).forEach(layerGroup => {
        function resetLayerVisibility(currentLayer) {
            if (currentLayer.getLayers) {
                currentLayer.getLayers().forEach(subLayer => resetLayerVisibility(subLayer));
            } else if (currentLayer.setStyle) {
                currentLayer.setStyle({ opacity: currentLayer.options.opacity || 1, fillOpacity: currentLayer.options.fillOpacity || 0.7 });
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
    console.log('Filter to visible extent:', bounds);
}

function clearSpatialFilter() {
    // Implementation for clearing spatial filters would go here
    console.log('Clear spatial filter');
}

function updateActiveFiltersDisplay() {
    const activeFiltersList = document.getElementById('active-filters-list');
    if (!activeFiltersList) {
        console.warn('Active filters list element not found');
        return;
    }
    
    // Clear existing display
    activeFiltersList.innerHTML = '';
    
    let hasFilters = false;
    
    // Display filters for each layer
    Object.keys(activeFilters).forEach(layerName => {
        const layerFilters = activeFilters[layerName];
        if (layerFilters && layerFilters.length > 0) {
            hasFilters = true;
            
            // Create layer header
            const layerHeader = document.createElement('div');
            layerHeader.className = 'filter-layer-header';
            layerHeader.innerHTML = `
                <strong>${formatLayerName(toCamelCase(layerName))}</strong>
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
            layerFilters.forEach((filter, index) => {
                const filterText = `${filter.attribute} ${filter.operator} ${filter.value1}${filter.value2 ? ` and ${filter.value2}` : ''}`;
                const filterDiv = document.createElement('div');
                filterDiv.className = 'active-filter';
                filterDiv.innerHTML = `
                    <span>${filterText}</span>
                    <button onclick="removeLayerFilter('${layerName}', ${index})">×</button>
                `;
                filterDiv.style.marginLeft = '10px';
                activeFiltersList.appendChild(filterDiv);
            });
        }
    });
    
    if (!hasFilters) {
        activeFiltersList.innerHTML = '<p class="no-filters">No active filters</p>';
    }
}

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
        'JLTP5_in_10': 'Cost',
        'JLTP5_in_11': 'Funding already secured',
        'JLTP5_in_12': 'Dependencies',
        'JLTP5_in_13': 'Programme',
        'JLTP5_in_14': 'Active Travel / LCWIP Package',
        'JLTP5_in_15': 'CRSTS2',
        'JLTP5_in_16': 'CRSTS2 Rationale',
        'JLTP5_in_17': 'Notes / Comments',
        'JLTP5_in_18': 'Overview',
        'JLTP5_in_19': 'Package Ref',
        'JLTP5_in_20': '-' // Mapped to dash as requested
    };
    
    const renamedProperties = {};
    
    Object.keys(properties).forEach(key => {
        if (attributeMap.hasOwnProperty(key)) {
            const newKey = attributeMap[key];
            if (newKey !== null) { // Only include if not marked for removal
                renamedProperties[newKey] = properties[key];
            }
        } else {
            // Keep attributes not in the map as they are
            renamedProperties[key] = properties[key];
        }
    });
    
    return renamedProperties;
}

// Function to create popup content showing all attributes
function createFullPopupContent(feature, groupName, layerTitle = null) {
    let properties = feature.properties || {};
    
    // Apply TCR attribute renaming if this is a TCR layer
    if (groupName === 'tcrSchemes') {
        properties = renameTCRAttributes(properties);
    }
    
    let popupContent = '<div class="taf-popup">';
    popupContent += `<div class="popup-header">${layerTitle || formatLayerName(groupName)}</div>`;
    popupContent += '<table class="popup-table">';
    
    if (Object.keys(properties).length > 0) {
        Object.keys(properties).forEach(key => {
            const value = properties[key];
            if (value !== null && value !== undefined && value !== '') {
                popupContent += `<tr><td><strong>${formatPropertyName(key)}:</strong></td><td>${formatPropertyValue(value)}</td></tr>`;
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
    console.log('Default layers loaded. PTAL and bus data will load only when requested.');
}

// Load Growth Zones data
async function loadGrowthZones() {
    try {
        const response = await fetch('./data/growth-zones.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        
        L.geoJSON(transformedData, {
            style: {
                fillColor: 'transparent', // transparent fill
                weight: 2,
                opacity: 1,
                color: '#000', // black outline
                fillOpacity: 0 // no fill
            },
            onEachFeature: function(feature, layer) {
                const popupContent = createFullPopupContent(feature, 'growthZones', 'Growth Zone');
                layer.bindPopup(popupContent);
            }
        }).addTo(layerGroups.growthZones);
    } catch (error) {
        console.error('Error loading growth zones:', error);
    }
}

// Load Housing data
async function loadHousingData() {
    try {
        const response = await fetch('./data/housing.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        
        L.geoJSON(transformedData, {
            style: {
                fillColor: 'transparent',
                weight: 1,
                opacity: 1,
                color: '#000', // black outline
                fillOpacity: 0
            },
            onEachFeature: function(feature, layer) {
                const popupContent = createFullPopupContent(feature, 'housing', 'Housing');
                layer.bindPopup(popupContent);
            }
        }).addTo(layerGroups.housing);
    } catch (error) {
        console.error('Error loading housing data:', error);
    }
}

// Load PTAL data
async function loadPTALData() {
    try {
        const response = await fetch('./data/ptal.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        
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
        
        L.geoJSON(transformedData, {
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
                const popupContent = createFullPopupContent(feature, 'ptal', 'PTAL (Public Transport Accessibility Level)');
                layer.bindPopup(popupContent);
            }
        }).addTo(layerGroups.ptal);
    } catch (error) {
        console.error('Error loading PTAL data:', error);
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
        
        polygon.bindPopup(popupContent);
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
        
        circle.bindPopup(popupContent);
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
        
        circle.bindPopup(popupContent);
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
                const popupContent = createFullPopupContent(feature, 'railStations', 'Rail Station');
                layer.bindPopup(popupContent);
            }
        });
        layerGroups.railStations.addLayer(railStationsLayer);

    } catch (error) {
        console.error('Error loading rail stations:', error);
    }
}

// Load PTAL data asynchronously in chunks to avoid freezing UI
async function loadPTALDataAsync() {
    try {
        console.log('Loading PTAL data...');
        showLoadingIndicator('Loading PTAL data...');
        
        const response = await fetch('./data/ptal.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        
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
        const features = transformedData.features;
        
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
                    const popupContent = createFullPopupContent(feature, 'ptal', 'PTAL (Public Transport Accessibility Level)');
                    layer.bindPopup(popupContent);
                }
            });
            
            layerGroups.ptal.addLayer(chunkLayer);
            
            // Yield control back to the browser between chunks using requestAnimationFrame
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Update progress
            const progress = Math.round(((i + chunkSize) / features.length) * 100);
            console.log(`PTAL loading progress: ${Math.min(progress, 100)}%`);
        }
        
        hideLoadingIndicator();
        console.log('PTAL data loaded successfully');
    } catch (error) {
        hideLoadingIndicator();
        console.error('Error loading PTAL data:', error);
    }
}

// Load bus lines data asynchronously on-demand
async function loadBusLinesAsync() {
    try {
        console.log('Loading bus lines...');
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
                    const popupContent = createFullPopupContent(feature, 'busLines', 'Bus Route');
                    layer.bindPopup(popupContent);
                }
            });
            
            layerGroups.busLines.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        hideLoadingIndicator();
        console.log('Bus lines loaded successfully');
    } catch (error) {
        hideLoadingIndicator();
        console.error('Error loading bus lines:', error);
    }
}

// Load bus stops data asynchronously on-demand
async function loadBusStopsAsync() {
    try {
        console.log('Loading bus stops...');
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
                    const popupContent = createFullPopupContent(feature, 'busStops', 'Bus Stop');
                    layer.bindPopup(popupContent);
                }
            });
            
            layerGroups.busStops.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        hideLoadingIndicator();
        console.log('Bus stops loaded successfully');
    } catch (error) {
        hideLoadingIndicator();
        console.error('Error loading bus stops:', error);
    }
}

// Load bus infrastructure asynchronously in chunks
async function loadBusInfrastructureAsync() {
    try {
        console.log('Loading bus infrastructure...');
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
                    const props = feature.properties;
                    layer.bindPopup(`
                        <h4>Bus Route</h4>
                        <table class="popup-table">
                            <tr><th>Property</th><th>Value</th></tr>
                            <tr><td>Route</td><td>${props.route || 'N/A'}</td></tr>
                            <tr><td>Operator</td><td>${props.operator || 'N/A'}</td></tr>
                            <tr><td>Mon AM</td><td>${props.MONAM || 'N/A'}</td></tr>
                            <tr><td>Mon PM</td><td>${props.MONPM || 'N/A'}</td></tr>
                        </table>
                    `);
                }
            });
            
            layerGroups.busLines.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        console.log('Bus lines loaded');
        
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
                    const props = feature.properties;
                    layer.bindPopup(`
                        <h4>${props.CommonName || 'Bus Stop'}</h4>
                        <table class="popup-table">
                            <tr><th>Property</th><th>Value</th></tr>
                            <tr><td>Stop Code</td><td>${props.ATCOCode || 'N/A'}</td></tr>
                            <tr><td>Bearing</td><td>${props.Bearing || 'N/A'}</td></tr>
                            <tr><td>Mon AM</td><td>${props.MONAM || 'N/A'}</td></tr>
                            <tr><td>Mon PM</td><td>${props.MONPM || 'N/A'}</td></tr>
                        </table>
                    `);
                }
            });
            
            layerGroups.busStops.addLayer(chunkLayer);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        hideLoadingIndicator();
        console.log('Bus infrastructure loaded successfully');
    } catch (error) {
        hideLoadingIndicator();
        console.error('Error loading bus infrastructure:', error);
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
                const popupContent = createFullPopupContent(feature, 'tcrSchemes', 'TCR Point Scheme');
                layer.bindPopup(popupContent);
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
                const popupContent = createFullPopupContent(feature, 'tcrSchemes', 'TCR Line Scheme');
                layer.bindPopup(popupContent);
            }
        });
        layerGroups.tcrSchemes.addLayer(tcrLinesLayer);

        // Load TCR Polygons
        const tcrPolygonsResponse = await fetch('data/schemes_pg.geojson');
        const tcrPolygonsData = await tcrPolygonsResponse.json();
        const transformedTCRPolygons = transformGeoJSON(tcrPolygonsData);
        
        const tcrPolygonsLayer = L.geoJSON(transformedTCRPolygons, {
            style: {
                color: '#ff00ff', // magenta
                fillColor: 'transparent',
                fillOpacity: 0,
                weight: 0.5,
                dashArray: '2, 2'
            },
            onEachFeature: function(feature, layer) {
                const popupContent = createFullPopupContent(feature, 'tcrSchemes', 'TCR Polygon Scheme');
                layer.bindPopup(popupContent);
            }
        });
        layerGroups.tcrSchemes.addLayer(tcrPolygonsLayer);

    } catch (error) {
        console.error('Error loading TCR schemes data:', error);
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

// Export functions for potential external use
window.mapFunctions = {
    map,
    layerGroups
};
