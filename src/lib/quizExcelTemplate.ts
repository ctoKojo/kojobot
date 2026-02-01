import ExcelJS from 'exceljs';

export interface QuestionRow {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctAnswer: number;
  points: number;
}

export const generateExcelTemplate = async () => {
  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Questions');

  // Set columns with headers
  worksheet.columns = [
    { header: 'Question', key: 'question', width: 40 },
    { header: 'Option 1', key: 'option1', width: 25 },
    { header: 'Option 2', key: 'option2', width: 25 },
    { header: 'Option 3', key: 'option3', width: 25 },
    { header: 'Option 4', key: 'option4', width: 25 },
    { header: 'Correct Answer (1-4)', key: 'correctAnswer', width: 20 },
    { header: 'Points', key: 'points', width: 10 },
  ];

  // Add example rows
  worksheet.addRow({
    question: 'What is a variable in programming?',
    option1: 'A container for storing data',
    option2: 'A type of loop',
    option3: 'A function',
    option4: 'An error',
    correctAnswer: 1,
    points: 1,
  });

  worksheet.addRow({
    question: 'ما هو الـ Loop في البرمجة؟',
    option1: 'تكرار كود معين',
    option2: 'متغير',
    option3: 'دالة',
    option4: 'شرط',
    correctAnswer: 1,
    points: 1,
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quiz_questions_template.xlsx';
  link.click();
  window.URL.revokeObjectURL(url);
};

export const parseExcelFile = (file: File): Promise<QuestionRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          reject(new Error('No worksheet found'));
          return;
        }
        
        const questions: QuestionRow[] = [];
        
        // Iterate rows, skip header (row 1)
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          
          const values = row.values as (string | number | null)[];
          // ExcelJS row.values is 1-indexed, so values[0] is undefined
          const questionText = values[1];
          if (!questionText) return; // Skip empty rows
          
          // Parse correct answer - handle various formats
          let correctAnswerRaw = values[6];
          let correctAnswer = 1; // default
          
          if (correctAnswerRaw !== undefined && correctAnswerRaw !== null && correctAnswerRaw !== '') {
            const parsed = parseInt(String(correctAnswerRaw).trim());
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
              correctAnswer = parsed;
            }
          }
          
          // Parse points
          let pointsRaw = values[7];
          let points = 1; // default
          if (pointsRaw !== undefined && pointsRaw !== null && pointsRaw !== '') {
            const parsed = parseInt(String(pointsRaw).trim());
            if (!isNaN(parsed) && parsed > 0) {
              points = parsed;
            }
          }
          
          const question: QuestionRow = {
            question: String(values[1] || '').trim(),
            option1: String(values[2] || '').trim(),
            option2: String(values[3] || '').trim(),
            option3: String(values[4] || '').trim(),
            option4: String(values[5] || '').trim(),
            correctAnswer,
            points,
          };
          
          questions.push(question);
        });
        
        resolve(questions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const parseCSVFile = (file: File): Promise<QuestionRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        const questions: QuestionRow[] = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          
          if (!values[0]) continue;
          
          // Parse correct answer - handle various formats
          let correctAnswer = 1; // default
          if (values[5] !== undefined && values[5] !== '') {
            const parsed = parseInt(values[5].trim());
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
              correctAnswer = parsed;
            }
          }
          
          // Parse points
          let points = 1; // default
          if (values[6] !== undefined && values[6] !== '') {
            const parsed = parseInt(values[6].trim());
            if (!isNaN(parsed) && parsed > 0) {
              points = parsed;
            }
          }
          
          const question: QuestionRow = {
            question: values[0] || '',
            option1: values[1] || '',
            option2: values[2] || '',
            option3: values[3] || '',
            option4: values[4] || '',
            correctAnswer,
            points,
          };
          
          questions.push(question);
        }
        
        resolve(questions);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};
