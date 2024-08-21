import chroma from "chroma-js";

export function useColorScale() {
  const colorScale = chroma
    .scale([
      "#ffffcc",
      "#ffeda0",
      "#fed976",
      "#feb24c",
      "#fd8d3c",
      "#fc4e2a",
      "#e31a1c",
      "#b10026",
    ])
    .mode("lab")
    .correctLightness();

  const getColor = (value: number, max: number) => {
    if (value === 0) return "#ffffff"; // Return white for zero votes
    const percentage = max > 0 ? value / max : 0;
    return colorScale(percentage).hex();
  };

  return {
    getColor,
  };
}
