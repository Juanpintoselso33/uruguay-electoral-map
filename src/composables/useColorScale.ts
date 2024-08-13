import chroma from "chroma-js";

export function useColorScale() {
  const getColor = (votes: number, maxVotes: number) => {
    console.log(`getColor called with votes: ${votes}, maxVotes: ${maxVotes}`);
    if (maxVotes === 0) {
      console.log("maxVotes is 0, returning white");
      return "#FFFFFF";
    }
    const ratio = votes / maxVotes;
    console.log(`Calculated ratio: ${ratio}`);
    const scale = chroma
      .scale(["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#b10026"])
      .mode("lab");
    const color = scale(ratio).hex();
    console.log(`Returning color: ${color}`);
    return color;
  };

  return {
    getColor,
  };
}
