// Initialize the map with TAF-style design
let map;
let layerGroups = {};
let baseMaps = {};

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', async function() {
    initializeMap();
    setupLegendControls();
    await loadSampleData();
});

function initializeMap() {
    // Initialize map centered on West of England area (Bristol coordinates)
    map = L.map('map').setView([51.4545, -2.5879], 11);

    // Define base map layers (similar to TAF)
    baseMaps.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    baseMaps.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    baseMaps.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
    });

    // Add CartoDB Positron (light background like TAF)
    baseMaps.light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd'
    });

    // Add default base map (light theme like TAF)
    baseMaps.light.addTo(map);

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
    layerGroups.railStops = L.layerGroup().addTo(map);
    layerGroups.crsts2Points = L.layerGroup().addTo(map);
    layerGroups.crsts2Lines = L.layerGroup().addTo(map);
    layerGroups.crsts2Polygons = L.layerGroup().addTo(map);

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
            const layerId = this.id.replace(/-/g, '');
            const camelCaseId = toCamelCase(this.id);
            
            if (layerGroups[camelCaseId]) {
                if (this.checked) {
                    map.addLayer(layerGroups[camelCaseId]);
                } else {
                    map.removeLayer(layerGroups[camelCaseId]);
                }
            }
        });
    });

    // Base map radio buttons
    const basemapRadios = document.querySelectorAll('input[name="basemap"]');
    basemapRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            // Remove all base maps
            Object.values(baseMaps).forEach(layer => {
                map.removeLayer(layer);
            });
            
            // Add selected base map
            if (baseMaps[this.value]) {
                baseMaps[this.value].addTo(map);
            }
        });
    });
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
    await loadCRSTS2Data();
}

// Load Growth Zones data
async function loadGrowthZones() {
    try {
        const response = await fetch('./data/growth-zones.geojson');
        const data = await response.json();
        const transformedData = transformGeoJSON(data);
        
        L.geoJSON(transformedData, {
            style: {
                fillColor: '#ff6b6b',
                weight: 2,
                opacity: 1,
                color: '#ff4757',
                fillOpacity: 0.3
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
                fillColor: '#4ecdc4',
                weight: 2,
                opacity: 1,
                color: '#26d0ce',
                fillOpacity: 0.3
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
        
        L.geoJSON(transformedData, {
            style: function(feature) {
                // Color based on PTAL level if available
                const ptalLevel = feature.properties.PTAL || feature.properties.ptal || 1;
                const colors = {
                    1: '#d73027',
                    2: '#f46d43', 
                    3: '#fdae61',
                    4: '#fee08b',
                    5: '#d9ef8b',
                    6: '#a6d96a'
                };
                return {
                    fillColor: colors[ptalLevel] || '#ffffcc',
                    weight: 1,
                    opacity: 1,
                    color: '#333',
                    fillOpacity: 0.4
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
                color: '#96ceb4',
                weight: 4,
                opacity: 0.8
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
                    color: '#feca57',
                    fillColor: '#feca57',
                    fillOpacity: 0.8,
                    radius: 6,
                    weight: 2
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
                    color: '#ff9ff3',
                    fillColor: '#ff9ff3',
                    fillOpacity: 0.8,
                    radius: 8,
                    weight: 3
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
        layerGroups.railStops.addLayer(railStationsLayer);

    } catch (error) {
        console.error('Error loading transport infrastructure:', error);
    }
}

async function loadCRSTS2Data() {
    try {
        // Load CRSTS2 Points
        const crsts2PointsResponse = await fetch('data/schemes_pt.geojson');
        const crsts2PointsData = await crsts2PointsResponse.json();
        const transformedCRSTS2Points = transformGeoJSON(crsts2PointsData);
        
        const crsts2PointsLayer = L.geoJSON(transformedCRSTS2Points, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    color: '#54a0ff',
                    fillColor: '#54a0ff',
                    fillOpacity: 0.7,
                    radius: 8,
                    weight: 2
                });
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'CRSTS2 Point'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Scheme</td><td>${props.scheme || 'N/A'}</td></tr>
                        <tr><td>Type</td><td>${props.type || 'N/A'}</td></tr>
                        <tr><td>Status</td><td>${props.status || 'N/A'}</td></tr>
                    </table>
                `);
            }
        });
        layerGroups.crsts2Points.addLayer(crsts2PointsLayer);

        // Load CRSTS2 Lines
        const crsts2LinesResponse = await fetch('data/schemes_ln.geojson');
        const crsts2LinesData = await crsts2LinesResponse.json();
        const transformedCRSTS2Lines = transformGeoJSON(crsts2LinesData);
        
        const crsts2LinesLayer = L.geoJSON(transformedCRSTS2Lines, {
            style: {
                color: '#54a0ff',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5'
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'CRSTS2 Line'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Scheme</td><td>${props.scheme || 'N/A'}</td></tr>
                        <tr><td>Type</td><td>${props.type || 'N/A'}</td></tr>
                        <tr><td>Length</td><td>${props.length || 'N/A'}</td></tr>
                    </table>
                `);
            }
        });
        layerGroups.crsts2Lines.addLayer(crsts2LinesLayer);

        // Load CRSTS2 Polygons
        const crsts2PolygonsResponse = await fetch('data/schemes_pg.geojson');
        const crsts2PolygonsData = await crsts2PolygonsResponse.json();
        const transformedCRSTS2Polygons = transformGeoJSON(crsts2PolygonsData);
        
        const crsts2PolygonsLayer = L.geoJSON(transformedCRSTS2Polygons, {
            style: {
                color: '#54a0ff',
                fillColor: '#54a0ff',
                fillOpacity: 0.3,
                weight: 3,
                dashArray: '5, 5'
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                layer.bindPopup(`
                    <h4>${props.name || 'CRSTS2 Polygon'}</h4>
                    <table class="popup-table">
                        <tr><th>Property</th><th>Value</th></tr>
                        <tr><td>Scheme</td><td>${props.scheme || 'N/A'}</td></tr>
                        <tr><td>Type</td><td>${props.type || 'N/A'}</td></tr>
                        <tr><td>Area</td><td>${props.area || 'N/A'}</td></tr>
                    </table>
                `);
            }
        });
        layerGroups.crsts2Polygons.addLayer(crsts2PolygonsLayer);

    } catch (error) {
        console.error('Error loading CRSTS2 data:', error);
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
    layerGroups,
    baseMaps
};
