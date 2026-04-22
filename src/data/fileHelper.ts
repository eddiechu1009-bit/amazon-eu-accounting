import * as XLSX from 'xlsx';

/** 讀取檔案（支援 CSV/TSV/TXT 和 Excel .xlsx/.xls），返回 CSV 文字 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (isExcel) {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          resolve(XLSX.utils.sheet_to_csv(sheet));
        } else {
          resolve(e.target?.result as string);
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(reader.error);

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}
