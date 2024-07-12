# Montevideo Election Map

An interactive Vue.js application visualizing the 2024 internal election results across Montevideo, Uruguay. Using official Electoral Court data, it offers a neighborhood-level map of voting patterns. Features include color-coded districts, filtering by political lists, and interactive elements for analyzing local political trends in Uruguay's capital city.

## Features

- Interactive map of Montevideo neighborhoods
- Color-coded visualization of voting patterns
- Ability to filter results by political lists
- Detailed tooltips showing vote counts per list and total votes
- Responsive design for various screen sizes

## Technologies Used

- Vue.js 3
- Vite
- Leaflet.js for map rendering
- Papa Parse for CSV parsing
- TypeScript for type safety
- Jupyter notebook for data cleaning which is uploaded in this repo:
   https://github.com/Juanpintoselso33/ds-mvd-internas

## Getting Started

### Prerequisites

- Node.js (version 14 or later recommended)
- npm or yarn

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/montevideo-election-map.git
   cd montevideo-election-map
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Run the development server:

   ```
   npm run dev
   ```

4. Open your browser and visit `http://localhost:5173`

## Building for Production

To create a production build:

```
npm run build
```

The built files will be in the `dist` directory.

## Data Sources

- Electoral data: Provided by the Electoral Court of Uruguay
- Geographical data: Provided by the Intendancy of Montevideo

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).

## Deployment

This project can be deployed to any static site hosting service. Some popular options include:

- GitHub Pages
- Netlify
- Vercel
- AWS S3

Follow the hosting provider's instructions for deploying a Vue.js application built with Vite.

## Project Structure

```
montevideo-election-map/
├── public/
│   * Here goes the data files
├── src/
│   ├── components/
│   │   ├── ListSelector.vue
│   │   └── MontevideoMap.vue
│   ├── App.vue
│   └── main.js
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
