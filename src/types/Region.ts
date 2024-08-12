export interface Region {
  name: string;
  odnCsvPath: string;
  oddCsvPath: string;
  geojsonPath: string;
  mapCenter: [number, number];
  mapZoom: number;
  votosPorListas?: Record<string, Record<string, number>>;
  maxVotosPorListas?: Record<string, number>;
  partiesByList?: Record<string, string>;
  precandidatosByList?: Record<string, string>;
  geojsonData?: any;
}
