import * as XLSX from 'xlsx';

export interface QuestionRow {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctAnswer: number;
  points: number;
}

export const generateExcelTemplate = () => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Template data with headers and example rows
  const data = [
    ['Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer (1-4)', 'Points'],
    ['What is a variable in programming?', 'A container for storing data', 'A type of loop', 'A function', 'An error', 1, 1],
    ['ما هو الـ Loop في البرمجة؟', 'تكرار كود معين', 'متغير', 'دالة', 'شرط', 1, 1],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 40 }, // Question
    { wch: 25 }, // Option 1
    { wch: 25 }, // Option 2
    { wch: 25 }, // Option 3
    { wch: 25 }, // Option 4
    { wch: 20 }, // Correct Answer
    { wch: 10 }, // Points
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  // Generate and download
  XLSX.writeFile(wb, 'quiz_questions_template.xlsx');
};

export const parseExcelFile = (file: File): Promise<QuestionRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON, skip header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
        
        // Skip header row and map to QuestionRow
        const questions: QuestionRow[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[0]) continue; // Skip empty rows
          
          // Parse correct answer - handle various formats
          let correctAnswerRaw = row[5];
          let correctAnswer = 1; // default
          
          if (correctAnswerRaw !== undefined && correctAnswerRaw !== null && correctAnswerRaw !== '') {
            const parsed = parseInt(String(correctAnswerRaw).trim());
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
              correctAnswer = parsed;
            }
          }
          
          // Parse points
          let pointsRaw = row[6];
          let points = 1; // default
          if (pointsRaw !== undefined && pointsRaw !== null && pointsRaw !== '') {
            const parsed = parseInt(String(pointsRaw).trim());
            if (!isNaN(parsed) && parsed > 0) {
              points = parsed;
            }
          }
          
          const question: QuestionRow = {
            question: String(row[0] || '').trim(),
            option1: String(row[1] || '').trim(),
            option2: String(row[2] || '').trim(),
            option3: String(row[3] || '').trim(),
            option4: String(row[4] || '').trim(),
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
