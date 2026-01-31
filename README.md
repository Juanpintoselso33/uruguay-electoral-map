# Uruguay Electoral Map

An interactive Vue.js application visualizing electoral results across all 19 departments of Uruguay. Using official Electoral Court data, it offers detailed analysis of voting patterns with support for multiple elections (2014-2024). Features include color-coded maps, comparison mode, filtering by parties and candidates, and historical trend analysis.

![Uruguay Electoral Map](https://github.com/user-attachments/assets/94d70f90-6332-4b73-b488-043c471b598c)

---

## ✨ Features

### Interactive Visualization
- **19 Departments**: Complete coverage of Uruguay (Montevideo, Canelones, Maldonado, Colonia, and 15 more)
- **Color-Coded Maps**: WebGL-powered maps with gradient visualization
- **Detailed Tooltips**: Vote counts, percentages, and party information
- **Zone-Level Analysis**: Neighborhood/circuit granularity for deep insights

### Multi-Election Support
- **Historical Data**: View elections from 2014 to 2024
- **Election Types**: Internas, Nacionales, Balotaje, Departamentales
- **Quick Switching**: Toggle between elections with one click
- **Data Availability**:
  - ✅ Internas 2024 (all 19 departments)
  - ✅ Nacionales 2019 (all 19 departments)
  - 📦 Ready to add: 2014, 2019 Internas, 2024 Balotaje

### Comparison Mode
- **Side-by-Side Analysis**: Compare two elections simultaneously
- **Vote Changes**: See absolute and percentage differences
- **Party Trends**: Identify winners and losers across elections
- **Visual Indicators**: Arrows (↑↓) and color coding for quick insights

### Advanced Filtering
- **By Party**: Filter results by political party
- **By Candidate**: View results for specific candidates (Internas only)
- **By List**: Select individual electoral lists (hojas)
- **ODN vs ODD**: Toggle between presidential and departmental elections

### Modern UI/UX
- **Dark Mode**: Eye-friendly theme with localStorage persistence
- **Responsive Design**: Mobile-first, works on phone/tablet/desktop
- **Search Bar**: Quick department search with Cmd+K shortcut
- **Statistics Panel**: Charts, top lists, and export to CSV
- **Timeline Selector**: Visual election picker with cards/timeline

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or later)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/juanpintoselso33/uruguay-electoral-map.git
cd uruguay-electoral-map

# Install dependencies
npm install

# Run development server
npm run dev

# Open browser at http://localhost:5173
```

### Building for Production

```bash
npm run build
# Output: dist/
```

---

## 📖 Usage Guide

### Viewing Election Results

1. **Select Election**: Click on an election card in the sidebar
2. **Choose Department**: Select from the departments dropdown
3. **Filter Results**: Use party/candidate/list filters
4. **View Map**: Color-coded zones show voting distribution
5. **Hover for Details**: Tooltips display vote counts and percentages

### Comparison Mode

1. **Activate**: Click "Comparar" button in header
2. **Select Elections**: Choose two elections from dropdowns
3. **View Changes**: See total votes and party-by-party differences
4. **Exit**: Click X button or "Comparar" again

### Keyboard Shortcuts
- `Cmd+K` / `Ctrl+K`: Open search bar
- `Arrow Up/Down`: Navigate search results
- `Enter`: Select department
- `Esc`: Close search

---

## 🛠 Technologies

### Frontend
- **Vue 3** - Composition API with `<script setup>`
- **TypeScript** - Type safety and better DX
- **Pinia** - State management
- **MapLibre GL JS** - WebGL map rendering (replaces Leaflet)
- **Chart.js** - Data visualizations
- **@vueuse/core** - Composable utilities
- **Lucide Icons** - Modern icon library
- **Tailwind CSS** - Utility-first styling

### Data Pipeline (ETL)
- **Node.js** - ETL automation scripts
- **PapaParse** - CSV parsing
- **Schema Detection** - Automatic format normalization
- **GeoJSON Processing** - Map optimization

### Design System
- **Typography**: DM Serif Display + Plus Jakarta Sans
- **Color Palette**: Professional editorial theme
- **CSS Variables**: Dynamic theming
- **Responsive Grid**: Mobile-first layouts

---

## 📂 Project Structure

```
uruguay-electoral-map/
├── public/
│   ├── data/
│   │   ├── electoral/
│   │   │   ├── internas-2024/      # Election data by year
│   │   │   │   ├── montevideo/
│   │   │   │   │   ├── odn.json    # Presidential votes
│   │   │   │   │   ├── odd.json    # Departmental votes
│   │   │   │   │   └── metadata.json
│   │   │   │   └── ...             # All 19 departments
│   │   │   └── nacionales-2019/
│   │   │       └── ...
│   │   ├── geographic/
│   │   │   └── *.json              # Department maps
│   │   └── elections-meta.json     # Available elections
│   ├── regions.json                # Department configuration
│   └── elections-catalog.json      # Full elections catalog
├── src/
│   ├── components/
│   │   ├── elections/
│   │   │   └── ElectionSelector.vue
│   │   ├── comparison/
│   │   │   └── ComparisonView.vue
│   │   ├── map/
│   │   │   └── MapLibreView.vue
│   │   ├── charts/
│   │   │   └── StatsPanel.vue
│   │   ├── layout/
│   │   │   └── AppLayout.vue
│   │   └── ...
│   ├── stores/
│   │   └── electoral.ts            # Pinia store
│   ├── AppModern.vue               # Main app
│   └── main.ts
├── etl/
│   ├── config/
│   │   ├── sources.json            # Data source URLs
│   │   └── schemas.json            # CSV format schemas
│   ├── extractors/
│   │   └── index.js                # Download data
│   ├── transformers/
│   │   └── index.js                # Process & normalize
│   └── loaders/
│       └── data-loader.js          # Load to public/
├── scripts/
│   └── *.js                        # Utility scripts
├── HISTORICAL_DATA_GUIDE.md        # Detailed data guide
├── ELECTIONS_STRUCTURE.md          # Electoral system docs
├── FRONTEND_MODERNIZATION.md       # UI/UX documentation
└── README.md
```

---

## 📊 Data Sources

### Electoral Data
- **Corte Electoral Uruguay**: https://catalogodatos.gub.uy/organization/corte-electoral
- **Dataset Format**: CSV (transformed to JSON)
- **Update Frequency**: After each election
- **Coverage**: All 19 departments, all election types

### Geographic Data
- **IDE Uruguay**: Official departmental boundaries
- **Format**: GeoJSON (optimized for web)
- **Size**: <1MB per department (compressed)

---

## 🔧 ETL Pipeline

### Adding a New Election

```bash
# Download data from Electoral Court
node etl/index.js extract --election nacionales-2014

# Process and split by department
node etl/index.js transform --election nacionales-2014

# Load to public directory
node etl/index.js load --election nacionales-2014

# Or run all steps at once
node etl/index.js run --election nacionales-2014
```

### Available Elections

See `elections-catalog.json` for complete list. To add a new election:

1. Add entry to `etl/config/sources.json`
2. Run ETL pipeline (above)
3. Election appears automatically in frontend

### Data Schema

The ETL automatically detects and normalizes different CSV formats:

- **Internas**: `PARTIDO, DEPTO, HOJA, CNT_VOTOS, ZONA, PRECANDIDATO`
- **Nacionales**: `TipoRegistro, Departamento, Lema, Descripcion1, CantidadVotos`

Output format (unified):

```json
{
  "metadata": {
    "type": "odd",
    "schemaType": "nacionales",
    "department": "montevideo",
    "election": "nacionales-2019",
    "stats": { "totalVotes": 893359, ... }
  },
  "data": {
    "votosPorListas": { "90": { "1": 150 } },
    "partiesByList": { "90": "Frente Amplio" },
    "zoneList": ["1", "2"],
    "partyList": ["Frente Amplio"]
  }
}
```

---

## 📚 Documentation

- **[Historical Data Guide](HISTORICAL_DATA_GUIDE.md)**: Complete guide to multi-election features
- **[Elections Structure](ELECTIONS_STRUCTURE.md)**: Uruguay's electoral calendar and CSV formats
- **[Frontend Modernization](FRONTEND_MODERNIZATION.md)**: UI/UX design documentation

---

## 🎨 Design Philosophy

**"Diario Electoral Interactivo"** - Editorial meets Data Visualization

- **Typography**: Serif headlines (DM Serif Display) + modern body (Plus Jakarta Sans)
- **Color System**: Professional news-inspired palette with CSS variables
- **Layout**: Asymmetric grids, generous whitespace, editorial hierarchy
- **Interactions**: Smooth transitions, micro-animations, contextual feedback
- **Accessibility**: WCAG 2.1 AA compliant, keyboard navigation, screen reader friendly

---

## 🤝 Contributing

Contributions are welcome! Areas for contribution:

- **New Elections**: Add historical data (2014, Balotaje 2024, etc.)
- **Features**: Time-series charts, map comparison mode, data export
- **Performance**: Optimize bundle size, lazy loading, caching
- **UI/UX**: Mobile improvements, animations, accessibility
- **Documentation**: Tutorials, examples, translations

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📈 Performance

- **Bundle Size**: ~400KB (gzipped)
- **Initial Load**: <2s on 3G
- **Map Rendering**: WebGL-accelerated (60fps)
- **Data Loading**: Lazy-loaded by department
- **Caching**: Browser cache with versioning

---

## 🐛 Troubleshooting

### Common Issues

**Election not loading**
- Check `public/data/electoral/{election}/{dept}/` exists
- Verify `regions.json` includes election in `availableElections`
- Run ETL if data missing

**Map not displaying**
- Check browser console for WebGL errors
- Verify GeoJSON file exists and is valid
- Try different browser (Chrome/Firefox recommended)

**Comparison shows no data**
- Ensure both elections have data for selected department
- Check that different elections are selected (not same twice)

See [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md#troubleshooting) for detailed troubleshooting.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- **Corte Electoral Uruguay**: Electoral data
- **IDE Uruguay**: Geographic boundaries
- **OpenStreetMap**: Base map tiles
- **Vue.js Community**: Framework and ecosystem
- **MapLibre GL JS**: Map rendering engine

---

## 📞 Contact

- **Issues**: https://github.com/juanpintoselso33/uruguay-electoral-map/issues
- **Discussions**: https://github.com/juanpintoselso33/uruguay-electoral-map/discussions

---

**Made with ❤️ for democracy and transparency in Uruguay**

*Last Updated: January 2026 | Version 2.0.0*
