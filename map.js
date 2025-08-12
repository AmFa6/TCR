// Initialize the map with TAF-style design
let map;
let layerGroups = {};
let baseMaps = {};

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupLegendControls();
    loadSampleData();
});

function initializeMap() {
    // Initialize map centered on West of England area (approximate coordinates)
    map = L.map('map').setView([51.4545, -2.5879], 11);

    // Define base map layers
    baseMaps.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    baseMaps.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri'
    });

    baseMaps.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap'
    });

    // Add default base map
    baseMaps.osm.addTo(map);

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

function loadSampleData() {
    // Create sample Growth Zones
    createSampleGrowthZones();
    
    // Create sample Housing data
    createSampleHousing();
    
    // Create sample PTAL data
    createSamplePTAL();
    
    // Create sample Transport Infrastructure
    createSampleTransportInfrastructure();
    
    // Create sample CRSTS2 data
    createSampleCRSTS2();
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

function createSampleTransportInfrastructure() {
    // Bus Lines
    const busLines = [
        {
            name: "Metrobus m1",
            coordinates: [[51.4584, -2.5879], [51.4400, -2.5600], [51.4200, -2.5400], [51.4000, -2.5200]],
            operator: "First West of England"
        },
        {
            name: "Metrobus m2", 
            coordinates: [[51.4584, -2.5879], [51.4700, -2.6100], [51.4800, -2.6300], [51.4900, -2.6500]],
            operator: "First West of England"
        }
    ];

    busLines.forEach(line => {
        const polyline = L.polyline(line.coordinates, {
            color: '#96ceb4',
            weight: 4,
            opacity: 0.8
        });
        
        polyline.bindPopup(`
            <h4>${line.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Operator</td><td>${line.operator}</td></tr>
            </table>
        `);
        
        layerGroups.busLines.addLayer(polyline);
    });

    // Bus Stops
    const busStops = [
        { name: "Temple Meads Station", coords: [51.4490, -2.5766], routes: ["m1", "m2", "18", "42"] },
        { name: "Cabot Circus", coords: [51.4600, -2.5850], routes: ["5", "18", "42", "620"] },
        { name: "University of Bristol", coords: [51.4585, -2.6030], routes: ["m1", "18", "620"] },
        { name: "Bath Spa Station", coords: [51.3758, -2.3597], routes: ["4", "7", "18"] }
    ];

    busStops.forEach(stop => {
        const marker = L.circleMarker(stop.coords, {
            color: '#feca57',
            fillColor: '#feca57',
            fillOpacity: 0.8,
            radius: 6,
            weight: 2
        });
        
        marker.bindPopup(`
            <h4>${stop.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Routes</td><td>${stop.routes.join(', ')}</td></tr>
            </table>
        `);
        
        layerGroups.busStops.addLayer(marker);
    });

    // Rail Stops
    const railStops = [
        { name: "Bristol Temple Meads", coords: [51.4490, -2.5766], type: "Major Station" },
        { name: "Bristol Parkway", coords: [51.5105, -2.5346], type: "Parkway Station" },
        { name: "Bath Spa", coords: [51.3758, -2.3597], type: "Major Station" },
        { name: "Weston-super-Mare", coords: [51.3406, -2.9772], type: "Regional Station" }
    ];

    railStops.forEach(stop => {
        const marker = L.circleMarker(stop.coords, {
            color: '#ff9ff3',
            fillColor: '#ff9ff3',
            fillOpacity: 0.8,
            radius: 8,
            weight: 3
        });
        
        marker.bindPopup(`
            <h4>${stop.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Type</td><td>${stop.type}</td></tr>
            </table>
        `);
        
        layerGroups.railStops.addLayer(marker);
    });
}

function createSampleCRSTS2() {
    // CRSTS2 Points
    const crsts2Points = [
        { name: "Bus Stop Upgrade - Temple St", coords: [51.4550, -2.5800], scheme: "Bus Infrastructure", budget: "£50k" },
        { name: "Cycle Hub - Castle St", coords: [51.4520, -2.5900], scheme: "Active Travel", budget: "£120k" },
        { name: "Junction Improvement - Old Market", coords: [51.4600, -2.5750], scheme: "Traffic Management", budget: "£200k" }
    ];

    crsts2Points.forEach(point => {
        const marker = L.circleMarker(point.coords, {
            color: '#54a0ff',
            fillColor: '#54a0ff',
            fillOpacity: 0.7,
            radius: 8,
            weight: 2
        });
        
        marker.bindPopup(`
            <h4>${point.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Scheme</td><td>${point.scheme}</td></tr>
                <tr><td>Budget</td><td>${point.budget}</td></tr>
            </table>
        `);
        
        layerGroups.crsts2Points.addLayer(marker);
    });

    // CRSTS2 Lines
    const crsts2Lines = [
        {
            name: "Cycle Route Extension - Phase 1",
            coordinates: [[51.4584, -2.5879], [51.4650, -2.5950], [51.4700, -2.6000]],
            scheme: "Active Travel",
            length: "2.5km"
        },
        {
            name: "Bus Lane - A4 Corridor",
            coordinates: [[51.4400, -2.5600], [51.4500, -2.5500], [51.4600, -2.5400]],
            scheme: "Bus Priority",
            length: "3.2km"
        }
    ];

    crsts2Lines.forEach(line => {
        const polyline = L.polyline(line.coordinates, {
            color: '#54a0ff',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 5'
        });
        
        polyline.bindPopup(`
            <h4>${line.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Scheme</td><td>${line.scheme}</td></tr>
                <tr><td>Length</td><td>${line.length}</td></tr>
            </table>
        `);
        
        layerGroups.crsts2Lines.addLayer(polyline);
    });

    // CRSTS2 Polygons
    const crsts2Polygons = [
        {
            name: "Public Realm Improvement - Queen Square",
            coordinates: [[51.4550, -2.5950], [51.4560, -2.5940], [51.4555, -2.5930], [51.4545, -2.5940], [51.4550, -2.5950]],
            scheme: "Public Realm",
            area: "0.8 hectares"
        },
        {
            name: "Transport Hub Development - Temple Quarter",
            coordinates: [[51.4485, -2.5770], [51.4495, -2.5760], [51.4490, -2.5750], [51.4480, -2.5760], [51.4485, -2.5770]],
            scheme: "Integrated Transport",
            area: "1.2 hectares"
        }
    ];

    crsts2Polygons.forEach(polygon => {
        const poly = L.polygon(polygon.coordinates, {
            color: '#54a0ff',
            fillColor: '#54a0ff',
            fillOpacity: 0.3,
            weight: 3,
            dashArray: '5, 5'
        });
        
        poly.bindPopup(`
            <h4>${polygon.name}</h4>
            <table class="popup-table">
                <tr><th>Property</th><th>Value</th></tr>
                <tr><td>Scheme</td><td>${polygon.scheme}</td></tr>
                <tr><td>Area</td><td>${polygon.area}</td></tr>
            </table>
        `);
        
        layerGroups.crsts2Polygons.addLayer(poly);
    });
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
