# Montevideo Election Map

An interactive Vue.js application visualizing the 2024 internal election results across Montevideo, Uruguay. Using official Electoral Court data, it offers a neighborhood-level map of voting patterns. Features include color-coded districts, filtering by political lists, and interactive elements for analyzing local political trends in Uruguay's capital city.

## Features

- Interactive map of Montevideo neighborhoods
- Color-coded visualization of voting patterns
- Ability to filter results by political lists and parties
- Detailed tooltips showing vote counts per list and total votes
- Responsive design for various screen sizes
- Option to view results as absolute votes or percentages

## Technologies Used

- Vue.js 3
- Vite
- Leaflet.js for map rendering
- Papa Parse for CSV parsing
- TypeScript for type safety
- Pandas for data cleaning and preparation
  - The data was cleaned and prepared in the following repository: https://github.com/juanpintoselso33/ds-montevideo-internas

## Getting Started

### Prerequisites

- Node.js (version 14 or later recommended)
- npm or yarn

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/juanpintoselso33/montevideo-map.git
   cd montevideo-map
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
│   ├── montevideo_map.json
│   ├── v_sig_barrios.json
│   ├── montevideo_odd_dataset_con_zona.csv
│   ├── montevideo_odn_dataset_sin_zona.csv
│   └── partidos_abrev.json
├── src/
│   ├── components/
│   │   ├── ListSelector.vue
│   │   └── MontevideoMap.vue
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── index.html
├── package.json
├── vite.config.js
├── tsconfig.json
└── README.md
```

## Usage

1. Upon opening the application, you'll see a map of Montevideo divided into neighborhoods.
2. Use the list selector on the left to choose specific political lists or parties.
3. The map will update to show the voting results for your selection.
4. Click on a neighborhood to see detailed voting information in the tooltip.
5. On mobile devices, use the bottom drawer to access the list selector and detailed information.

## Performance Considerations

The application is optimized for performance, but loading times may vary depending on the user's internet connection and device capabilities. The map data is loaded asynchronously to improve initial load times.

## Feedback and Issues

If you encounter any bugs or have suggestions for improvements, please open an issue on the GitHub repository.

## Acknowledgements

Special thanks to the Electoral Court of Uruguay and the Intendancy of Montevideo for providing the data used in this project.
