import ExcelJS from 'exceljs';

export interface WeeklySummary {
  totalUnits: number;
  byBloodGroup: Record<string, number>;
  byHospital: Record<string, number>;
  byDate: Record<string, number>;
}

export class WeeklySummaryService {
  static async buildWorkbook(
    summary: WeeklySummary,
    weekStart: string,
    weekEnd: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const totals = workbook.addWorksheet('Totals');
    totals.addRow(['Week Start', weekStart]);
    totals.addRow(['Week End', weekEnd]);
    totals.addRow(['Total Units', summary.totalUnits]);

    const bloodGroupSheet = workbook.addWorksheet('By Blood Group');
    bloodGroupSheet.addRow(['Blood Group', 'Units']);
    Object.entries(summary.byBloodGroup).forEach(([group, units]) => {
      bloodGroupSheet.addRow([group, units]);
    });

    const hospitalSheet = workbook.addWorksheet('By Hospital');
    hospitalSheet.addRow(['Hospital', 'Units']);
    Object.entries(summary.byHospital).forEach(([hospital, units]) => {
      hospitalSheet.addRow([hospital, units]);
    });

    const dateSheet = workbook.addWorksheet('By Date');
    dateSheet.addRow(['Date', 'Units']);
    Object.entries(summary.byDate).forEach(([date, units]) => {
      dateSheet.addRow([date, units]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
