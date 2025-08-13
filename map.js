// Initialize the map with TAF-style design
let map;
let layerGroups = {};

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', async function() {
    initializeMap();
    setupLegendControls();
    await loadSampleData();
});

function initializeMap() {
    // Initialize map centered on West of England area (Bristol coordinates)
    map = L.map('map').setView([51.4545, -2.5879], 11);

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

    // Initialize layer groups
    layerGroups.growthZones = L.layerGroup().addTo(map);
    layerGroups.housing = L.layerGroup().addTo(map);
    layerGroups.ptal = L.layerGroup().addTo(map);
    layerGroups.busLines = L.layerGroup().addTo(map);
    layerGroups.busStops = L.layerGroup().addTo(map);
    layerGroups.railStations = L.layerGroup().addTo(map);
    layerGroups.tcrSchemes = L.layerGroup().addTo(map);

    // Add scale control
    L.control.scale({position: 'bottomleft'}).addTo(map);
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
    const layerCheckboxes = document.querySelectorAll('input[type="checkbox"]:not([name])');
    layerCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const layerId = this.id;
            let camelCaseId = toCamelCase(layerId);
            
            if (layerGroups[camelCaseId]) {
                if (this.checked) {
                    map.addLayer(layerGroups[camelCaseId]);
                } else {
                    map.removeLayer(layerGroups[camelCaseId]);
                }
            }
        });
    });
    
    // Setup styling modal
    setupStylingModal();
    setupFilterModal();
    setupLayerIcons();
}

function setupStylingModal() {
    const modal = document.getElementById('styling-modal');
    const closeBtn = document.querySelector('.close');
    
    // Close modal when clicking X or outside
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Add click handlers for legend elements
    document.getElementById('ptal-color-scale').addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'PTAL Styling';
        modal.style.display = 'block';
    });
    
    // Opacity slider handler
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    opacitySlider.addEventListener('input', (e) => {
        opacityValue.textContent = Math.round(e.target.value * 100) + '%';
    });
    
    // Size slider handler
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    sizeSlider.addEventListener('input', (e) => {
        sizeValue.textContent = e.target.value;
    });
    
    // Classification method handler
    const classificationMethod = document.getElementById('classification-method');
    const graduatedOptions = document.getElementById('graduated-options');
    classificationMethod.addEventListener('change', (e) => {
        graduatedOptions.style.display = e.target.value === 'graduated' ? 'block' : 'none';
    });
    
    // Apply styling button
    document.getElementById('apply-styling').addEventListener('click', () => {
        applyStyling();
        modal.style.display = 'none';
    });
    
    // Reset styling button
    document.getElementById('reset-styling').addEventListener('click', () => {
        resetStyling();
        modal.style.display = 'none';
    });
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
    filterAttribute.addEventListener('change', (e) => {
        filterControls.style.display = e.target.value ? 'block' : 'none';
    });
    
    // Filter operator change handler
    const filterOperator = document.getElementById('filter-operator');
    const filterValue2Group = document.getElementById('filter-value2-group');
    filterOperator.addEventListener('change', (e) => {
        filterValue2Group.style.display = e.target.value === 'between' ? 'block' : 'none';
    });
    
    // Filter buttons
    document.getElementById('apply-filter').addEventListener('click', () => {
        applyAttributeFilter();
    });
    
    document.getElementById('clear-all-filters').addEventListener('click', () => {
        clearAllFilters();
        filterModal.style.display = 'none';
    });
    
    document.getElementById('filter-visible-extent').addEventListener('click', () => {
        filterToVisibleExtent();
    });
    
    document.getElementById('clear-spatial-filter').addEventListener('click', () => {
        clearSpatialFilter();
    });
}

function setupLayerIcons() {
    // Palette icon handlers
    document.querySelectorAll('.palette-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const layerName = e.target.getAttribute('data-layer');
            openStylingModal(layerName);
        });
    });
    
    // Filter icon handlers
    document.querySelectorAll('.filter-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const layerName = e.target.getAttribute('data-layer');
            openFilterModal(layerName);
        });
    });
}

function openStylingModal(layerName) {
    const modal = document.getElementById('styling-modal');
    const title = document.getElementById('modal-title');
    
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
    
    title.textContent = layerTitles[layerName] || 'Layer Styling';
    modal.setAttribute('data-current-layer', layerName);
    modal.style.display = 'block';
}

function openFilterModal(layerName) {
    const filterModal = document.getElementById('filter-modal');
    const filterTitle = document.getElementById('filter-modal-title');
    const filterAttribute = document.getElementById('filter-attribute');
    
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
    
    filterTitle.textContent = layerTitles[layerName] || 'Layer Filter';
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
        layerGroup.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                Object.keys(layer.feature.properties).forEach(key => {
                    if (layer.feature.properties[key] !== null && layer.feature.properties[key] !== undefined) {
                        attributes.add(key);
                    }
                });
            }
        });
        
        // Add attributes to dropdown
        Array.from(attributes).sort().forEach(attr => {
            const option = document.createElement('option');
            option.value = attr;
            option.textContent = attr;
            filterAttribute.appendChild(option);
        });
    }
}

function applyAttributeFilter() {
    const layerName = document.getElementById('filter-modal').getAttribute('data-current-layer');
    const attribute = document.getElementById('filter-attribute').value;
    const operator = document.getElementById('filter-operator').value;
    const value1 = document.getElementById('filter-value').value;
    const value2 = document.getElementById('filter-value2').value;
    
    if (!attribute || !value1) {
        alert('Please select an attribute and enter a value');
        return;
    }
    
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    
    if (layerGroup) {
        layerGroup.eachLayer(layer => {
            if (layer.feature && layer.feature.properties) {
                const propValue = layer.feature.properties[attribute];
                let showFeature = false;
                
                switch (operator) {
                    case 'equals':
                        showFeature = propValue == value1;
                        break;
                    case 'contains':
                        showFeature = propValue && propValue.toString().toLowerCase().includes(value1.toLowerCase());
                        break;
                    case 'greater':
                        showFeature = parseFloat(propValue) > parseFloat(value1);
                        break;
                    case 'less':
                        showFeature = parseFloat(propValue) < parseFloat(value1);
                        break;
                    case 'between':
                        const num = parseFloat(propValue);
                        showFeature = num >= parseFloat(value1) && num <= parseFloat(value2);
                        break;
                }
                
                // Show/hide feature based on filter
                if (showFeature) {
                    if (layer.setStyle) {
                        layer.setStyle({ opacity: layer.options.opacity || 1, fillOpacity: layer.options.fillOpacity || 0.7 });
                    }
                } else {
                    if (layer.setStyle) {
                        layer.setStyle({ opacity: 0, fillOpacity: 0 });
                    }
                }
            }
        });
        
        // Update active filters display
        updateActiveFiltersDisplay(layerName, attribute, operator, value1, value2);
    }
}

function clearAllFilters() {
    // Reset all layer visibility
    Object.values(layerGroups).forEach(layerGroup => {
        layerGroup.eachLayer(layer => {
            if (layer.setStyle) {
                layer.setStyle({ opacity: layer.options.opacity || 1, fillOpacity: layer.options.fillOpacity || 0.7 });
            }
        });
    });
    
    // Clear active filters display
    document.getElementById('active-filters-list').innerHTML = '<p class="no-filters">No active filters</p>';
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

function updateActiveFiltersDisplay(layerName, attribute, operator, value1, value2) {
    const activeFiltersList = document.getElementById('active-filters-list');
    const noFilters = activeFiltersList.querySelector('.no-filters');
    if (noFilters) noFilters.remove();
    
    const filterText = `${layerName}: ${attribute} ${operator} ${value1}${value2 ? ` and ${value2}` : ''}`;
    const filterDiv = document.createElement('div');
    filterDiv.className = 'active-filter';
    filterDiv.innerHTML = `
        <span>${filterText}</span>
        <button onclick="removeFilter(this, '${layerName}')">×</button>
    `;
    activeFiltersList.appendChild(filterDiv);
}

function removeFilter(button, layerName) {
    button.parentElement.remove();
    
    // Reset layer visibility
    const camelCaseId = toCamelCase(layerName);
    const layerGroup = layerGroups[camelCaseId];
    if (layerGroup) {
        layerGroup.eachLayer(layer => {
            if (layer.setStyle) {
                layer.setStyle({ opacity: layer.options.opacity || 1, fillOpacity: layer.options.fillOpacity || 0.7 });
            }
        });
    }
    
    // Check if no filters remain
    const activeFiltersList = document.getElementById('active-filters-list');
    if (activeFiltersList.children.length === 0) {
        activeFiltersList.innerHTML = '<p class="no-filters">No active filters</p>';
    }
}

function toCamelCase(str) {
    return str.replace(/-([a-z])/g, function(match, letter) {
        return letter.toUpperCase();
    }).replace(/^-/, '');
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
            const transformedCoords = transformCoordinates(coords);
            feature.geometry.coordinates = [transformedCoords[1], transformedCoords[0]]; // [lng, lat] for GeoJSON
        } else if (feature.geometry.type === 'MultiLineString') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(lineString =>
                lineString.map(coord => {
                    const transformed = transformCoordinates(coord);
                    return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                })
            );
        } else if (feature.geometry.type === 'LineString') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(coord => {
                const transformed = transformCoordinates(coord);
                return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
            });
        } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(ring =>
                ring.map(coord => {
                    const transformed = transformCoordinates(coord);
                    return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                })
            );
        } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map(polygon =>
                polygon.map(ring => ring.map(coord => {
                    const transformed = transformCoordinates(coord);
                    return [transformed[1], transformed[0]]; // [lng, lat] for GeoJSON
                }))
            );
        }
    });
    
    return transformed;
}

async function loadSampleData() {
    // Load real GeoJSON data files
    await loadGrowthZones();
    await loadHousingData(); 
    await loadPTALData();
    await loadTransportInfrastructure();
    await loadTCRSchemesData();
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
                let popupContent = '<div class="taf-popup">';
                popupContent += '<div class="popup-header">Growth Zone</div>';
                popupContent += '<table class="popup-table">';
                popupContent += '<tr><td><strong>Name:</strong></td><td>' + (feature.properties.Name || 'N/A') + '</td></tr>';
                popupContent += '<tr><td><strong>Growth Type:</strong></td><td>' + (feature.properties.GrowthType || 'N/A') + '</td></tr>';
                popupContent += '</table></div>';
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
                let popupContent = '<div class="taf-popup">';
                popupContent += '<div class="popup-header">Housing</div>';
                popupContent += '<table class="popup-table">';
                Object.keys(feature.properties).forEach(key => {
                    if (feature.properties[key] !== null) {
                        popupContent += '<tr><td><strong>' + key + ':</strong></td><td>' + feature.properties[key] + '</td></tr>';
                    }
                });
                popupContent += '</table></div>';
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
                let popupContent = '<div class="taf-popup">';
                popupContent += '<div class="popup-header">PTAL (Public Transport Accessibility Level)</div>';
                popupContent += '<table class="popup-table">';
                Object.keys(feature.properties).forEach(key => {
                    if (feature.properties[key] !== null) {
                        popupContent += '<tr><td><strong>' + key + ':</strong></td><td>' + feature.properties[key] + '</td></tr>';
                    }
                });
                popupContent += '</table></div>';
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

async function loadTransportInfrastructure() {
    try {
        // Load Bus Lines
        const busLinesResponse = await fetch('data/bus-lines.geojson');
        const busLinesData = await busLinesResponse.json();
        const transformedBusLines = transformGeoJSON(busLinesData);
        
        const busLinesLayer = L.geoJSON(transformedBusLines, {
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
        layerGroups.busLines.addLayer(busLinesLayer);

        // Load Bus Stops
        const busStopsResponse = await fetch('data/bus-stops.geojson');
        const busStopsData = await busStopsResponse.json();
        const transformedBusStops = transformGeoJSON(busStopsData);
        
        const busStopsLayer = L.geoJSON(transformedBusStops, {
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
        layerGroups.busStops.addLayer(busStopsLayer);

        // Load Rail Stations
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
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'Rail Station'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Type</td><td>${props.type || 'Rail Station'}</td></tr>
                        <tr><td>Operator</td><td>${props.operator || 'N/A'}</td></tr>
                    </table>
                `);
            }
        });
        layerGroups.railStations.addLayer(railStationsLayer);

    } catch (error) {
        console.error('Error loading transport infrastructure:', error);
    }
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
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'TCR Point Scheme'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Scheme</td><td>${props.scheme || 'N/A'}</td></tr>
                        <tr><td>Type</td><td>${props.type || 'N/A'}</td></tr>
                        <tr><td>Status</td><td>${props.status || 'N/A'}</td></tr>
                    </table>
                `);
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
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'TCR Line Scheme'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Scheme</td><td>${props.scheme || 'N/A'}</td></tr>
                        <tr><td>Type</td><td>${props.type || 'N/A'}</td></tr>
                        <tr><td>Length</td><td>${props.length || 'N/A'}</td></tr>
                    </table>
                `);
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
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'TCR Polygon Scheme'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Scheme</td><td>${props.scheme || 'N/A'}</td></tr>
                        <tr><td>Type</td><td>${props.type || 'N/A'}</td></tr>
                        <tr><td>Area</td><td>${props.area || 'N/A'}</td></tr>
                    </table>
                `);
            }
        });
        layerGroups.tcrSchemes.addLayer(tcrPolygonsLayer);

    } catch (error) {
        console.error('Error loading TCR schemes data:', error);
    }
}

// Add loading indicator
function showLoading() {
    const mapElement = document.getElementById('map');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = 'Loading map data...';
    mapElement.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.querySelector('.loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Export functions for potential external use
window.mapFunctions = {
    map,
    layerGroups
};
