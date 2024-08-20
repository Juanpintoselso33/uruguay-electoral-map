import Papa from "papaparse";

export const processCSV = (csvText: string) => {
  console.log("Processing CSV data...");
  const result = Papa.parse(csvText, { header: true });
  const data = result.data as Array<{
    ZONA: string;
    CNT_VOTOS: string;
    HOJA: string;
    PARTIDO: string;
    PRECANDIDATO: string;
  }>;

  const votosPorListas: Record<string, Record<string, number>> = {};
  const maxVotosPorListas: Record<string, number> = {};
  const partiesByList: Record<string, string> = {};
  const precandidatosByList: Record<string, string> = {};
  const lists: string[] = [];

  data.forEach((row) => {
    if (!votosPorListas[row.HOJA]) {
      votosPorListas[row.HOJA] = {};
      lists.push(row.HOJA);
      maxVotosPorListas[row.HOJA] = 0;
      partiesByList[row.HOJA] = row.PARTIDO;
      precandidatosByList[row.HOJA] = row.PRECANDIDATO;
    }
    votosPorListas[row.HOJA][row.ZONA] =
      (votosPorListas[row.HOJA][row.ZONA] || 0) + parseInt(row.CNT_VOTOS, 10);
    maxVotosPorListas[row.HOJA] = Math.max(
      maxVotosPorListas[row.HOJA],
      votosPorListas[row.HOJA][row.ZONA]
    );
  });

  return {
    votosPorListas,
    maxVotosPorListas,
    lists,
    partiesByList,
    precandidatosByList,
  };
};
