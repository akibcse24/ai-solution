
export interface AnswerPart {
  type: 'text' | 'math' | 'diagram' | 'code';
  content: string;
  imageUrl?: string;
}

export interface RefinedQuestion {
  label: string;
  text: string;
  marks: number;
  refinedAnswer: string; // Original raw text with tags
  parts: AnswerPart[];
  isJustified?: boolean;
}

export interface GeneratedPage {
  pageNumber: number;
  questions: RefinedQuestion[];
}

export interface ExamQuestion {
  id: string;
  label: string;
  text: string;
  marks: number;
  suggestedAnswer: string;
  diagramRequired: boolean;
  diagramDescription?: string;
  enabled: boolean;
  isJustified?: boolean;
}

export interface ExamAnalysis {
  examTitle: string;
  totalMarks: number;
  questions: ExamQuestion[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  data: ExamAnalysis;
  refinedQuestions?: RefinedQuestion[];
  tags?: string[];
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  REVIEWING = 'REVIEWING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ANALYZING_GENERAL = 'ANALYZING_GENERAL'
}
