// Advanced Layer Styling System
// Supports Simple, Categorized, and Graduated styling for Color, Opacity, and Size/Weight

let layerStyles = {}; // Store styling configurations for each layer

// Initialize styling system
function initializeStyling() {
    // Add styling controls to the layer control panel
    addStylingControls();
}

// Add styling button to each layer in the control panel
function addStylingControls() {
    // Work with existing palette icons instead of creating new buttons
    const paletteIcons = document.querySelectorAll('.palette-icon');
    
    paletteIcons.forEach(icon => {
        const layerId = icon.getAttribute('data-layer');
        if (layerId && !icon.hasAttribute('data-styled')) {
            icon.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openStyleModal(layerId);
            });
            icon.setAttribute('data-styled', 'true');
        }
    });
}

// Open styling modal for a specific layer
function openStyleModal(layerId) {
    // Close any existing modal first
    closeStyleModal();
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('style-modal');
    if (!modal) {
        modal = createStyleModal();
        document.body.appendChild(modal);
    }
    
    // Set current layer
    modal.setAttribute('data-current-layer', layerId);
    
    // Populate layer information
    const layerName = formatLayerName(toCamelCase(layerId));
    document.getElementById('style-layer-title').textContent = `Style: ${layerName}`;
    
    // Determine geometry type and show appropriate tabs
    const geometryType = getLayerGeometryType(layerId);
    setupTabsForGeometry(geometryType);
    
    // Load existing style or create default based on current layer styling
    const currentStyle = layerStyles[layerId] || createDefaultStyleFromLayer(layerId, geometryType);
    loadStyleToModal(currentStyle, geometryType);
    
    // Show modal
    modal.style.display = 'block';
}

// Create the styling modal HTML
function createStyleModal() {
    const modal = document.createElement('div');
    modal.id = 'style-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content style-modal-content">
            <div class="modal-header">
                <h3 id="style-layer-title">Style Layer</h3>
                <span class="close" onclick="closeStyleModal()">&times;</span>
            </div>
            
            <div class="style-tabs">
                <button class="tab-btn active" onclick="switchStyleTab('fill')">Fill</button>
                <button class="tab-btn" onclick="switchStyleTab('outline')">Outline</button>
                <button class="tab-btn" onclick="switchStyleTab('general')">General</button>
            </div>
            
            <!-- Fill Styling -->
            <div id="fill-tab" class="style-tab active">
                <h4>Fill Styling</h4>
                
                <!-- Fill Color -->
                <div class="style-group">
                    <label>Fill Color:</label>
                    <select id="fill-color-method">
                        <option value="simple">Simple</option>
                        <option value="categorized">Categorized</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="fill-color-controls"></div>
                </div>
                
                <!-- Fill Opacity -->
                <div class="style-group">
                    <label>Fill Opacity:</label>
                    <select id="fill-opacity-method">
                        <option value="simple">Simple</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="fill-opacity-controls"></div>
                </div>
            </div>
            
            <!-- Outline Styling -->
            <div id="outline-tab" class="style-tab">
                <h4>Outline Styling</h4>
                
                <!-- Outline Color -->
                <div class="style-group">
                    <label>Outline Color:</label>
                    <select id="outline-color-method">
                        <option value="simple">Simple</option>
                        <option value="categorized">Categorized</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="outline-color-controls"></div>
                </div>
                
                <!-- Outline Opacity -->
                <div class="style-group">
                    <label>Outline Opacity:</label>
                    <select id="outline-opacity-method">
                        <option value="simple">Simple</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="outline-opacity-controls"></div>
                </div>
                
                <!-- Outline Weight -->
                <div class="style-group">
                    <label>Outline Weight:</label>
                    <select id="outline-weight-method">
                        <option value="simple">Simple</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="outline-weight-controls"></div>
                </div>
            </div>
            
            <!-- General Styling (for points and lines) -->
            <div id="general-tab" class="style-tab">
                <h4>General Styling</h4>
                
                <!-- Color -->
                <div class="style-group">
                    <label>Color:</label>
                    <select id="general-color-method">
                        <option value="simple">Simple</option>
                        <option value="categorized">Categorized</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="general-color-controls"></div>
                </div>
                
                <!-- Opacity -->
                <div class="style-group">
                    <label>Opacity:</label>
                    <select id="general-opacity-method">
                        <option value="simple">Simple</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="general-opacity-controls"></div>
                </div>
                
                <!-- Size/Weight -->
                <div class="style-group">
                    <label>Size/Weight:</label>
                    <select id="general-size-method">
                        <option value="simple">Simple</option>
                        <option value="graduated">Graduated</option>
                    </select>
                    <div id="general-size-controls"></div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button onclick="applyStyle()">Apply Style</button>
                <button onclick="resetStyle()">Reset to Default</button>
                <button onclick="closeStyleModal()">Cancel</button>
            </div>
        </div>
    `;
    
    return modal;
}

// Switch between styling tabs
function switchStyleTab(tabName) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.style-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to selected tab and button
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[onclick="switchStyleTab('${tabName}')"]`).classList.add('active');
}

// Determine the geometry type of a layer
function getLayerGeometryType(layerId) {
    const camelCaseId = toCamelCase(layerId);
    
    // Check if layerGroups is available
    if (typeof layerGroups === 'undefined') {
        return 'unknown';
    }
    
    const layerGroup = layerGroups[camelCaseId];
    if (!layerGroup) return 'unknown';
    
    let geometryType = 'unknown';
    
    // Sample the first feature to determine geometry type
    layerGroup.eachLayer(layer => {
        function checkFeature(currentLayer) {
            if (currentLayer.getLayers) {
                currentLayer.getLayers().forEach(subLayer => checkFeature(subLayer));
            } else if (currentLayer.feature && currentLayer.feature.geometry) {
                const geomType = currentLayer.feature.geometry.type;
                if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                    geometryType = 'polygon';
                } else if (geomType === 'Point' || geomType === 'MultiPoint') {
                    geometryType = 'point';
                } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                    geometryType = 'line';
                }
                return true; // Stop after finding first feature
            } else if (currentLayer instanceof L.Polygon) {
                geometryType = 'polygon';
                return true;
            } else if (currentLayer instanceof L.Marker || currentLayer instanceof L.CircleMarker) {
                geometryType = 'point';
                return true;
            } else if (currentLayer instanceof L.Polyline) {
                geometryType = 'line';
                return true;
            }
        }
        
        if (geometryType === 'unknown') {
            checkFeature(layer);
        }
    });
    
    return geometryType;
}

// Setup tabs based on geometry type
function setupTabsForGeometry(geometryType) {
    const tabsContainer = document.querySelector('.style-tabs');
    const fillTab = document.getElementById('fill-tab');
    const outlineTab = document.getElementById('outline-tab');
    const generalTab = document.getElementById('general-tab');
    
    // Hide all tabs first
    fillTab.style.display = 'none';
    outlineTab.style.display = 'none';
    generalTab.style.display = 'none';
    
    // Clear existing tab buttons
    tabsContainer.innerHTML = '';
    
    if (geometryType === 'polygon') {
        // Show Fill and Outline tabs for polygons
        fillTab.style.display = 'block';
        outlineTab.style.display = 'block';
        
        tabsContainer.innerHTML = `
            <button class="tab-btn active" onclick="switchStyleTab('fill')">Fill</button>
            <button class="tab-btn" onclick="switchStyleTab('outline')">Outline</button>
        `;
        
        // Show fill tab by default
        fillTab.classList.add('active');
        outlineTab.classList.remove('active');
    } else {
        // Show General tab for points and lines
        generalTab.style.display = 'block';
        
        const tabLabel = geometryType === 'point' ? 'Point Style' : 
                        geometryType === 'line' ? 'Line Style' : 'Style';
        
        tabsContainer.innerHTML = `
            <button class="tab-btn active" onclick="switchStyleTab('general')">${tabLabel}</button>
        `;
        
        // Show general tab by default
        generalTab.classList.add('active');
        fillTab.classList.remove('active');
        outlineTab.classList.remove('active');
    }
}

// Create default style from current layer styling
function createDefaultStyleFromLayer(layerId, geometryType) {
    const camelCaseId = toCamelCase(layerId);
    
    // Default fallback style
    let defaultStyle = {
        layerId: layerId,
        geometryType: geometryType,
        fill: {
            color: { method: 'simple', value: '#3388ff' },
            opacity: { method: 'simple', value: 0.7 }
        },
        outline: {
            color: { method: 'simple', value: '#000000' },
            opacity: { method: 'simple', value: 1.0 },
            weight: { method: 'simple', value: 2 }
        },
        general: {
            color: { method: 'simple', value: '#3388ff' },
            opacity: { method: 'simple', value: 1.0 },
            size: { method: 'simple', value: 8 }
        }
    };
    
    // Try to get current styling from first feature in the layer
    if (typeof layerGroups !== 'undefined') {
        const layerGroup = layerGroups[camelCaseId];
        if (layerGroup) {
            layerGroup.eachLayer(layer => {
                function extractCurrentStyle(currentLayer) {
                    if (currentLayer.getLayers) {
                        currentLayer.getLayers().forEach(subLayer => extractCurrentStyle(subLayer));
                    } else if (currentLayer.setStyle && currentLayer.options) {
                        const options = currentLayer.options;
                        
                        // Extract current styles
                        if (geometryType === 'polygon') {
                            if (options.fillColor) defaultStyle.fill.color.value = options.fillColor;
                            if (options.fillOpacity !== undefined) defaultStyle.fill.opacity.value = options.fillOpacity;
                            if (options.color) defaultStyle.outline.color.value = options.color;
                            if (options.opacity !== undefined) defaultStyle.outline.opacity.value = options.opacity;
                            if (options.weight !== undefined) defaultStyle.outline.weight.value = options.weight;
                        } else {
                            if (options.color) defaultStyle.general.color.value = options.color;
                            if (options.opacity !== undefined) defaultStyle.general.opacity.value = options.opacity;
                            if (options.weight !== undefined) defaultStyle.general.size.value = options.weight;
                            if (options.radius !== undefined) defaultStyle.general.size.value = options.radius;
                        }
                        return true; // Stop after first feature
                    }
                }
                
                extractCurrentStyle(layer);
            });
        }
    }
    
    return defaultStyle;
}

// Load style configuration into modal
function loadStyleToModal(style, geometryType) {
    // Set method dropdowns based on geometry type
    if (geometryType === 'polygon') {
        // Load fill and outline settings
        document.getElementById('fill-color-method').value = style.fill.color.method;
        document.getElementById('fill-opacity-method').value = style.fill.opacity.method;
        document.getElementById('outline-color-method').value = style.outline.color.method;
        document.getElementById('outline-opacity-method').value = style.outline.opacity.method;
        document.getElementById('outline-weight-method').value = style.outline.weight.method;
        
        // Update control panels
        updateStyleControls('fill-color', style.fill.color);
        updateStyleControls('fill-opacity', style.fill.opacity);
        updateStyleControls('outline-color', style.outline.color);
        updateStyleControls('outline-opacity', style.outline.opacity);
        updateStyleControls('outline-weight', style.outline.weight);
    } else {
        // Load general settings for points and lines
        document.getElementById('general-color-method').value = style.general.color.method;
        document.getElementById('general-opacity-method').value = style.general.opacity.method;
        document.getElementById('general-size-method').value = style.general.size.method;
        
        // Update control panels
        updateStyleControls('general-color', style.general.color);
        updateStyleControls('general-opacity', style.general.opacity);
        updateStyleControls('general-size', style.general.size);
    }
}

// Update style controls based on selected method
function updateStyleControls(controlId, styleConfig) {
    const controlsDiv = document.getElementById(`${controlId}-controls`);
    const method = styleConfig.method;
    
    controlsDiv.innerHTML = '';
    
    switch (method) {
        case 'simple':
            createSimpleControls(controlsDiv, controlId, styleConfig);
            break;
        case 'categorized':
            createCategorizedControls(controlsDiv, controlId, styleConfig);
            break;
        case 'graduated':
            createGraduatedControls(controlsDiv, controlId, styleConfig);
            break;
    }
}

// Create simple style controls
function createSimpleControls(container, controlId, styleConfig) {
    const type = controlId.split('-')[1]; // color, opacity, size, weight
    
    if (type === 'color') {
        container.innerHTML = `
            <input type="color" id="${controlId}-value" value="${styleConfig.value || '#3388ff'}">
        `;
    } else if (type === 'opacity') {
        container.innerHTML = `
            <input type="range" id="${controlId}-value" min="0" max="1" step="0.1" value="${styleConfig.value || 1}">
            <span id="${controlId}-display">${styleConfig.value || 1}</span>
        `;
        
        // Update display when slider changes
        const slider = container.querySelector(`#${controlId}-value`);
        const display = container.querySelector(`#${controlId}-display`);
        slider.addEventListener('input', () => {
            display.textContent = slider.value;
        });
    } else { // size or weight
        container.innerHTML = `
            <input type="number" id="${controlId}-value" min="1" max="20" value="${styleConfig.value || 2}">
        `;
    }
}

// Create categorized style controls
function createCategorizedControls(container, controlId, styleConfig) {
    container.innerHTML = `
        <div>
            <label>Attribute:</label>
            <select id="${controlId}-attribute">
                <option value="">Select attribute...</option>
            </select>
        </div>
        <div id="${controlId}-categories"></div>
        <button onclick="addCategory('${controlId}')">Add Category</button>
    `;
    
    // Populate attributes
    populateAttributeDropdown(`${controlId}-attribute`);
}

// Create graduated style controls
function createGraduatedControls(container, controlId, styleConfig) {
    const type = controlId.split('-')[1];
    
    container.innerHTML = `
        <div>
            <label>Attribute:</label>
            <select id="${controlId}-attribute">
                <option value="">Select attribute...</option>
            </select>
        </div>
        <div class="graduated-controls">
            ${type === 'color' ? `
                <div>
                    <label>Start Color:</label>
                    <input type="color" id="${controlId}-start-color" value="${styleConfig.startColor || '#ffffcc'}">
                </div>
                <div>
                    <label>End Color:</label>
                    <input type="color" id="${controlId}-end-color" value="${styleConfig.endColor || '#800026'}">
                </div>
            ` : `
                <div>
                    <label>Min Value:</label>
                    <input type="number" id="${controlId}-min" value="${styleConfig.min || 0}" step="0.1">
                </div>
                <div>
                    <label>Max Value:</label>
                    <input type="number" id="${controlId}-max" value="${styleConfig.max || 10}" step="0.1">
                </div>
            `}
            <div>
                <label>Classes:</label>
                <input type="number" id="${controlId}-classes" min="2" max="10" value="${styleConfig.classes || 5}">
            </div>
        </div>
    `;
    
    // Populate attributes
    populateAttributeDropdown(`${controlId}-attribute`);
}

// Populate attribute dropdown for current layer
function populateAttributeDropdown(selectId) {
    const modal = document.getElementById('style-modal');
    const layerId = modal.getAttribute('data-current-layer');
    const select = document.getElementById(selectId);
    
    // Clear existing options except the first one
    select.innerHTML = '<option value="">Select attribute...</option>';
    
    // Get layer group and extract attributes
    const camelCaseId = toCamelCase(layerId);
    
    // Check if layerGroups is available (from map.js)
    if (typeof layerGroups === 'undefined') {
        console.log('layerGroups not available yet');
        return;
    }
    
    const layerGroup = layerGroups[camelCaseId];
    
    if (layerGroup) {
        const attributes = new Set();
        
        layerGroup.eachLayer(layer => {
            function getAllFeatures(currentLayer) {
                if (currentLayer.getLayers) {
                    currentLayer.getLayers().forEach(subLayer => getAllFeatures(subLayer));
                } else if (currentLayer.feature && currentLayer.feature.properties) {
                    Object.keys(currentLayer.feature.properties).forEach(key => {
                        const value = currentLayer.feature.properties[key];
                        // Include both numeric and string attributes for styling
                        if (typeof value === 'number' || typeof value === 'string') {
                            attributes.add(key);
                        }
                    });
                }
            }
            getAllFeatures(layer);
        });
        
        // Add attributes to dropdown
        Array.from(attributes).sort().forEach(attr => {
            const option = document.createElement('option');
            option.value = attr;
            option.textContent = attr;
            select.appendChild(option);
        });
    }
}

// Apply the configured style to the layer
function applyStyle() {
    const modal = document.getElementById('style-modal');
    const layerId = modal.getAttribute('data-current-layer');
    
    // Collect style configuration from modal
    const styleConfig = collectStyleFromModal();
    
    // Store the style configuration
    layerStyles[layerId] = styleConfig;
    
    // Apply the style to the actual layer
    applyStyleToLayer(styleConfig);
    
    // Close modal
    closeStyleModal();
}

// Collect style configuration from modal inputs
function collectStyleFromModal() {
    const modal = document.getElementById('style-modal');
    const layerId = modal.getAttribute('data-current-layer');
    const geometryType = getLayerGeometryType(layerId);
    
    const styleConfig = {
        layerId: layerId,
        geometryType: geometryType
    };
    
    if (geometryType === 'polygon') {
        // Collect fill and outline settings
        styleConfig.fill = {
            color: {
                method: document.getElementById('fill-color-method').value,
                ...collectMethodConfig('fill-color')
            },
            opacity: {
                method: document.getElementById('fill-opacity-method').value,
                ...collectMethodConfig('fill-opacity')
            }
        };
        
        styleConfig.outline = {
            color: {
                method: document.getElementById('outline-color-method').value,
                ...collectMethodConfig('outline-color')
            },
            opacity: {
                method: document.getElementById('outline-opacity-method').value,
                ...collectMethodConfig('outline-opacity')
            },
            weight: {
                method: document.getElementById('outline-weight-method').value,
                ...collectMethodConfig('outline-weight')
            }
        };
    } else {
        // Collect general settings for points and lines
        styleConfig.general = {
            color: {
                method: document.getElementById('general-color-method').value,
                ...collectMethodConfig('general-color')
            },
            opacity: {
                method: document.getElementById('general-opacity-method').value,
                ...collectMethodConfig('general-opacity')
            },
            size: {
                method: document.getElementById('general-size-method').value,
                ...collectMethodConfig('general-size')
            }
        };
    }
    
    return styleConfig;
}

// Collect configuration for a specific styling method
function collectMethodConfig(controlId) {
    const method = document.getElementById(`${controlId}-method`).value;
    const config = { method };
    
    switch (method) {
        case 'simple':
            const valueInput = document.getElementById(`${controlId}-value`);
            config.value = valueInput.type === 'color' ? valueInput.value : parseFloat(valueInput.value);
            break;
            
        case 'categorized':
            config.attribute = document.getElementById(`${controlId}-attribute`).value;
            config.categories = []; // Collect category configurations
            break;
            
        case 'graduated':
            config.attribute = document.getElementById(`${controlId}-attribute`).value;
            config.classes = parseInt(document.getElementById(`${controlId}-classes`).value);
            
            const type = controlId.split('-')[1];
            if (type === 'color') {
                config.startColor = document.getElementById(`${controlId}-start-color`).value;
                config.endColor = document.getElementById(`${controlId}-end-color`).value;
            } else {
                config.min = parseFloat(document.getElementById(`${controlId}-min`).value);
                config.max = parseFloat(document.getElementById(`${controlId}-max`).value);
            }
            break;
    }
    
    return config;
}

// Apply style configuration to actual layer
function applyStyleToLayer(styleConfig) {
    const layerId = styleConfig.layerId;
    const camelCaseId = toCamelCase(layerId);
    
    // Check if layerGroups is available (from map.js)
    if (typeof layerGroups === 'undefined') {
        console.log('layerGroups not available yet');
        return;
    }
    
    const layerGroup = layerGroups[camelCaseId];
    
    if (!layerGroup) {
        console.log('Layer group not found for:', layerId);
        return;
    }
    
    layerGroup.eachLayer(layer => {
        function styleFeature(currentLayer) {
            if (currentLayer.getLayers) {
                currentLayer.getLayers().forEach(subLayer => styleFeature(subLayer));
            } else if (currentLayer.feature && currentLayer.setStyle) {
                const newStyle = calculateFeatureStyle(currentLayer.feature, styleConfig);
                currentLayer.setStyle(newStyle);
                
                // Store original style for resetting
                if (!currentLayer.options.originalStyle) {
                    currentLayer.options.originalStyle = {
                        color: currentLayer.options.color,
                        fillColor: currentLayer.options.fillColor,
                        opacity: currentLayer.options.opacity,
                        fillOpacity: currentLayer.options.fillOpacity,
                        weight: currentLayer.options.weight,
                        radius: currentLayer.options.radius
                    };
                }
            }
        }
        styleFeature(layer);
    });
}

// Calculate style for individual feature based on configuration
function calculateFeatureStyle(feature, styleConfig) {
    const style = {};
    
    if (styleConfig.geometryType === 'polygon') {
        // Apply fill and outline styling
        if (styleConfig.fill) {
            if (styleConfig.fill.color) {
                style.fillColor = calculateStyleValue(feature, styleConfig.fill.color);
            }
            if (styleConfig.fill.opacity) {
                style.fillOpacity = calculateStyleValue(feature, styleConfig.fill.opacity);
            }
        }
        
        if (styleConfig.outline) {
            if (styleConfig.outline.color) {
                style.color = calculateStyleValue(feature, styleConfig.outline.color);
            }
            if (styleConfig.outline.opacity) {
                style.opacity = calculateStyleValue(feature, styleConfig.outline.opacity);
            }
            if (styleConfig.outline.weight) {
                style.weight = calculateStyleValue(feature, styleConfig.outline.weight);
            }
        }
    } else {
        // Apply general styling for points and lines
        if (styleConfig.general) {
            if (styleConfig.general.color) {
                style.color = calculateStyleValue(feature, styleConfig.general.color);
            }
            if (styleConfig.general.opacity) {
                style.opacity = calculateStyleValue(feature, styleConfig.general.opacity);
            }
            if (styleConfig.general.size) {
                if (styleConfig.geometryType === 'point') {
                    style.radius = calculateStyleValue(feature, styleConfig.general.size);
                } else {
                    style.weight = calculateStyleValue(feature, styleConfig.general.size);
                }
            }
        }
    }
    
    return style;
}

// Calculate individual style value based on method and feature properties
function calculateStyleValue(feature, styleConfig) {
    const { method } = styleConfig;
    
    switch (method) {
        case 'simple':
            return styleConfig.value;
            
        case 'categorized':
            const categoryValue = feature.properties[styleConfig.attribute];
            // Find matching category and return its style value
            const category = styleConfig.categories.find(cat => cat.value === categoryValue);
            return category ? category.style : styleConfig.defaultValue;
            
        case 'graduated':
            const attributeValue = feature.properties[styleConfig.attribute];
            if (typeof attributeValue !== 'number') return styleConfig.defaultValue;
            
            // Calculate graduated value based on attribute
            return calculateGraduatedValue(attributeValue, styleConfig);
            
        default:
            return styleConfig.value || styleConfig.defaultValue;
    }
}

// Calculate graduated value (color interpolation or numeric interpolation)
function calculateGraduatedValue(value, styleConfig) {
    const { min, max, classes, startColor, endColor } = styleConfig;
    
    // Normalize value to 0-1 range
    const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    if (startColor && endColor) {
        // Color interpolation
        return interpolateColor(startColor, endColor, normalizedValue);
    } else {
        // Numeric interpolation
        return min + (max - min) * normalizedValue;
    }
}

// Interpolate between two colors
function interpolateColor(startColor, endColor, factor) {
    const start = hexToRgb(startColor);
    const end = hexToRgb(endColor);
    
    const r = Math.round(start.r + (end.r - start.r) * factor);
    const g = Math.round(start.g + (end.g - start.g) * factor);
    const b = Math.round(start.b + (end.b - start.b) * factor);
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Close styling modal
function closeStyleModal() {
    const modal = document.getElementById('style-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Reset layer to default style
function resetStyle() {
    const modal = document.getElementById('style-modal');
    const layerId = modal.getAttribute('data-current-layer');
    
    // Remove stored style
    delete layerStyles[layerId];
    
    // Get geometry type and create default style from current layer
    const geometryType = getLayerGeometryType(layerId);
    const defaultStyle = createDefaultStyleFromLayer(layerId, geometryType);
    
    // Apply default style
    applyStyleToLayer(defaultStyle);
    
    // Reload modal with default values
    loadStyleToModal(defaultStyle, geometryType);
}

// Add event listeners for method dropdowns
function setupStyleEventListeners() {
    const methodSelects = [
        'fill-color-method', 'fill-opacity-method',
        'outline-color-method', 'outline-opacity-method', 'outline-weight-method',
        'general-color-method', 'general-opacity-method', 'general-size-method'
    ];
    
    methodSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.addEventListener('change', function() {
                const controlId = selectId.replace('-method', '');
                const styleConfig = { method: this.value };
                updateStyleControls(controlId, styleConfig);
            });
        }
    });
}

// Initialize the styling system when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait for the map to be fully loaded before initializing styling
    setTimeout(() => {
        initializeStyling();
        setupStyleEventListeners();
    }, 3000); // Wait 3 seconds for map to load
});

// Also try to initialize when window loads (backup)
window.addEventListener('load', function() {
    setTimeout(() => {
        if (document.querySelectorAll('.palette-icon').length > 0) {
            initializeStyling();
        }
    }, 2000);
});

// Add category to categorized styling
function addCategory(controlId) {
    const categoriesDiv = document.getElementById(`${controlId}-categories`);
    if (!categoriesDiv) return;
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    
    const type = controlId.split('-')[1];
    
    categoryItem.innerHTML = `
        <input type="text" placeholder="Category value" class="category-value">
        ${type === 'color' ? '<input type="color" class="category-style" value="#3388ff">' :
          type === 'opacity' ? '<input type="range" class="category-style" min="0" max="1" step="0.1" value="1">' :
          '<input type="number" class="category-style" min="1" max="20" value="5">'}
        <button onclick="removeCategory(this)">Remove</button>
    `;
    
    categoriesDiv.appendChild(categoryItem);
}

// Remove category from categorized styling
function removeCategory(button) {
    button.parentElement.remove();
}

// Helper function to format layer names (if not already defined in map.js)
function formatLayerName(camelCaseId) {
    const nameMap = {
        'growthZones': 'Growth Zones',
        'housing': 'Housing',
        'ptal': 'PTAL',
        'busLines': 'Bus Lines',
        'busStops': 'Bus Stops',
        'railStations': 'Rail Stations',
        'tcrSchemes': 'TCR Schemes'
    };
    return nameMap[camelCaseId] || camelCaseId;
}

// Helper function to convert to camelCase (if not already defined in map.js)
function toCamelCase(str) {
    return str.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
}
