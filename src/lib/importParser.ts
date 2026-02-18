/**
 * Config-driven import parser for markdown and JSON formats
 */

import type { ImportConfig } from "./configLoader";
import { generateId } from "./db";

export interface ParsedImportData {
  version: string;
  candidate: {
    id: string;
    displayName: string;
    notes?: string;
    createdAt: string;
  };
  session: {
    name: string;
    date: string;
    interviewers: string[];
    notes?: string;
  };
  questions: Array<{
    order: number;
    note: string;
    questionRating: number | undefined;
    answer: string;
    isPresented?: boolean;
    question: {
      id: string;
      tags: string[];
      questionType: string;
      question: string;
      expectedAnswer: string;
      difficulty: number[];
      hash: string;
      createdAt: string;
      updatedAt: string;
    };
  }>;
}

/**
 * Parse markdown content using config-driven approach
 */
export function parseMarkdownWithConfig(
  content: string,
  formatKey: string,
  config: ImportConfig
): ParsedImportData {
  const mapping = config.importMappings[formatKey];
  if (!mapping) {
    throw new Error(`Unknown format: ${formatKey}`);
  }

  const lines = content.split("\n");
  const data: ParsedImportData = {
    version: "1.0.0",
    candidate: {
      id: generateId(),
      displayName: "Imported Candidate",
      notes: "",
      createdAt: new Date().toISOString(),
    },
    session: {
      name: "Imported Session",
      date: new Date().toISOString(),
      interviewers: [],
      notes: "",
    },
    questions: [],
  };

  let currentQuestion: ParsedImportData["questions"][number] | null = null;
  let currentSubSection = "";
  const structure = mapping.structure;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect sections (skip section headers)
    if (structure.candidateSection && new RegExp(structure.candidateSection).test(line)) {
      continue;
    }
    if (structure.sessionSection && new RegExp(structure.sessionSection).test(line)) {
      continue;
    }
    if (structure.questionsSection && new RegExp(structure.questionsSection).test(line)) {
      continue;
    }

    // Parse candidate fields (work in candidate section OR at document root for flexible parsing)
    if (structure.candidateName) {
      const nameMatch = line.match(new RegExp(structure.candidateName));
      if (nameMatch) {
        data.candidate.displayName = nameMatch[1].trim();
        continue;
      }
    }
    if (structure.candidateId) {
      const idMatch = line.match(new RegExp(structure.candidateId));
      if (idMatch) {
        data.candidate.id = idMatch[1].trim();
        continue;
      }
    }
    if (structure.candidateCreated) {
      const createdMatch = line.match(new RegExp(structure.candidateCreated));
      if (createdMatch) {
        data.candidate.createdAt = createdMatch[1].trim();
        continue;
      }
    }

    // Parse session fields (work in session section OR at document root for flexible parsing)
    if (structure.sessionName) {
      const nameMatch = line.match(new RegExp(structure.sessionName));
      if (nameMatch) {
        data.session.name = nameMatch[1].trim();
        continue;
      }
    }
    if (structure.sessionDate) {
      const dateMatch = line.match(new RegExp(structure.sessionDate));
      if (dateMatch) {
        data.session.date = dateMatch[1].trim();
        continue;
      }
    }
    if (structure.sessionInterviewers) {
      const interviewersMatch = line.match(new RegExp(structure.sessionInterviewers));
      if (interviewersMatch) {
        const interviewers = interviewersMatch[1].trim();
        data.session.interviewers = interviewers ? interviewers.split(", ") : [];
        continue;
      }
    }

    // Parse questions section
    const questionHeaderMatch = line.match(new RegExp(structure.questionHeader));
    if (questionHeaderMatch) {
      if (currentQuestion) {
        data.questions.push(currentQuestion);
      }
      const order = parseInt(questionHeaderMatch[1]) - 1;
      currentQuestion = {
        order: order,
        note: "",
        questionRating: undefined,
        answer: "",
        question: {
          id: generateId(),
          tags: [],
          questionType: "text",
          question: "",
          expectedAnswer: "",
          difficulty: [],
          hash: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      currentSubSection = "";
      continue;
    }

    if (currentQuestion) {
      // Detect subsections
      if (structure.questionText && new RegExp(structure.questionText).test(line)) {
        currentSubSection = "question";
        continue;
      }
      if (structure.expectedAnswer && new RegExp(structure.expectedAnswer).test(line)) {
        currentSubSection = "expectedAnswer";
        continue;
      }
      if (structure.candidateAnswer && new RegExp(structure.candidateAnswer).test(line)) {
        currentSubSection = "candidateAnswer";
        continue;
      }
      if (structure.interviewerNotes && new RegExp(structure.interviewerNotes).test(line)) {
        currentSubSection = "interviewerNotes";
        continue;
      }

      // Parse metadata fields (now at the end of each question)
      if (structure.questionId) {
        const questionIdMatch = line.match(new RegExp(structure.questionId));
        if (questionIdMatch) {
          currentQuestion.question.id = questionIdMatch[1].trim();
          currentSubSection = "";
          continue;
        }
      }

      if (structure.tags) {
        const tagsMatch = line.match(new RegExp(structure.tags));
        if (tagsMatch) {
          const tags = tagsMatch[1].trim();
          currentQuestion.question.tags = tags ? tags.split(", ").map((t: string) => t.trim()) : [];
          currentSubSection = "";
          continue;
        }
      }

      if (structure.difficulty) {
        const difficultyMatch = line.match(new RegExp(structure.difficulty));
        if (difficultyMatch) {
          const difficultyNumbers = difficultyMatch[1].match(/\d+/g);
          if (difficultyNumbers) {
            currentQuestion.question.difficulty = difficultyNumbers.map((r: string) => parseInt(r));
          }
          currentSubSection = "";
          continue;
        }
      }

      if (structure.questionType) {
        const typeMatch = line.match(new RegExp(structure.questionType));
        if (typeMatch) {
          currentQuestion.question.questionType = typeMatch[1].trim();
          currentSubSection = "";
          continue;
        }
      }

      if (structure.presented) {
        const presentedMatch = line.match(new RegExp(structure.presented));
        if (presentedMatch) {
          currentQuestion.isPresented = presentedMatch[1].trim().toLowerCase() === "yes";
          currentSubSection = "";
          continue;
        }
      }

      if (structure.answerRating) {
        const answerRatingMatch = line.match(new RegExp(structure.answerRating));
        if (answerRatingMatch) {
          currentQuestion.questionRating = parseInt(answerRatingMatch[1]);
          currentSubSection = "";
          continue;
        }
      }

      // Parse content lines
      if (
        line &&
        !line.startsWith("**") &&
        !line.startsWith("---") &&
        !line.startsWith("##") &&
        !line.startsWith("###") &&
        !line.startsWith("####") &&
        currentSubSection
      ) {
        if (currentSubSection === "question") {
          if (currentQuestion.question.question) {
            currentQuestion.question.question += "\n" + line;
          } else {
            currentQuestion.question.question = line;
          }
        } else if (currentSubSection === "expectedAnswer") {
          if (line !== "*No expected answer provided.*") {
            if (currentQuestion.question.expectedAnswer) {
              currentQuestion.question.expectedAnswer += "\n" + line;
            } else {
              currentQuestion.question.expectedAnswer = line;
            }
          }
        } else if (currentSubSection === "candidateAnswer") {
          if (line !== "*Not answered yet.*") {
            if (currentQuestion.answer) {
              currentQuestion.answer += "\n" + line;
            } else {
              currentQuestion.answer = line;
            }
          }
        } else if (currentSubSection === "interviewerNotes") {
          if (currentQuestion.note) {
            currentQuestion.note += "\n" + line;
          } else {
            currentQuestion.note = line;
          }
        }
      }
    }
  }

  // Add last question
  if (currentQuestion) {
    data.questions.push(currentQuestion);
  }

  return data;
}

/**
 * Parse JSON content (already structured, just validate)
 */
export function parseJsonWithConfig(content: string): ParsedImportData {
  const jsonData = JSON.parse(content);

  // Validate and normalize
  const data: ParsedImportData = {
    version: jsonData.version || "1.0.0",
    candidate: {
      id: jsonData.candidate.id || generateId(),
      displayName: jsonData.candidate.displayName,
      notes: jsonData.candidate.notes || "",
      createdAt: jsonData.candidate.createdAt,
    },
    session: {
      name: jsonData.session.name,
      date: jsonData.session.date,
      interviewers: jsonData.session.interviewers || [],
      notes: jsonData.session.notes || "",
    },
    questions: jsonData.questions.map((q: Record<string, unknown>, index: number) => {
      const qObj = (q.question ?? {}) as Record<string, unknown>;
      return {
        order: q.order !== undefined ? (q.order as number) : index,
        note: (q.note as string) || "",
        questionRating: (q.questionRating as number) || undefined,
        answer: (q.answer as string) || "",
        isPresented: (q.isPresented as boolean) || false,
        question: {
          id: (qObj.id as string) || generateId(),
          tags: Array.isArray(qObj.tags) ? (qObj.tags as string[]) : [],
          questionType: (qObj.questionType as string) || "text",
          question: (qObj.question as string) || "",
          expectedAnswer: (qObj.expectedAnswer as string) || "",
          difficulty: Array.isArray(qObj.difficulty) ? (qObj.difficulty as number[]) : [],
          hash: (qObj.hash as string) || "",
          createdAt: (qObj.createdAt as string) || new Date().toISOString(),
          updatedAt: (qObj.updatedAt as string) || new Date().toISOString(),
        },
      };
    }),
  };

  return data;
}
