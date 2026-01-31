import { ref, computed } from 'vue'
import chroma from 'chroma-js'

/**
 * ColorBrewer Sequential Palette (Blue)
 * Colorblind-safe, scientifically proven for choropleth maps
 * Source: https://colorbrewer2.org/#type=sequential&scheme=Blues&n=6
 */
export const COLORBREWER_BLUES = [
  '#f7f7f7', // Very light (no data / very low)
  '#d1e5f0', // Light blue
  '#92c5de', // Medium-light blue
  '#4393c3', // Medium blue
  '#2166ac', // Medium-dark blue
  '#053061'  // Dark blue (high values)
]

/**
 * Alternative ColorBrewer palettes
 */
export const COLOR_PALETTES = {
  blues: COLORBREWER_BLUES,
  oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#e6550d'],
  reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#31a354'],
  purples: ['#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7', '#df65b0', '#dd1c77']
}

/**
 * Jenks Natural Breaks (Fisher-Jenks algorithm)
 * Classifies data into n classes that minimize within-class variance
 * and maximize between-class variance
 */
export function jenksBreaks(values: number[], numClasses: number): number[] {
  if (values.length === 0) return []
  if (numClasses >= values.length) return [...values].sort((a, b) => a - b)

  // Sort values
  const sortedValues = [...values].sort((a, b) => a - b)
  const n = sortedValues.length

  // Initialize matrices
  const lowerClassLimits: number[][] = []
  const varianceCombinations: number[][] = []

  for (let i = 0; i < n; i++) {
    lowerClassLimits[i] = []
    varianceCombinations[i] = []
    for (let j = 0; j < numClasses; j++) {
      lowerClassLimits[i][j] = 0
      varianceCombinations[i][j] = 0
    }
  }

  // Compute variance for each possible combination
  for (let i = 1; i < n; i++) {
    let sum = 0
    let sumSquares = 0
    let w = 0

    for (let j = 0; j < i; j++) {
      const val = sortedValues[j]
      w++
      sum += val
      sumSquares += val * val

      const variance = sumSquares - (sum * sum) / w
      varianceCombinations[i][0] = variance
      lowerClassLimits[i][0] = 0
    }
  }

  // Fill matrices
  for (let k = 1; k < numClasses; k++) {
    for (let i = k; i < n; i++) {
      let minVariance = Infinity

      for (let j = k - 1; j < i; j++) {
        let sum = 0
        let sumSquares = 0
        let w = 0

        for (let m = j + 1; m <= i; m++) {
          const val = sortedValues[m]
          w++
          sum += val
          sumSquares += val * val
        }

        const variance = sumSquares - (sum * sum) / w
        const totalVariance = varianceCombinations[j][k - 1] + variance

        if (totalVariance < minVariance) {
          minVariance = totalVariance
          lowerClassLimits[i][k] = j + 1
        }
      }

      varianceCombinations[i][k] = minVariance
    }
  }

  // Extract break points
  const breaks: number[] = []
  let k = numClasses - 1
  let i = n - 1

  breaks.push(sortedValues[i])
  while (k > 0) {
    const idx = lowerClassLimits[i][k]
    breaks.push(sortedValues[idx - 1])
    i = idx - 1
    k--
  }
  breaks.push(sortedValues[0])

  return breaks.reverse()
}

/**
 * Quantile breaks - simple alternative to Jenks
 * Divides data into equal-count classes
 */
export function quantileBreaks(values: number[], numClasses: number): number[] {
  if (values.length === 0) return []

  const sorted = [...values].sort((a, b) => a - b)
  const breaks: number[] = [sorted[0]]

  for (let i = 1; i < numClasses; i++) {
    const index = Math.floor((i / numClasses) * sorted.length)
    breaks.push(sorted[index])
  }

  breaks.push(sorted[sorted.length - 1])
  return breaks
}

/**
 * Composable for managing map colors with ColorBrewer palettes
 */
export function useMapColors(
  palette: keyof typeof COLOR_PALETTES = 'blues',
  numClasses: number = 6,
  classificationMethod: 'jenks' | 'quantile' | 'equal' = 'jenks'
) {
  const colors = computed(() => COLOR_PALETTES[palette])
  const breaks = ref<number[]>([])

  /**
   * Calculate breaks from data values
   */
  const calculateBreaks = (values: number[]) => {
    const nonZeroValues = values.filter(v => v > 0)

    if (nonZeroValues.length === 0) {
      breaks.value = []
      return
    }

    switch (classificationMethod) {
      case 'jenks':
        breaks.value = jenksBreaks(nonZeroValues, numClasses)
        break
      case 'quantile':
        breaks.value = quantileBreaks(nonZeroValues, numClasses)
        break
      case 'equal': {
        const min = Math.min(...nonZeroValues)
        const max = Math.max(...nonZeroValues)
        const step = (max - min) / numClasses
        breaks.value = Array.from({ length: numClasses + 1 }, (_, i) => min + i * step)
        break
      }
    }
  }

  /**
   * Get color for a specific value
   */
  const getColorForValue = (value: number): string => {
    // No data or zero
    if (value === 0 || breaks.value.length === 0) {
      return colors.value[0] // Lightest color
    }

    // Find the class index
    let classIndex = 0
    for (let i = 0; i < breaks.value.length - 1; i++) {
      if (value >= breaks.value[i] && value <= breaks.value[i + 1]) {
        classIndex = i
        break
      }
    }

    // Map class index to color (ensure we don't exceed color array bounds)
    const colorIndex = Math.min(classIndex, colors.value.length - 1)
    return colors.value[colorIndex]
  }

  /**
   * Get color scale for legend
   */
  const getColorScale = () => {
    return colors.value.map((color, index) => {
      const breakIndex = Math.min(index, breaks.value.length - 1)
      return {
        color,
        value: breaks.value[breakIndex] || 0,
        label: breaks.value[breakIndex]?.toLocaleString() || '0'
      }
    })
  }

  /**
   * Create chroma scale for gradients (legacy support)
   */
  const createChromaScale = () => {
    return chroma.scale(colors.value).mode('lab').domain([0, 1])
  }

  return {
    colors,
    breaks,
    calculateBreaks,
    getColorForValue,
    getColorScale,
    createChromaScale
  }
}
