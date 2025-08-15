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
                <button class="tab-btn active" onclick="switchStyleTab('styling')">Layer Styling</button>
            </div>
            
            <!-- Single Styling Tab with Fill and Outline sections -->
            <div id="styling-tab" class="style-tab active">
                <!-- Fill Section -->
                <div class="style-section">
                    <h4>Fill</h4>
                    
                    <!-- Fill Color -->
                    <div class="style-group">
                        <label>Color:</label>
                        <select id="fill-color-method">
                            <option value="simple">Simple</option>
                            <option value="categorized">Categorized</option>
                            <option value="graduated">Graduated</option>
                        </select>
                        <div id="fill-color-controls"></div>
                    </div>
                    
                    <!-- Fill Opacity -->
                    <div class="style-group">
                        <label>Opacity:</label>
                        <select id="fill-opacity-method">
                            <option value="simple">Simple</option>
                            <option value="graduated">Graduated</option>
                        </select>
                        <div id="fill-opacity-controls"></div>
                    </div>
                </div>
                
                <!-- Outline Section -->
                <div class="style-section">
                    <h4>Outline</h4>
                    
                    <!-- Outline Color -->
                    <div class="style-group">
                        <label>Color:</label>
                        <select id="outline-color-method">
                            <option value="simple">Simple</option>
                            <option value="categorized">Categorized</option>
                            <option value="graduated">Graduated</option>
                        </select>
                        <div id="outline-color-controls"></div>
                    </div>
                    
                    <!-- Outline Opacity -->
                    <div class="style-group">
                        <label>Opacity:</label>
                        <select id="outline-opacity-method">
                            <option value="simple">Simple</option>
                            <option value="graduated">Graduated</option>
                        </select>
                        <div id="outline-opacity-controls"></div>
                    </div>
                    
                    <!-- Outline Weight -->
                    <div class="style-group">
                        <label>Weight:</label>
                        <select id="outline-weight-method">
                            <option value="simple">Simple</option>
                            <option value="graduated">Graduated</option>
                        </select>
                        <div id="outline-weight-controls"></div>
                    </div>
                </div>
                
                <!-- General Section (for points and lines) -->
                <div class="style-section" id="general-section" style="display: none;">
                    <h4>Style</h4>
                    
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

// Switch between styling tabs (simplified for single tab)
function switchStyleTab(tabName) {
    // Remove active class from all tabs and buttons
    document.querySelectorAll('.style-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to selected tab and button
    const tab = document.getElementById(`${tabName}-tab`);
    if (tab) {
        tab.classList.add('active');
        document.querySelector(`[onclick="switchStyleTab('${tabName}')"]`).classList.add('active');
    }
}

// Determine the geometry type of a layer
function getLayerGeometryType(layerId) {
    const camelCaseId = toCamelCase(layerId);
    
    // Special handling for TCR schemes - always treat as polygon for styling purposes
    if (layerId && layerId.includes('schemes')) {
        return 'polygon';
    }
    
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

// Setup sections based on geometry type
function setupTabsForGeometry(geometryType) {
    // Find sections by their position and h4 content
    const styleSections = document.querySelectorAll('.style-section');
    let fillSection = null;
    let outlineSection = null;
    
    styleSections.forEach(section => {
        const h4 = section.querySelector('h4');
        if (h4) {
            if (h4.textContent.includes('Fill')) {
                fillSection = section;
            } else if (h4.textContent.includes('Outline')) {
                outlineSection = section;
            }
        }
    });
    
    const generalSection = document.getElementById('general-section');
    
    if (geometryType === 'polygon' || geometryType === 'unknown') {
        // Show Fill and Outline sections for polygons
        if (fillSection) fillSection.style.display = 'block';
        if (outlineSection) outlineSection.style.display = 'block';
        if (generalSection) generalSection.style.display = 'none';
    } else {
        // Show only General section for points and lines
        if (fillSection) fillSection.style.display = 'none';
        if (outlineSection) outlineSection.style.display = 'none';
        if (generalSection) {
            generalSection.style.display = 'block';
            // Update the header based on geometry type
            const header = generalSection.querySelector('h4');
            if (header) {
                header.textContent = geometryType === 'point' ? 'Point Style' : 
                                   geometryType === 'line' ? 'Line Style' : 'Style';
            }
        }
    }
    
    // Special handling for TCR Schemes - treat as polygon but apply to mixed geometry
    const modal = document.getElementById('style-modal');
    const layerId = modal ? modal.getAttribute('data-current-layer') : null;
    if (layerId && layerId.includes('schemes')) {
        if (fillSection) fillSection.style.display = 'block';
        if (outlineSection) outlineSection.style.display = 'block';
        if (generalSection) generalSection.style.display = 'none';
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
                            // Handle transparent fills properly
                            if (options.fillColor !== undefined) {
                                defaultStyle.fill.color.value = options.fillColor === 'transparent' ? 'transparent' : options.fillColor;
                            }
                            if (options.fillOpacity !== undefined) {
                                defaultStyle.fill.opacity.value = options.fillOpacity;
                            }
                            if (options.color !== undefined) {
                                defaultStyle.outline.color.value = options.color;
                            }
                            if (options.opacity !== undefined) {
                                defaultStyle.outline.opacity.value = options.opacity;
                            }
                            if (options.weight !== undefined) {
                                defaultStyle.outline.weight.value = options.weight;
                            }
                        } else {
                            if (options.color !== undefined) {
                                defaultStyle.general.color.value = options.color;
                            }
                            if (options.opacity !== undefined) {
                                defaultStyle.general.opacity.value = options.opacity;
                            }
                            if (options.weight !== undefined) {
                                defaultStyle.general.size.value = options.weight;
                            }
                            if (options.radius !== undefined) {
                                defaultStyle.general.size.value = options.radius;
                            }
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
    
    console.log('updateStyleControls called with:', controlId, method, styleConfig);
    
    controlsDiv.innerHTML = '';
    
    switch (method) {
        case 'simple':
            console.log('Creating simple controls for:', controlId);
            createSimpleControls(controlsDiv, controlId, styleConfig);
            break;
        case 'categorized':
            console.log('Creating categorized controls for:', controlId);
            createCategorizedControls(controlsDiv, controlId, styleConfig);
            break;
        case 'graduated':
            console.log('Creating graduated controls for:', controlId);
            createGraduatedControls(controlsDiv, controlId, styleConfig);
            break;
        default:
            console.log('Unknown method:', method);
    }
}

// Create simple style controls
function createSimpleControls(container, controlId, styleConfig) {
    const type = controlId.split('-')[1]; // color, opacity, size, weight
    
    if (type === 'color') {
        // Handle transparent colors specially for fill
        const isTransparent = styleConfig.value === 'transparent';
        const colorValue = isTransparent ? '#ffffff' : (styleConfig.value || '#3388ff');
        
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="color" id="${controlId}-value" value="${colorValue}" ${isTransparent ? 'disabled' : ''}>
                <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" id="${controlId}-transparent" ${isTransparent ? 'checked' : ''}>
                    Transparent
                </label>
            </div>
        `;
        
        // Add event listeners
        const colorInput = container.querySelector(`#${controlId}-value`);
        const transparentCheckbox = container.querySelector(`#${controlId}-transparent`);
        
        transparentCheckbox.addEventListener('change', function() {
            colorInput.disabled = this.checked;
            if (this.checked) {
                colorInput.style.opacity = '0.5';
            } else {
                colorInput.style.opacity = '1';
            }
        });
        
        // Set initial state
        if (isTransparent) {
            colorInput.style.opacity = '0.5';
        }
        
    } else if (type === 'opacity') {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="range" id="${controlId}-value" min="0" max="1" step="0.1" value="${styleConfig.value || 1}" style="flex: 1;">
                <span id="${controlId}-display" style="min-width: 40px;">${Math.round((styleConfig.value || 1) * 100)}%</span>
            </div>
        `;
        
        // Update display when slider changes
        const slider = container.querySelector(`#${controlId}-value`);
        const display = container.querySelector(`#${controlId}-display`);
        slider.addEventListener('input', () => {
            display.textContent = Math.round(slider.value * 100) + '%';
        });
    } else { // size or weight
        container.innerHTML = `
            <input type="number" id="${controlId}-value" min="1" max="20" value="${styleConfig.value || 2}" style="width: 80px;">
        `;
    }
}



// Create graduated style controls
function createGraduatedControls(container, controlId, styleConfig) {
    const type = controlId.split('-')[1];
    
    container.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label>Attribute:</label>
            <select id="${controlId}-attribute" style="width: 100%; margin-top: 5px;">
                <option value="">Select attribute...</option>
            </select>
        </div>
        <div class="graduated-controls">
            ${type === 'color' ? `
                <div style="margin-bottom: 10px;">
                    <label>Color Scheme:</label>
                    <select id="${controlId}-color-scheme" style="width: 100%; margin-top: 5px;">
                        <option value="custom">Custom Colors</option>
                        <option value="viridis">Viridis</option>
                        <option value="plasma">Plasma</option>
                        <option value="blue-red">Blue to Red</option>
                        <option value="green-yellow-red">Green-Yellow-Red</option>
                        <option value="blues">Blues</option>
                        <option value="reds">Reds</option>
                        <option value="greens">Greens</option>
                    </select>
                </div>
                <div id="${controlId}-custom-colors" style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label>Start Color:</label>
                        <input type="color" id="${controlId}-start-color" value="${styleConfig.startColor || '#ffffcc'}">
                    </div>
                    <div>
                        <label>End Color:</label>
                        <input type="color" id="${controlId}-end-color" value="${styleConfig.endColor || '#800026'}">
                    </div>
                </div>
            ` : `
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label>Min Value:</label>
                        <input type="number" id="${controlId}-min" value="${styleConfig.min || 0}" step="0.1">
                    </div>
                    <div>
                        <label>Max Value:</label>
                        <input type="number" id="${controlId}-max" value="${styleConfig.max || 10}" step="0.1">
                    </div>
                </div>
            `}
            <div>
                <label>Classes:</label>
                <input type="number" id="${controlId}-classes" min="2" max="10" value="${styleConfig.classes || 5}" style="width: 80px;">
            </div>
        </div>
    `;
    
    // Add event listener for color scheme selection
    if (type === 'color') {
        const schemeSelect = container.querySelector(`#${controlId}-color-scheme`);
        const customColors = container.querySelector(`#${controlId}-custom-colors`);
        
        schemeSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customColors.style.display = 'flex';
            } else {
                customColors.style.display = 'none';
                // Update colors based on selected scheme
                updateColorsFromScheme(controlId, this.value);
            }
        });
        
        // Set initial scheme if specified
        if (styleConfig.colorScheme) {
            schemeSelect.value = styleConfig.colorScheme;
            if (styleConfig.colorScheme !== 'custom') {
                customColors.style.display = 'none';
            }
        }
    }
    
    // Populate attributes after the container is updated
    setTimeout(() => {
        populateAttributeDropdown(`${controlId}-attribute`);
        
        // Set the attribute if it exists in styleConfig
        if (styleConfig.attribute) {
            const select = document.getElementById(`${controlId}-attribute`);
            if (select) {
                select.value = styleConfig.attribute;
            }
        }
    }, 100);
}

// Update colors based on selected color scheme
function updateColorsFromScheme(controlId, scheme) {
    const colorSchemes = {
        'viridis': { start: '#440154', end: '#fde725' },
        'plasma': { start: '#0d0887', end: '#f0f921' },
        'blue-red': { start: '#313695', end: '#a50026' },
        'green-yellow-red': { start: '#006837', end: '#a50026' },
        'blues': { start: '#f7fbff', end: '#08306b' },
        'reds': { start: '#fff5f0', end: '#67000d' },
        'greens': { start: '#f7fcf5', end: '#00441b' }
    };
    
    const colors = colorSchemes[scheme];
    if (colors) {
        const startColorInput = document.getElementById(`${controlId}-start-color`);
        const endColorInput = document.getElementById(`${controlId}-end-color`);
        
        if (startColorInput) startColorInput.value = colors.start;
        if (endColorInput) endColorInput.value = colors.end;
    }
}

// Enhanced categorized controls with random color generation
function createCategorizedControls(container, controlId, styleConfig) {
    console.log('Creating categorized controls for:', controlId, styleConfig);
    
    container.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label>Attribute:</label>
            <select id="${controlId}-attribute" style="width: 100%; margin-top: 5px;">
                <option value="">Select attribute...</option>
            </select>
        </div>
        <div style="margin-bottom: 10px;">
            <button type="button" onclick="generateRandomColors('${controlId}')" style="margin-right: 10px;">Generate Random Colors</button>
            <button type="button" onclick="generateUniqueValues('${controlId}')" style="margin-right: 10px;">Add Unique Values</button>
        </div>
        <div id="${controlId}-categories"></div>
        <button type="button" onclick="addCategory('${controlId}')">Add Category</button>
    `;
    
    console.log('Categorized controls HTML created, setting up dropdown population');
    
    // Populate attributes after the container is updated
    setTimeout(() => {
        console.log('Populating attribute dropdown for categorized controls');
        populateAttributeDropdown(`${controlId}-attribute`);
        
        // Set the attribute if it exists in styleConfig
        if (styleConfig.attribute) {
            const select = document.getElementById(`${controlId}-attribute`);
            if (select) {
                select.value = styleConfig.attribute;
            }
        }
        
        // Add existing categories if they exist
        if (styleConfig.categories && styleConfig.categories.length > 0) {
            styleConfig.categories.forEach(category => {
                addCategory(controlId, category.value, category.style);
            });
        }
    }, 100);
}

// Generate random colors for existing categories
function generateRandomColors(controlId) {
    const categoriesDiv = document.getElementById(`${controlId}-categories`);
    if (!categoriesDiv) return;
    
    const categoryItems = categoriesDiv.querySelectorAll('.category-item');
    const type = controlId.split('-')[1];
    
    if (type === 'color') {
        categoryItems.forEach(item => {
            const styleInput = item.querySelector('.category-style');
            if (styleInput && styleInput.type === 'color') {
                styleInput.value = generateRandomColor();
            }
        });
    }
}

// Generate unique values from the selected attribute
function generateUniqueValues(controlId) {
    const attributeSelect = document.getElementById(`${controlId}-attribute`);
    if (!attributeSelect || !attributeSelect.value) {
        alert('Please select an attribute first.');
        return;
    }
    
    const modal = document.getElementById('style-modal');
    const layerId = modal.getAttribute('data-current-layer');
    const camelCaseId = toCamelCase(layerId);
    
    if (typeof layerGroups === 'undefined') return;
    
    const layerGroup = layerGroups[camelCaseId];
    if (!layerGroup) return;
    
    const uniqueValues = new Set();
    const attribute = attributeSelect.value;
    
    // Collect unique values
    layerGroup.eachLayer(layer => {
        function collectValues(currentLayer) {
            if (currentLayer.getLayers) {
                currentLayer.getLayers().forEach(subLayer => collectValues(subLayer));
            } else if (currentLayer.feature && currentLayer.feature.properties) {
                const value = currentLayer.feature.properties[attribute];
                if (value !== undefined && value !== null) {
                    uniqueValues.add(String(value));
                }
            }
        }
        collectValues(layer);
    });
    
    // Clear existing categories
    const categoriesDiv = document.getElementById(`${controlId}-categories`);
    if (categoriesDiv) {
        categoriesDiv.innerHTML = '';
    }
    
    // Add categories for each unique value
    const type = controlId.split('-')[1];
    Array.from(uniqueValues).sort().forEach(value => {
        const style = type === 'color' ? generateRandomColor() : 
                     type === 'opacity' ? Math.random().toFixed(1) :
                     Math.floor(Math.random() * 10) + 1;
        addCategory(controlId, value, style);
    });
}

// Generate a random color
function generateRandomColor() {
    const colors = [
        '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', 
        '#ffff33', '#a65628', '#f781bf', '#999999', '#66c2a5', 
        '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Populate attribute dropdown for current layer
function populateAttributeDropdown(selectId) {
    const modal = document.getElementById('style-modal');
    const layerId = modal.getAttribute('data-current-layer');
    const select = document.getElementById(selectId);
    
    console.log('Populating attribute dropdown for:', selectId, 'layerId:', layerId);
    
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
    console.log('Found layer group:', camelCaseId, layerGroup);
    
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
        
        console.log('Found attributes:', Array.from(attributes));
        
        // Add attributes to dropdown
        Array.from(attributes).sort().forEach(attr => {
            const option = document.createElement('option');
            option.value = attr;
            option.textContent = attr;
            select.appendChild(option);
        });
        
        console.log('Populated dropdown with', attributes.size, 'attributes');
    } else {
        console.log('No layer group found for:', camelCaseId);
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
    
    // Create legend summary for complex styling methods
    const geometryType = getLayerGeometryType(layerId);
    const hasComplexStyling = checkForComplexStyling(styleConfig);
    if (hasComplexStyling) {
        createLegendSummary(styleConfig, geometryType);
    }
    
    // Close modal immediately
    closeStyleModal();
    
    // Prevent any event bubbling that might trigger other modals
    return false;
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
            if (valueInput.type === 'color') {
                // Check for transparent checkbox
                const transparentCheckbox = document.getElementById(`${controlId}-transparent`);
                if (transparentCheckbox && transparentCheckbox.checked) {
                    config.value = 'transparent';
                } else {
                    config.value = valueInput.value;
                }
            } else {
                config.value = parseFloat(valueInput.value);
            }
            break;
            
        case 'categorized':
            config.attribute = document.getElementById(`${controlId}-attribute`).value;
            config.categories = [];
            
            // Collect categories from the UI
            const categoriesDiv = document.getElementById(`${controlId}-categories`);
            if (categoriesDiv) {
                const categoryItems = categoriesDiv.querySelectorAll('.category-item');
                categoryItems.forEach(item => {
                    const valueInput = item.querySelector('.category-value');
                    const styleInput = item.querySelector('.category-style');
                    if (valueInput && styleInput && valueInput.value.trim()) {
                        config.categories.push({
                            value: valueInput.value.trim(),
                            style: styleInput.type === 'color' ? styleInput.value : parseFloat(styleInput.value)
                        });
                    }
                });
            }
            
            config.defaultValue = '#cccccc'; // Default color for unmatched categories
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
                let newStyle = {};
                
                // Special handling for TCR schemes (mixed geometry)
                if (layerId && layerId.includes('schemes')) {
                    const geomType = currentLayer.feature.geometry.type;
                    
                    if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                        // Apply fill and outline to polygons
                        newStyle = calculateFeatureStyle(currentLayer.feature, styleConfig);
                    } else if (geomType === 'Point' || geomType === 'MultiPoint') {
                        // Apply outline styles as point styles
                        if (styleConfig.outline) {
                            if (styleConfig.outline.color) {
                                newStyle.color = calculateStyleValue(currentLayer.feature, styleConfig.outline.color);
                            }
                            if (styleConfig.outline.opacity) {
                                newStyle.opacity = calculateStyleValue(currentLayer.feature, styleConfig.outline.opacity);
                            }
                            if (styleConfig.outline.weight) {
                                newStyle.radius = calculateStyleValue(currentLayer.feature, styleConfig.outline.weight) * 2;
                            }
                        }
                    } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
                        // Apply outline styles as line styles
                        if (styleConfig.outline) {
                            if (styleConfig.outline.color) {
                                newStyle.color = calculateStyleValue(currentLayer.feature, styleConfig.outline.color);
                            }
                            if (styleConfig.outline.opacity) {
                                newStyle.opacity = calculateStyleValue(currentLayer.feature, styleConfig.outline.opacity);
                            }
                            if (styleConfig.outline.weight) {
                                newStyle.weight = calculateStyleValue(currentLayer.feature, styleConfig.outline.weight);
                            }
                        }
                    }
                } else {
                    // Standard styling for homogeneous layers
                    newStyle = calculateFeatureStyle(currentLayer.feature, styleConfig);
                }
                
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
    
    // Update the legend to reflect the new styling
    updateLegendStyling(styleConfig);
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
    
    // Reset the actual layer to original styles
    resetLayerToOriginal(layerId);
    
    // Get geometry type and create default style from current layer
    const geometryType = getLayerGeometryType(layerId);
    const defaultStyle = createDefaultStyleFromLayer(layerId, geometryType);
    
    // Remove any legend summary
    const summaryContainer = document.getElementById(`${layerId}-legend-summary`);
    if (summaryContainer) {
        summaryContainer.remove();
    }
    
    // Reset legend color indicator to default
    const legendColorDiv = findLegendColorIndicator(layerId);
    if (legendColorDiv) {
        resetLegendColorToDefault(legendColorDiv, geometryType);
    }
    
    // Reload modal with default values
    loadStyleToModal(defaultStyle, geometryType);
}

// Reset layer to original styling on the map
function resetLayerToOriginal(layerId) {
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
        function resetFeature(currentLayer) {
            if (currentLayer.getLayers) {
                currentLayer.getLayers().forEach(subLayer => resetFeature(subLayer));
            } else if (currentLayer.feature && currentLayer.setStyle && currentLayer.options.originalStyle) {
                // Reset to original style if available
                currentLayer.setStyle(currentLayer.options.originalStyle);
            } else if (currentLayer.feature && currentLayer.setStyle) {
                // Reset to default style based on geometry type
                const geometryType = getLayerGeometryType(layerId);
                let defaultStyle = {};
                
                if (geometryType === 'polygon') {
                    defaultStyle = {
                        fillColor: '#3388ff',
                        fillOpacity: 0.7,
                        color: '#000000',
                        opacity: 1.0,
                        weight: 2
                    };
                } else if (geometryType === 'point') {
                    defaultStyle = {
                        color: '#3388ff',
                        opacity: 1.0,
                        radius: 8,
                        fillOpacity: 0.7
                    };
                } else if (geometryType === 'line') {
                    defaultStyle = {
                        color: '#3388ff',
                        opacity: 1.0,
                        weight: 3
                    };
                }
                
                currentLayer.setStyle(defaultStyle);
            }
        }
        resetFeature(layer);
    });
}

// Reset legend color indicator to default styling
function resetLegendColorToDefault(colorDiv, geometryType) {
    if (!colorDiv) return;
    
    // Reset to default styling based on geometry type
    if (geometryType === 'polygon') {
        colorDiv.style.backgroundColor = 'transparent';
        colorDiv.style.border = '2px solid #000';
        colorDiv.style.opacity = '1';
        colorDiv.style.borderRadius = '';
    } else if (geometryType === 'point') {
        colorDiv.style.backgroundColor = '#3388ff';
        colorDiv.style.border = '1px solid #000';
        colorDiv.style.opacity = '1';
        colorDiv.style.borderRadius = '50%';
    } else if (geometryType === 'line') {
        colorDiv.style.backgroundColor = 'transparent';
        colorDiv.style.border = 'none';
        colorDiv.style.borderTop = '2px solid #3388ff';
        colorDiv.style.opacity = '1';
        colorDiv.style.borderRadius = '';
    }
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
            console.log('Setting up event listener for:', selectId);
            select.addEventListener('change', function() {
                const controlId = selectId.replace('-method', '');
                const styleConfig = { method: this.value };
                console.log('Method changed:', selectId, 'to', this.value, 'controlId:', controlId);
                updateStyleControls(controlId, styleConfig);
            });
        } else {
            console.log('No select element found for:', selectId);
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
function addCategory(controlId, value = '', style = '') {
    const categoriesDiv = document.getElementById(`${controlId}-categories`);
    if (!categoriesDiv) return;
    
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.style.cssText = 'margin-bottom: 5px; padding: 5px; border: 1px solid #ddd; border-radius: 3px;';
    
    const type = controlId.split('-')[1];
    
    let styleInput = '';
    if (type === 'color') {
        styleInput = `<input type="color" class="category-style" value="${style || '#3388ff'}">`;
    } else if (type === 'opacity') {
        styleInput = `<input type="range" class="category-style" min="0" max="1" step="0.1" value="${style || '1'}">`;
    } else {
        styleInput = `<input type="number" class="category-style" min="1" max="20" value="${style || '5'}">`;
    }
    
    categoryItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px;">
            <input type="text" placeholder="Category value" class="category-value" value="${value}" style="flex: 1;">
            ${styleInput}
            <button onclick="removeCategory(this)" style="padding: 2px 6px;">Remove</button>
        </div>
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

// Check if the style configuration uses complex styling (categorized/graduated)
function checkForComplexStyling(styleConfig) {
    if (styleConfig.fill) {
        if (styleConfig.fill.color.method !== 'simple' || 
            styleConfig.fill.opacity.method !== 'simple') {
            return true;
        }
    }
    
    if (styleConfig.outline) {
        if (styleConfig.outline.color.method !== 'simple' || 
            styleConfig.outline.opacity.method !== 'simple' || 
            styleConfig.outline.weight.method !== 'simple') {
            return true;
        }
    }
    
    if (styleConfig.general) {
        if (styleConfig.general.color.method !== 'simple' || 
            styleConfig.general.opacity.method !== 'simple' || 
            styleConfig.general.size.method !== 'simple') {
            return true;
        }
    }
    
    return false;
}

// Update legend styling to reflect applied styles
function updateLegendStyling(styleConfig) {
    const layerId = styleConfig.layerId;
    const geometryType = styleConfig.geometryType;
    
    // Find the legend color indicator for this layer
    const legendColorDiv = findLegendColorIndicator(layerId);
    
    if (!legendColorDiv) {
        console.log('Legend color indicator not found for layer:', layerId);
        return;
    }
    
    // Update the legend based on styling method
    updateLegendColorIndicator(legendColorDiv, styleConfig, geometryType);
}

// Find the color indicator div in the legend for a specific layer
function findLegendColorIndicator(layerId) {
    // For layers with simple checkbox structure (growth-zones, housing)
    const checkbox = document.getElementById(layerId);
    if (checkbox) {
        const parent = checkbox.parentElement;
        const colorDiv = parent.querySelector('div[style*="background-color"], div[style*="border"]');
        return colorDiv;
    }
    
    // For grouped layers like PTAL, look for the main layer control
    const camelCaseId = toCamelCase(layerId);
    const groupCheckbox = document.getElementById(camelCaseId);
    if (groupCheckbox) {
        const parent = groupCheckbox.parentElement;
        const colorDiv = parent.querySelector('div[style*="background-color"], div[style*="border"]');
        return colorDiv;
    }
    
    return null;
}

// Update the legend color indicator based on the style configuration
function updateLegendColorIndicator(colorDiv, styleConfig, geometryType) {
    if (!colorDiv) return;
    
    let fillColor = '#3388ff'; // default
    let fillOpacity = 0.7;
    let borderColor = '#000';
    let borderOpacity = 1;
    let borderWidth = '1px';
    
    // Get the primary color and opacity from the style config
    if (geometryType === 'polygon') {
        if (styleConfig.fill && styleConfig.fill.color) {
            fillColor = getStyleValue(styleConfig.fill.color);
        }
        if (styleConfig.fill && styleConfig.fill.opacity) {
            fillOpacity = getStyleValue(styleConfig.fill.opacity);
        }
        if (styleConfig.outline && styleConfig.outline.color) {
            borderColor = getStyleValue(styleConfig.outline.color);
        }
        if (styleConfig.outline && styleConfig.outline.opacity) {
            borderOpacity = getStyleValue(styleConfig.outline.opacity);
        }
        if (styleConfig.outline && styleConfig.outline.weight) {
            borderWidth = getStyleValue(styleConfig.outline.weight) + 'px';
        }
    } else {
        // For points and lines, use general styling
        if (styleConfig.general && styleConfig.general.color) {
            fillColor = getStyleValue(styleConfig.general.color);
            borderColor = fillColor; // Use same color for border
        }
        if (styleConfig.general && styleConfig.general.opacity) {
            fillOpacity = getStyleValue(styleConfig.general.opacity);
            borderOpacity = fillOpacity;
        }
        if (styleConfig.general && styleConfig.general.size) {
            borderWidth = Math.max(1, getStyleValue(styleConfig.general.size)) + 'px';
        }
    }
    
    // Update the color div styling
    if (geometryType === 'polygon') {
        // Handle transparent fills
        if (fillColor === 'transparent') {
            colorDiv.style.backgroundColor = 'transparent';
        } else {
            colorDiv.style.backgroundColor = fillColor;
        }
        
        // Apply separate opacities using RGBA if needed
        if (fillColor !== 'transparent' && fillOpacity < 1) {
            const rgb = hexToRgb(fillColor);
            if (rgb) {
                colorDiv.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})`;
            }
        }
        
        // Set border with its own opacity
        const borderRgb = hexToRgb(borderColor);
        if (borderRgb && borderOpacity < 1) {
            colorDiv.style.border = `${borderWidth} solid rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${borderOpacity})`;
        } else {
            colorDiv.style.border = `${borderWidth} solid ${borderColor}`;
        }
        
    } else if (geometryType === 'point') {
        // For points, show as filled circle
        if (fillOpacity < 1) {
            const rgb = hexToRgb(fillColor);
            if (rgb) {
                colorDiv.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})`;
            }
        } else {
            colorDiv.style.backgroundColor = fillColor;
        }
        
        const borderRgb = hexToRgb(borderColor);
        if (borderRgb && borderOpacity < 1) {
            colorDiv.style.border = `${borderWidth} solid rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${borderOpacity})`;
        } else {
            colorDiv.style.border = `${borderWidth} solid ${borderColor}`;
        }
        colorDiv.style.borderRadius = '50%';
        
    } else if (geometryType === 'line') {
        // For lines, show as line (using border)
        colorDiv.style.backgroundColor = 'transparent';
        colorDiv.style.border = 'none';
        
        const rgb = hexToRgb(fillColor);
        if (rgb && fillOpacity < 1) {
            colorDiv.style.borderTop = `${borderWidth} solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fillOpacity})`;
        } else {
            colorDiv.style.borderTop = `${borderWidth} solid ${fillColor}`;
        }
    }
}

// Get a simple style value from a style configuration (handles simple method primarily)
function getStyleValue(styleConfig) {
    if (styleConfig.method === 'simple') {
        return styleConfig.value;
    } else if (styleConfig.method === 'categorized') {
        // For categorized, return the first category's color or a default
        if (styleConfig.categories && styleConfig.categories.length > 0) {
            return styleConfig.categories[0].style;
        }
        return styleConfig.defaultValue || '#3388ff';
    } else if (styleConfig.method === 'graduated') {
        // For graduated, return the start color or middle color
        if (styleConfig.startColor) {
            return styleConfig.startColor;
        }
        return styleConfig.min || styleConfig.defaultValue || '#3388ff';
    }
    
    return styleConfig.value || styleConfig.defaultValue || '#3388ff';
}

// Create a legend summary for complex styling (categorized/graduated)
function createLegendSummary(styleConfig, geometryType) {
    const layerId = styleConfig.layerId;
    
    // Find or create a legend summary container
    let summaryContainer = document.getElementById(`${layerId}-legend-summary`);
    if (!summaryContainer) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = `${layerId}-legend-summary`;
        summaryContainer.className = 'legend-summary';
        summaryContainer.style.cssText = 'margin-top: 5px; font-size: 0.8em; padding: 2px;';
        
        // Insert after the main layer control
        const layerControl = findLayerControlElement(layerId);
        if (layerControl && layerControl.parentElement) {
            layerControl.parentElement.insertBefore(summaryContainer, layerControl.nextSibling);
        }
    }
    
    // Clear existing content
    summaryContainer.innerHTML = '';
    
    // Create summary based on styling method
    if (styleConfig.fill && styleConfig.fill.color.method === 'categorized') {
        summaryContainer.innerHTML = '<div style="font-style: italic;">Categorized by ' + styleConfig.fill.color.attribute + '</div>';
    } else if (styleConfig.fill && styleConfig.fill.color.method === 'graduated') {
        summaryContainer.innerHTML = '<div style="font-style: italic;">Graduated by ' + styleConfig.fill.color.attribute + '</div>';
    } else if (styleConfig.general && styleConfig.general.color.method === 'categorized') {
        summaryContainer.innerHTML = '<div style="font-style: italic;">Categorized by ' + styleConfig.general.color.attribute + '</div>';
    } else if (styleConfig.general && styleConfig.general.color.method === 'graduated') {
        summaryContainer.innerHTML = '<div style="font-style: italic;">Graduated by ' + styleConfig.general.color.attribute + '</div>';
    }
}

// Find the main layer control element for a layer
function findLayerControlElement(layerId) {
    const checkbox = document.getElementById(layerId);
    if (checkbox) {
        return checkbox.parentElement.parentElement; // Get the full control row
    }
    
    const camelCaseId = toCamelCase(layerId);
    const groupCheckbox = document.getElementById(camelCaseId);
    if (groupCheckbox) {
        return groupCheckbox.parentElement.parentElement;
    }
    
    return null;
}
