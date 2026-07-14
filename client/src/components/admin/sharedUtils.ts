import type { Worksheet as ExcelWorksheet } from 'exceljs'

export type ImportTab = 'excel' | 'csv' | 'sql'

function download(filename: string, content: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = filename
  a.click()
}

function applyDropdown(ws: ExcelWorksheet, col: string, options: string[]) {
  const letter = ws.getColumn(col).letter
  for (let row = 2; row <= 500; row++) {
    ws.getCell(`${letter}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      errorTitle: `Invalid ${col}`,
      error: `${col} must be one of: ${options.join(', ')}`,
    }
  }
}

export { download, applyDropdown }
