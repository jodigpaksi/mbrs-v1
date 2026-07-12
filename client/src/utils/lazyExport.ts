// Lazy loaders for the heavy export/report libraries. These are only needed when the user
// actually triggers an export, so they're imported on demand (dynamic import()) instead of
// statically — keeping xlsx / jspdf / exceljs out of the initial page bundle. Vite splits each
// into its own chunk fetched at click time. Shared here so SchedulePage and AdminPage don't each
// re-declare the same loader boilerplate.

export async function loadXlsx() {
  return await import('xlsx')
}

export async function loadPdf() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable }
}

export async function loadExcelJs() {
  return (await import('exceljs')).default
}
