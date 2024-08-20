export interface Region {
  name: string;
  odnCsvPath: string;
  oddCsvPath: string;
  geojsonPath: string;
  votosPorListas?: Record<string, Record<string, number>>;
  maxVotosPorListas?: Record<string, number>;
  partiesByList?: Record<string, string>;
  precandidatosByList?: Record<string, string>;
  precandidatosByParty?: Record<string, string[]>;
  geojsonData?: any;
  partiesAbbrev?: Record<string, string>;
}
