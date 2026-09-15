import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  AnalysisResult,
  ICvDataExtractor,
  ISmartAnalysisProvider,
  MatchEvaluation,
  ParsedCv,
  ParsedJob,
  TailoredAdvice,
  TailoredBulletPoint,
} from '../interfaces/ai-provider.interface';

const MAX_PROMPT_CHARS = 15000;
const MAX_JSON_CHARS = 12000;

@Injectable()
export class GeminiAiService
  implements ICvDataExtractor, ISmartAnalysisProvider
{
  private readonly logger = new Logger(GeminiAiService.name);
  private readonly client: GoogleGenerativeAI | null = null;
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('app.gemini.apiKey', '');
    this.modelName = this.config.get<string>(
      'app.gemini.model',
      'gemini-3.6-flash',
    );
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY missing - fallback heuristics active.');
    }
  }

  // -------------------------------------------------------------------------
  // Native JSON-schema definitions (responseSchema enforcement)
  // -------------------------------------------------------------------------

  private get cvSchema(): any {
    return {
      type: SchemaType.OBJECT,
      properties: {
        fullName: { type: SchemaType.STRING, nullable: true },
        email: { type: SchemaType.STRING, nullable: true },
        phone: { type: SchemaType.STRING, nullable: true },
        location: { type: SchemaType.STRING, nullable: true },
        title: { type: SchemaType.STRING, nullable: true },
        summary: { type: SchemaType.STRING, nullable: true },
        skills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        languages: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        experience: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              jobTitle: { type: SchemaType.STRING, nullable: true },
              company: { type: SchemaType.STRING, nullable: true },
              location: { type: SchemaType.STRING, nullable: true },
              startDate: { type: SchemaType.STRING, nullable: true },
              endDate: { type: SchemaType.STRING, nullable: true },
              description: { type: SchemaType.STRING, nullable: true },
            },
            required: [
              'jobTitle',
              'company',
              'location',
              'startDate',
              'endDate',
              'description',
            ],
          },
        },
        education: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              degree: { type: SchemaType.STRING, nullable: true },
              institution: { type: SchemaType.STRING, nullable: true },
              field: { type: SchemaType.STRING, nullable: true },
              graduationYear: { type: SchemaType.STRING, nullable: true },
            },
            required: ['degree', 'institution', 'field', 'graduationYear'],
          },
        },
        yearsOfExperience: { type: SchemaType.NUMBER, nullable: true },
      },
      required: [
        'fullName',
        'email',
        'phone',
        'location',
        'title',
        'summary',
        'skills',
        'languages',
        'experience',
        'education',
        'yearsOfExperience',
      ],
    };
  }

  private get jobSchema(): any {
    return {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, nullable: true },
        company: { type: SchemaType.STRING, nullable: true },
        location: { type: SchemaType.STRING, nullable: true },
        employmentType: { type: SchemaType.STRING, nullable: true },
        seniorityLevel: { type: SchemaType.STRING, nullable: true },
        minYearsExperience: { type: SchemaType.NUMBER, nullable: true },
        requiredHardSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        softSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        domainKeywords: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        requirements: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: [
        'title',
        'company',
        'location',
        'employmentType',
        'seniorityLevel',
        'minYearsExperience',
        'requiredHardSkills',
        'softSkills',
        'domainKeywords',
        'requirements',
      ],
    };
  }
  private get evaluationSchema(): any {
    return {
      type: SchemaType.OBJECT,
      properties: {
        matchScore: { type: SchemaType.NUMBER },
        strengths: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        missingSkills: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        reasoning: { type: SchemaType.STRING },
        tailoredAdvice: {
          type: SchemaType.OBJECT,
          properties: {
            summary: { type: SchemaType.STRING },
            rewrittenBulletPoints: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  original: { type: SchemaType.STRING, nullable: true },
                  tailored: { type: SchemaType.STRING },
                  targetKeywords: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                  },
                  section: { type: SchemaType.STRING, nullable: true },
                },
                required: ['original', 'tailored', 'targetKeywords', 'section'],
              },
            },
            skillsToAdd: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            keywordsToInclude: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            actionableSteps: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
          },
          required: [
            'summary',
            'rewrittenBulletPoints',
            'skillsToAdd',
            'keywordsToInclude',
            'actionableSteps',
          ],
        },
      },
      required: [
        'matchScore',
        'strengths',
        'missingSkills',
        'reasoning',
        'tailoredAdvice',
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Public API (Smart SaaS pipeline)
  // -------------------------------------------------------------------------
  /**
   * Extracts the candidate profile, skills, experience and education
   * from raw CV text using strict JSON-schema enforcement.
   */
  async parseCv(rawText: string): Promise<ParsedCv> {
    if (!this.client) return this.fallbackParse(rawText);
    try {
      const model = this.buildModel(this.cvSchema, 0.1);
      const prompt = [
        'You are an expert technical CV/Resume parser.',
        'Extract the candidate profile from the raw resume text below.',
        'Rules:',
        '- Only use facts present in the text; never invent or infer missing data.',
        '- Normalize skill names (e.g. "nodejs" -> "Node.js", "postgres" -> "PostgreSQL").',
        '- Return experience and education entries ordered newest first.',
        '- yearsOfExperience must be the total professional experience in years (decimal allowed).',
        '- Use null for absent scalar values and [] for absent lists.',
        'RAW RESUME TEXT:',
        `"""${rawText.slice(0, MAX_PROMPT_CHARS)}"""`,
      ].join('\n');

      const result = await model.generateContent(prompt);
      return this.normalizeCv(this.extractJson(result.response.text()));
    } catch (e) {
      this.logger.error(`Gemini CV parse failed: ${(e as Error).message}`);
      return this.fallbackParse(rawText);
    }
  }

  /**
   * Extracts required hard skills, soft skills, domain keywords and
   * seniority level from a raw job description.
   */
  async parseJob(rawJobText: string): Promise<ParsedJob> {
    if (!this.client) return this.fallbackParseJob(rawJobText);
    try {
      const model = this.buildModel(this.jobSchema, 0.1);
      const prompt = [
        'You are an expert technical recruiter and job-description analyst.',
        'Extract the structured job requirements from the raw job posting below.',
        'Rules:',
        '- requiredHardSkills: technologies, tools, certifications and hard competencies that are mandatory or clearly required.',
        '- softSkills: interpersonal/communication/leadership traits explicitly mentioned.',
        '- domainKeywords: industry/domain terms and ATS keywords a tailored CV should contain.',
        '- seniorityLevel: one of intern|junior|mid|senior|lead|principal (infer from title and required years).',
        '- requirements: verbatim key requirement lines, max 12.',
        '- Only use facts present in the text; use null/[] when absent.',
        'RAW JOB DESCRIPTION:',
        `"""${rawJobText.slice(0, MAX_PROMPT_CHARS)}"""`,
      ].join('\n');

      const result = await model.generateContent(prompt);
      return this.normalizeJob(this.extractJson(result.response.text()));
    } catch (e) {
      this.logger.error(`Gemini job parse failed: ${(e as Error).message}`);
      return this.fallbackParseJob(rawJobText);
    }
  }
  /**
   * Deterministic semantic match evaluation (temperature 0.2) plus
   * job-tailored CV optimization advice with rewritten resume bullets.
   */
  async evaluateAndTailor(
    cvJson: ParsedCv,
    jobJson: ParsedJob,
  ): Promise<AnalysisResult> {
    if (!this.client) return this.fallbackEvaluateAndTailor(cvJson, jobJson);
    try {
      const model = this.buildModel(this.evaluationSchema, 0.2);
      const prompt = [
        'You are a senior technical recruiter performing a deterministic CV-to-job evaluation.',
        'Score the candidate against the job using this weighting:',
        '- 50% mandatory hard skills coverage (requiredHardSkills).',
        '- 20% relevant experience depth and seniority alignment (seniorityLevel, minYearsExperience, yearsOfExperience).',
        '- 15% domain keyword overlap (domainKeywords).',
        '- 10% soft skills alignment.',
        '- 5% education relevance.',
        'Rules:',
        '- matchScore: integer 0-100. Never inflate; missing mandatory skills must heavily reduce the score.',
        '- strengths: 3-6 concrete, evidence-based points quoting what the CV actually shows.',
        '- missingSkills: only hard skills/requirements from the job that are absent from the CV, ordered by importance, max 8.',
        '- reasoning: 2-4 neutral sentences justifying the score against the weighting above.',
        '- tailoredAdvice.rewrittenBulletPoints: 3-6 bullets. Rewrite the weakest or least aligned CV bullets into quantified, action-verb-led achievements that surface the job keywords. NEVER fabricate employers, dates, technologies or results - reframe only facts present in the CV.',
        '- targetKeywords: job keywords addressed by each rewritten bullet.',
        '- skillsToAdd: adjacent/missing skills worth adding once genuinely acquired.',
        '- keywordsToInclude: highest-value ATS keywords from the job to weave into the CV.',
        '- actionableSteps: 3-5 concrete next actions for the candidate.',
        'CANDIDATE CV JSON:',
        JSON.stringify(cvJson).slice(0, MAX_JSON_CHARS),
        'JOB JSON:',
        JSON.stringify(jobJson).slice(0, MAX_JSON_CHARS),
      ].join('\n');

      const result = await model.generateContent(prompt);
      return this.normalizeEvaluation(this.extractJson(result.response.text()));
    } catch (e) {
      this.logger.error(
        `Gemini evaluate/tailor failed: ${(e as Error).message}`,
      );
      return this.fallbackEvaluateAndTailor(cvJson, jobJson);
    }
  }
  // -------------------------------------------------------------------------
  // Legacy compatibility API (ParserService / MatchingService)
  // -------------------------------------------------------------------------

  extractStructuredCv(rawText: string): Promise<ParsedCv> {
    return this.parseCv(rawText);
  }

  async evaluateMatch(
    structuredCv: ParsedCv | Record<string, any>,
    jobDescription: string,
    jobRequirements: string[] = [],
  ): Promise<MatchEvaluation> {
    if (!this.client) return this.fallbackMatch(structuredCv, jobDescription);
    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' } as any,
      });
      const prompt =
        'You are an expert recruiter. Return ONLY JSON: ' +
        '{score 0-100, strengths[], missingSkills[], reasoning}. ' +
        'Candidate: ' +
        JSON.stringify(structuredCv).slice(0, 8000) +
        ' Job: ' +
        jobDescription.slice(0, 8000) +
        ' Requirements: ' +
        JSON.stringify(jobRequirements);
      const result = await model.generateContent(prompt);
      const json = this.extractJson(result.response.text());
      return {
        score: this.clampScore(json.score),
        strengths: this.toStringArray(json.strengths),
        missingSkills: this.toStringArray(json.missingSkills),
        reasoning: String(json.reasoning ?? ''),
      };
    } catch (e) {
      this.logger.error(`Gemini match failed: ${(e as Error).message}`);
      return this.fallbackMatch(structuredCv, jobDescription);
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private buildModel(schema: Record<string, any>, temperature: number) {
    return this.client!.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature,
      } as any,
    });
  }

  private extractJson(text: string): any {
    const cleaned = text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    const slice =
      first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    return JSON.parse(slice);
  }

  private clampScore(value: unknown): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0);
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
  }
  private normalizeCv(json: any): ParsedCv {
    return {
      fullName: this.toOptionalString(json.fullName),
      email: this.toOptionalString(json.email),
      phone: this.toOptionalString(json.phone),
      location: this.toOptionalString(json.location),
      title: this.toOptionalString(json.title),
      summary: this.toOptionalString(json.summary),
      skills: this.toStringArray(json.skills),
      languages: this.toStringArray(json.languages),
      experience: Array.isArray(json.experience)
        ? json.experience.map((item: any) => ({
            jobTitle: this.toOptionalString(item?.jobTitle),
            company: this.toOptionalString(item?.company),
            location: this.toOptionalString(item?.location),
            startDate: this.toOptionalString(item?.startDate),
            endDate: this.toOptionalString(item?.endDate),
            description: this.toOptionalString(item?.description),
          }))
        : [],
      education: Array.isArray(json.education)
        ? json.education.map((item: any) => ({
            degree: this.toOptionalString(item?.degree),
            institution: this.toOptionalString(item?.institution),
            field: this.toOptionalString(item?.field),
            graduationYear: this.toOptionalString(item?.graduationYear),
          }))
        : [],
      yearsOfExperience:
        Number(json.yearsOfExperience ?? 0) > 0
          ? Number(json.yearsOfExperience)
          : undefined,
    };
  }

  private normalizeJob(json: any): ParsedJob {
    return {
      title: this.toOptionalString(json.title),
      company: this.toOptionalString(json.company),
      location: this.toOptionalString(json.location),
      employmentType: this.toOptionalString(json.employmentType),
      seniorityLevel: this.toOptionalString(json.seniorityLevel),
      minYearsExperience:
        Number(json.minYearsExperience ?? 0) > 0
          ? Number(json.minYearsExperience)
          : undefined,
      requiredHardSkills: this.toStringArray(json.requiredHardSkills),
      softSkills: this.toStringArray(json.softSkills),
      domainKeywords: this.toStringArray(json.domainKeywords),
      requirements: this.toStringArray(json.requirements),
    };
  }
  private normalizeEvaluation(json: any): AnalysisResult {
    const advice = json?.tailoredAdvice ?? {};
    const bullets: TailoredBulletPoint[] = Array.isArray(
      advice.rewrittenBulletPoints,
    )
      ? advice.rewrittenBulletPoints
          .map((item: any) => ({
            original: this.toOptionalString(item?.original),
            tailored: this.toOptionalString(item?.tailored) ?? '',
            targetKeywords: this.toStringArray(item?.targetKeywords),
            section: this.toOptionalString(item?.section),
          }))
          .filter((item: TailoredBulletPoint) => item.tailored.length > 0)
      : [];

    const tailoredAdvice: TailoredAdvice = {
      summary: this.toOptionalString(advice.summary),
      rewrittenBulletPoints: bullets,
      skillsToAdd: this.toStringArray(advice.skillsToAdd),
      keywordsToInclude: this.toStringArray(advice.keywordsToInclude),
      actionableSteps: this.toStringArray(advice.actionableSteps),
    };

    return {
      matchScore: this.clampScore(json?.matchScore),
      strengths: this.toStringArray(json?.strengths),
      missingSkills: this.toStringArray(json?.missingSkills),
      reasoning: String(json?.reasoning ?? '').trim(),
      tailoredAdvice,
    };
  }
  // -------------------------------------------------------------------------
  // Deterministic fallbacks (used when GEMINI_API_KEY is absent or a call fails)
  // -------------------------------------------------------------------------

  private fallbackParse(rawText: string): ParsedCv {
    const email = rawText.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
    const phone = rawText.match(/\+?[0-9][0-9\s\-()]{6,}[0-9]/)?.[0];
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      fullName: lines[0]?.slice(0, 120),
      email,
      phone,
      skills: [],
      languages: [],
      experience: [],
      education: [],
      summary: rawText.slice(0, 500),
    };
  }

  private fallbackParseJob(rawJobText: string): ParsedJob {
    const lines = rawJobText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const bulletLines = lines.filter((l) => /^[-*•\d]/.test(l));
    const seniority = rawJobText.match(
      /\b(intern|junior|mid|mid-level|senior|lead|principal)\b/i,
    );
    const minYears = rawJobText.match(/(\d+)\+?\s*(?:years|yrs)/i)?.[1];
    return {
      title: lines[0]?.slice(0, 160),
      seniorityLevel: seniority?.[1]?.toLowerCase(),
      minYearsExperience: Number(minYears ?? 0) || undefined,
      requiredHardSkills: [],
      softSkills: [],
      domainKeywords: [],
      requirements: bulletLines.slice(0, 12),
    };
  }

  private fallbackMatch(
    cv: ParsedCv | Record<string, any>,
    jd: string,
  ): MatchEvaluation {
    const skills = ((cv as ParsedCv).skills ?? []) as string[];
    const lower = jd.toLowerCase();
    const hits = skills.filter((s) => lower.includes(String(s).toLowerCase()));
    const score =
      skills.length === 0
        ? 10
        : Math.round((hits.length / skills.length) * 100);
    return {
      score,
      strengths: hits,
      missingSkills: [],
      reasoning: 'Fallback heuristic match (Gemini unavailable).',
    };
  }

  private fallbackEvaluateAndTailor(
    cv: ParsedCv,
    job: ParsedJob,
  ): AnalysisResult {
    const cvSkills = (cv.skills ?? []).map((s) => String(s).toLowerCase());
    const targetSkills = Array.from(
      new Set([
        ...(job.requiredHardSkills ?? []),
        ...(job.domainKeywords ?? []),
      ]),
    );
    const hits = targetSkills.filter((skill) =>
      cvSkills.includes(String(skill).toLowerCase()),
    );
    const misses = targetSkills.filter(
      (skill) => !cvSkills.includes(String(skill).toLowerCase()),
    );
    const matchScore =
      targetSkills.length === 0
        ? 50
        : Math.round((hits.length / targetSkills.length) * 100);

    const keywords = (misses.length > 0 ? misses : hits).slice(0, 3);
    const bullets: TailoredBulletPoint[] = (cv.experience ?? [])
      .slice(0, 3)
      .filter((exp) => !!exp.description)
      .map((exp) => ({
        original: exp.description,
        tailored: `${exp.description} (aligned with ${keywords.join(', ')})`,
        targetKeywords: targetSkills.slice(0, 5),
        section: 'experience',
      }));

    return {
      matchScore: this.clampScore(matchScore),
      strengths: hits.slice(0, 8),
      missingSkills: misses.slice(0, 8),
      reasoning:
        'Fallback heuristic scoring (Gemini unavailable): keyword overlap between CV skills and job requirements.',
      tailoredAdvice: {
        summary:
          'Fallback advice: emphasize the overlap between your skills and the job requirements.',
        rewrittenBulletPoints: bullets,
        skillsToAdd: misses.slice(0, 8),
        keywordsToInclude: targetSkills.slice(0, 10),
        actionableSteps: misses
          .slice(0, 3)
          .map((skill) => `Add a concrete achievement referencing ${skill}.`),
      },
    };
  }
}
