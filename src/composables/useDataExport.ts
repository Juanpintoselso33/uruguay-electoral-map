import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type ExportFormat = 'csv' | 'geojson' | 'png' | 'pdf'

interface ExportOptions {
  departmentName: string
  departmentSlug: string
  votosPorListas: Record<string, Record<string, number>>
  partiesByList: Record<string, string>
  geojsonData?: any
  mapElement?: HTMLElement
}

/**
 * Composable for exporting electoral data in multiple formats
 */
export function useDataExport() {
  /**
   * Export complete CSV with all votes and lists by zone
   */
  const exportCSV = (options: ExportOptions): void => {
    const { departmentName, departmentSlug, votosPorListas, partiesByList } = options

    // Header
    const headers = ['Zona', 'Lista', 'Partido', 'Votos']

    // Data rows
    const rows: string[][] = []

    Object.entries(votosPorListas).forEach(([list, zones]) => {
      const party = partiesByList[list] || 'Desconocido'

      Object.entries(zones).forEach(([zone, votes]) => {
        rows.push([zone, list, party, votes.toString()])
      })
    })

    // Sort by zone, then by votes descending
    rows.sort((a, b) => {
      if (a[0] !== b[0]) return a[0].localeCompare(b[0])
      return parseInt(b[3]) - parseInt(a[3])
    })

    // Generate CSV content
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape cells with commas or quotes
        if (cell.includes(',') || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(','))
    ].join('\n')

    // Add BOM for UTF-8 encoding (helps Excel recognize UTF-8)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadFile(blob, `${departmentSlug}-completo.csv`)
  }

  /**
   * Export GeoJSON with electoral data
   */
  const exportGeoJSON = (options: ExportOptions): void => {
    const { departmentSlug, votosPorListas, partiesByList, geojsonData } = options

    if (!geojsonData) {
      console.error('No GeoJSON data available for export')
      return
    }

    // Enrich GeoJSON features with electoral data
    const enrichedGeoJSON = {
      ...geojsonData,
      features: geojsonData.features.map((feature: any) => {
        const zoneName = feature.properties.BARRIO || feature.properties.zona

        // Calculate votes for this zone
        const zoneData: Record<string, any> = {}
        let totalVotes = 0

        Object.entries(votosPorListas).forEach(([list, zones]) => {
          const votes = zones[zoneName] || 0
          if (votes > 0) {
            zoneData[`lista_${list}`] = votes
            zoneData[`partido_${list}`] = partiesByList[list] || 'Desconocido'
            totalVotes += votes
          }
        })

        return {
          ...feature,
          properties: {
            ...feature.properties,
            ...zoneData,
            total_votes: totalVotes
          }
        }
      })
    }

    const json = JSON.stringify(enrichedGeoJSON, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    downloadFile(blob, `${departmentSlug}-electoral.geojson`)
  }

  /**
   * Export PNG image of the map
   */
  const exportPNG = async (options: ExportOptions): Promise<void> => {
    const { departmentSlug, mapElement } = options

    if (!mapElement) {
      console.error('No map element provided for PNG export')
      return
    }

    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        logging: false,
        scale: 2, // Higher quality
        backgroundColor: '#ffffff'
      })

      canvas.toBlob((blob) => {
        if (blob) {
          downloadFile(blob, `${departmentSlug}-mapa.png`)
        }
      }, 'image/png')
    } catch (error) {
      console.error('Error generating PNG:', error)
    }
  }

  /**
   * Export PDF report with statistics
   */
  const exportPDF = (options: ExportOptions): void => {
    const { departmentName, departmentSlug, votosPorListas, partiesByList } = options

    const doc = new jsPDF()

    // Title
    doc.setFontSize(20)
    doc.text(`Reporte Electoral - ${departmentName}`, 20, 20)

    // Date
    doc.setFontSize(10)
    const date = new Date().toLocaleDateString('es-UY')
    doc.text(`Fecha: ${date}`, 20, 30)

    // Statistics
    doc.setFontSize(14)
    doc.text('Estadísticas Generales', 20, 45)

    doc.setFontSize(10)
    let y = 55

    // Calculate total votes
    let totalVotes = 0
    Object.values(votosPorListas).forEach(zones => {
      Object.values(zones).forEach(votes => {
        totalVotes += votes
      })
    })

    // Calculate unique parties
    const uniqueParties = Array.from(new Set(Object.values(partiesByList)))

    doc.text(`Total de votos: ${totalVotes.toLocaleString()}`, 20, y)
    y += 10
    doc.text(`Total de listas: ${Object.keys(votosPorListas).length}`, 20, y)
    y += 10
    doc.text(`Total de partidos: ${uniqueParties.length}`, 20, y)
    y += 20

    // Top lists
    doc.setFontSize(14)
    doc.text('Listas Más Votadas', 20, y)
    y += 10

    // Calculate top lists
    const topLists = Object.entries(votosPorListas)
      .map(([list, zones]) => ({
        list,
        party: partiesByList[list] || 'Desconocido',
        votes: Object.values(zones).reduce((sum, votes) => sum + votes, 0)
      }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10)

    doc.setFontSize(10)
    topLists.forEach((item, index) => {
      const percentage = ((item.votes / totalVotes) * 100).toFixed(2)
      doc.text(
        `${index + 1}. Lista ${item.list} - ${item.party}: ${item.votes.toLocaleString()} (${percentage}%)`,
        25,
        y
      )
      y += 7

      // Add new page if needed
      if (y > 270) {
        doc.addPage()
        y = 20
      }
    })

    // Footer
    y += 10
    doc.setFontSize(8)
    doc.text('Generado con Mapa Electoral Uruguay', 20, y)

    // Save PDF
    doc.save(`${departmentSlug}-reporte.pdf`)
  }

  /**
   * Helper function to download a file
   */
  const downloadFile = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Main export function with format selector
   */
  const exportData = async (format: ExportFormat, options: ExportOptions): Promise<void> => {
    switch (format) {
      case 'csv':
        exportCSV(options)
        break
      case 'geojson':
        exportGeoJSON(options)
        break
      case 'png':
        await exportPNG(options)
        break
      case 'pdf':
        exportPDF(options)
        break
      default:
        console.error(`Unknown export format: ${format}`)
    }
  }

  return {
    exportData,
    exportCSV,
    exportGeoJSON,
    exportPNG,
    exportPDF
  }
}
