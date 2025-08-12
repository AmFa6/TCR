# TCR Interactive Map - GitHub Pages

An interactive web map displaying transport and housing analysis for the West of England Combined Authority area, including Growth Zones, Public Transport Infrastructure, PTAL (Public Transport Accessibility Level), Housing data, and CRSTS2 scheme information.

## 🗺️ Features

### Map Layers
- **Growth Zones**: Development areas with planning status and housing targets
- **Public Transport Infrastructure** (grouped):
  - Bus Lines (Metrobus and regular bus routes)
  - Bus Stops with accessibility information
  - Rail Stops and stations
- **PTAL Layer**: Public Transport Accessibility Level visualization
- **Housing Layer**: Existing and planned housing developments
- **CRSTS2 Schemes** (grouped):
  - Point features (specific improvements)
  - Line features (route enhancements)
  - Polygon features (area developments)

### Interactive Features
- Toggle layers on/off using the control panel
- Switch between different base maps (OpenStreetMap, Satellite, Terrain)
- Click on features to view detailed information
- Responsive design works on desktop and mobile devices
- Color-coded legend for easy interpretation

## 🚀 Quick Start

### Option 1: GitHub Pages Deployment
1. Fork or clone this repository
2. Go to your repository settings
3. Navigate to "Pages" section
4. Set source to "Deploy from a branch"
5. Select "main" branch and "/ (root)" folder
6. Your map will be available at: `https://[username].github.io/[repository-name]`

### Option 2: Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tcr-interactive-map.git
   cd tcr-interactive-map
   ```

2. Serve the files using a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have live-server installed)
   npx live-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to `http://localhost:8000`

## 📁 Project Structure

```
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── map.js             # JavaScript map functionality
├── data/              # Sample GeoJSON data files
│   ├── growth-zones.geojson
│   ├── bus-lines.geojson
│   └── bus-stops.geojson
└── README.md          # This file
```

## 🔧 Customization

### Adding Your Own Data

1. **Replace Sample Data**: The current implementation uses sample data for demonstration. To use your actual data:
   - Replace the sample GeoJSON files in the `/data` folder
   - Update the `loadSampleData()` function in `map.js` to load your actual data files

2. **Loading External GeoJSON Files**:
   ```javascript
   // Example of loading external GeoJSON
   fetch('data/your-data.geojson')
     .then(response => response.json())
     .then(data => {
       L.geoJSON(data, {
         style: yourStyleFunction,
         onEachFeature: yourPopupFunction
       }).addTo(layerGroups.yourLayer);
     });
   ```

3. **Customize Styling**: Edit the styling functions in `map.js` and CSS classes in `styles.css`

### Map Configuration

- **Default View**: Change the initial map center and zoom level in the `initializeMap()` function
- **Base Maps**: Add or modify base map options in the `baseMaps` object
- **Colors and Symbols**: Update the color scheme in both CSS and JavaScript files

### Layer Management

Add new layers by:
1. Creating a new layer group in `initializeMap()`
2. Adding the corresponding checkbox in `index.html`
3. Implementing the data loading function
4. Adding event handlers in `setupLayerControls()`

## 🎨 Styling Guide

### Color Scheme
- **Growth Zones**: `#ff6b6b` (Red)
- **Housing**: `#4ecdc4` (Teal)
- **PTAL**: Gradient from `#8B0000` (Level 1) to `#00FF00` (Level 6)
- **Bus Infrastructure**: `#96ceb4` (Green), `#feca57` (Yellow)
- **Rail**: `#ff9ff3` (Pink)
- **CRSTS2**: `#54a0ff` (Blue)

### Responsive Breakpoints
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px

## 📊 Data Format

The application expects GeoJSON format for all spatial data. Each feature should include:

### Required Properties
- `name`: Display name for the feature
- Additional properties as needed for popup content

### Example GeoJSON Structure
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Feature Name",
        "description": "Feature description",
        "custom_field": "Custom value"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-2.5879, 51.4584]
      }
    }
  ]
}
```

## 🔧 Technical Details

### Dependencies
- **Leaflet.js v1.9.4**: Core mapping library
- **OpenStreetMap**: Default base map tiles
- **Esri World Imagery**: Satellite base map
- **OpenTopoMap**: Terrain base map

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Performance Considerations
- Large datasets should be loaded dynamically
- Consider clustering for point data with many features
- Use vector tiles for better performance with large datasets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Contact: [Your contact information]

## 📍 Area Coverage

The map focuses on the West of England Combined Authority area, including:
- Bristol
- Bath and North East Somerset
- South Gloucestershire
- North Somerset (including Weston-super-Mare)

Initial map view is centered on Bristol (51.4545°N, 2.5879°W) with zoom level 11.

---

**Note**: This map contains sample data for demonstration purposes. Replace with your actual data sources before production use.
