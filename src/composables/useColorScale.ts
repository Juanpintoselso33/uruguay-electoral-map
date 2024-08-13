import chroma from "chroma-js";

export function useColorScale() {
  const getColor = (votes: number, maxVotes: number): string => {
    if (votes === 0 || maxVotes === 0) {
      return "#FFFFFF";
    }
    const ratio = votes / maxVotes;
    const colorScale = chroma
      .scale(["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"])
      .mode("lab")
      .domain([0, 1]);
    return colorScale(ratio).hex();
  };

  return {
    getColor,
  };
}
