/**
 * prisma/seed.ts
 *
 * Production-ready database seeder for the Smart CV Parser & Matcher API.
 *
 * Performs a clean, deterministic seed of the PostgreSQL database with
 * realistic Arabic and English data:
 *
 *   1. Cleans all existing records (MatchResult -> Candidate -> Job, respecting
 *      foreign-key constraints).
 *   2. Inserts 3 Job Descriptions (NestJS backend, Full-Stack .NET/React,
 *      AI Integration) with detailed descriptions and skill lists.
 *   3. Inserts 3 Candidate Profiles — each with a fully-structured parsed-CV
 *      JSON payload, raw resume text, and realistic metadata (names in Arabic
 *      and English, mixed-language skills).
 *   4. Inserts 2 pre-calculated MatchResult evaluations:
 *      - Candidate 1 x Job 1 — 92.5% — MATCHED (strong alignment)
 *      - Candidate 2 x Job 1 — 58.0% — SHORTLISTED (partial match)
 *
 * Run:
 *   npx prisma db seed                   (recommended — loads .env automatically)
 *   npx ts-node --transpile-only prisma/seed.ts   (direct execution)
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Logger                                                                    */
/* ═════════════════════════════════════════════════════════════════════════ */

class SeedLogger {
  private static readonly RESET = '\x1b[0m';
  private static readonly CYAN = '\x1b[36m';
  private static readonly GREEN = '\x1b[32m';
  private static readonly YELLOW = '\x1b[33m';
  private static readonly RED = '\x1b[31m';
  private static readonly BOLD = '\x1b[1m';

  static log(message: string): void {
    console.log(`${this.CYAN}[seed]${this.RESET} ${message}`);
  }

  static success(message: string): void {
    console.log(`${this.GREEN}[seed] ${this.BOLD}✓${this.RESET} ${message}`);
  }

  static warn(message: string): void {
    console.log(`${this.YELLOW}[seed] ⚠${this.RESET} ${message}`);
  }

  static error(message: string, error?: unknown): void {
    console.error(`${this.RED}[seed] ✗${this.RESET} ${message}`, error ?? '');
  }
}

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Prisma Client                                                             */
/* ═════════════════════════════════════════════════════════════════════════ */

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'colorless',
});

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Type Definitions                                                          */
/*  Mirrors src/modules/ai/interfaces/ai-provider.interface.ts so the seed  */
/*  payloads are fully typed without coupling to the NestJS app modules.   */
/* ═════════════════════════════════════════════════════════════════════════ */

interface ParsedExperience {
  jobTitle?: string;
  company?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface ParsedEducation {
  degree?: string;
  institution?: string;
  field?: string;
  graduationYear?: string;
}

interface ParsedCv {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string;
  summary?: string;
  skills: string[];
  languages: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  yearsOfExperience?: number;
}

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Seed Data — Jobs (3)                                                      */
/* ═════════════════════════════════════════════════════════════════════════ */

const job1: Prisma.JobCreateInput = {
  title: 'Senior Backend Engineer — NestJS & Node.js',
  company: 'NexusFlow Technologies',
  location: 'Remote (Global)',
  employmentType: 'Full-time',
  description: `We are seeking a highly skilled Senior Backend Engineer to join our growing engineering team at NexusFlow Technologies.

You will design, implement, and maintain scalable, high-performance backend services using NestJS and Node.js. You will collaborate with frontend teams, product managers, and DevOps to deliver robust, cloud-native solutions that serve millions of users globally.

Responsibilities:
• Architect and develop RESTful and GraphQL APIs using NestJS and TypeScript.
• Design and optimize PostgreSQL databases with complex schemas and high-throughput queries.
• Utilize Prisma ORM for clean, type-safe data access layers.
• Containerize applications with Docker and orchestrate via Kubernetes or Docker Compose.
• Implement Redis caching strategies for low-latency data retrieval.
• Lead code reviews, mentor junior engineers, and establish best engineering practices.
• Collaborate with DevOps to build CI/CD pipelines for automated deployments.`,
  requirements: [
    "Bachelor's degree in Computer Science, Engineering, or a related technical field.",
    '5+ years of professional backend development experience.',
    'Proven expertise with the NestJS framework and Node.js runtime.',
    'Deep knowledge of PostgreSQL: query optimization, indexing, and transaction management.',
    'Strong proficiency with Prisma ORM for data modeling, migrations, and querying.',
    'Hands-on experience with Docker containerization and multi-environment deployment.',
    'Advanced TypeScript skills including generics, advanced types, and type-safe patterns.',
    'Practical experience with Redis: caching, pub/sub, and session storage.',
    'Understanding of microservices architecture and distributed system design.',
    'Experience with RESTful API design, versioning, and OpenAPI/Swagger documentation.',
  ],
  skills: ['NestJS', 'PostgreSQL', 'Prisma', 'Docker', 'TypeScript', 'Redis'],
  minYearsExp: 5,
  isActive: true,
};

const job2: Prisma.JobCreateInput = {
  title: 'Full Stack Developer — React & .NET',
  company: 'دمج للبرمجيات (Dmaj Software)',
  location: 'Dubai, UAE',
  employmentType: 'Full-time',
  description: `Join our dynamic development team at Dmaj Software as a Full Stack Developer.

You will build modern, responsive web applications using React on the frontend and ASP.NET Core on the backend. This hybrid role requires strong skills across the full development stack — from database design to UI/UX implementation.

Responsibilities:
• Develop and maintain responsive web applications using React, TypeScript, and modern CSS frameworks.
• Build and consume RESTful APIs using ASP.NET Core and C#.
• Design and implement database schemas and stored procedures in SQL Server.
• Participate in all phases of the SDLC using Agile/Scrum methodologies.
• Collaborate with UI/UX designers to translate designs into high-quality code.
• Write unit and integration tests to ensure code quality and reliability.
• Review code and provide constructive feedback to peers.`,
  requirements: [
    "Bachelor's degree in Computer Science or a related field.",
    '3+ years of full-stack development experience.',
    'Proficiency in C# and ASP.NET Core web development.',
    'Strong experience with React and modern frontend frameworks.',
    'Proficient in TypeScript for both frontend and backend development.',
    'Experience with SQL Server database development and querying.',
    'Knowledge of RESTful API development and integration patterns.',
    'Experience with Git version control and Agile development methodologies.',
  ],
  skills: ['C#', 'ASP.NET Core', 'React', 'TypeScript', 'SQL Server'],
  minYearsExp: 3,
  isActive: true,
};

const job3: Prisma.JobCreateInput = {
  title: 'AI Integration Specialist',
  company: 'CognitiveMinds AI',
  location: 'Berlin, Germany (Hybrid)',
  employmentType: 'Full-time',
  description: `We are looking for an AI Integration Specialist to join CognitiveMinds AI in Berlin.

You will bridge the gap between cutting-edge AI models and production systems. You will integrate large language models (LLMs), vector databases, and LLM-powered toolchains into our product suite, designing RAG pipelines and AI agents.

Responsibilities:
• Integrate large language models (LLMs) into production applications using LangChain.
• Design and implement RAG pipelines using vector databases for semantic search.
• Build and maintain server-based integrations using Node.js and Python.
• Develop RESTful APIs and server components that orchestrate AI workflows.
• Engineer prompts, evaluate LLM outputs, and iterate on model performance.
• Collaborate with data scientists and ML engineers to deploy AI features.
• Monitor, log, and optimize AI service latency and cost.`,
  requirements: [
    "Master's or Bachelor's degree in Computer Science, AI, or a related field.",
    '2+ years of experience building AI-powered applications with Python.',
    'Experience developing serverless or microservices-based integrations with Node.js.',
    'Hands-on experience with the LangChain framework and prompt engineering.',
    'Practical knowledge of vector databases (Pinecone, Weaviate, Qdrant) for similarity search.',
    'Experience designing and consuming REST APIs in distributed systems.',
    'Familiarity with embeddings, RAG patterns, and LLM evaluation methodologies.',
  ],
  skills: ['Python', 'Node.js', 'LangChain', 'Vector Databases', 'REST APIs'],
  minYearsExp: 2,
  isActive: true,
};

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Seed Data — Candidates (3) with Parsed CVs                              */
/*  Each candidate has both flat DB columns and a structured JSON payload   */
/*  that mirrors the GeminiAiService.extractStructuredCv() output shape.    */
/* ═════════════════════════════════════════════════════════════════════════ */

/* ── Candidate 1: Strong match for Job 1 (محمد أحمد السعيد) ── */

const structuredCv1: ParsedCv = {
  fullName: 'محمد أحمد السعيد',
  email: 'mohamed.ahmed@example.com',
  phone: '+20 123 456 7890',
  location: 'Cairo, Egypt',
  title: 'Senior Backend Engineer',
  summary:
    'Senior Backend Engineer with 7+ years of experience building scalable server-side applications using NestJS, Node.js, and PostgreSQL. Proven track record of leading backend architecture for high-traffic SaaS platforms. Deep expertise in cloud-native deployment, containerization, and microservices design.',
  skills: [
    'NestJS',
    'Node.js',
    'PostgreSQL',
    'Prisma',
    'Docker',
    'TypeScript',
    'Redis',
    'Linux',
    'AWS',
    'Microservices',
    'GraphQL',
    'RESTful APIs',
    'Jest',
    'CI/CD',
    'Git',
  ],
  languages: ['Arabic (Native)', 'English (Fluent)'],
  experience: [
    {
      jobTitle: 'Senior Backend Engineer',
      company: 'NexusFlow Technologies',
      location: 'Remote',
      startDate: '2021-03',
      endDate: '2024-09',
      description:
        'Led a team of 4 backend engineers building a NestJS-powered SaaS platform. Designed PostgreSQL schemas handling 10M+ records; optimized queries with indexing strategies, reducing p99 latency by 60%. Implemented Redis caching layer and Docker-based CI/CD pipelines deployed to AWS ECS.',
    },
    {
      jobTitle: 'Backend Engineer',
      company: 'DataLink Solutions',
      location: 'Cairo, Egypt',
      startDate: '2019-06',
      endDate: '2021-03',
      description:
        'Developed RESTful APIs using Node.js and Express with PostgreSQL. Migrated legacy services to TypeScript and Prisma ORM, improving type safety and reducing runtime errors by 40%. Introduced Docker for local development environments.',
    },
    {
      jobTitle: 'Junior Full Stack Developer',
      company: 'NileTech',
      location: 'Cairo, Egypt',
      startDate: '2017-09',
      endDate: '2019-06',
      description:
        'Built and maintained internal productivity tools using Node.js, React, and MongoDB. Wrote unit tests with Jest and participated in Agile ceremonies.',
    },
  ],
  education: [
    {
      degree: 'Bachelor of Science',
      institution: 'Cairo University — Faculty of Computers and Information',
      field: 'Computer Science',
      graduationYear: '2017',
    },
  ],
  yearsOfExperience: 7,
};

const rawText1 = `محمد أحمد السعيد
Senior Backend Engineer | Cairo, Egypt
📧 mohamed.ahmed@example.com | 📱 +20 123 456 7890
LinkedIn: linkedin.com/in/mohamed-ahmed | GitHub: github.com/mohamed-ahmed

الملخص المهني
Senior Backend Engineer with 7+ years building scalable server-side applications using NestJS, Node.js, PostgreSQL, Prisma, and Docker.

CORE SKILLS
NestJS, Node.js, PostgreSQL, Prisma, Docker, TypeScript, Redis, AWS, Linux, Microservices, GraphQL, Jest, CI/CD, Git

EXPERIENCE
Senior Backend Engineer | NexusFlow Technologies | Mar 2021 – Sep 2024
- Led NestJS SaaS platform serving 500K+ users
- PostgreSQL schema design; query optimization reduced p99 latency by 60%
- Docker + AWS ECS CI/CD pipeline implementation
- Redis caching strategy for low-latency data retrieval

Backend Engineer | DataLink Solutions | Jun 2019 – Mar 2021
- RESTful API development with Node.js, Express, PostgreSQL
- Migrated to TypeScript + Prisma ORM, reducing runtime errors by 40%

Junior Full Stack Developer | NileTech | Sep 2017 – Jun 2019
- Internal tools with Node.js, React, MongoDB

EDUCATION
B.Sc. Computer Science | Cairo University | 2017`;

const candidate1: Prisma.CandidateCreateInput = {
  fullName: 'محمد أحمد السعيد',
  email: 'mohamed.ahmed@example.com',
  phone: '+20 123 456 7890',
  location: 'Cairo, Egypt',
  title: 'Senior Backend Engineer',
  summary: structuredCv1.summary,
  skills: structuredCv1.skills,
  languages: structuredCv1.languages,
  rawText: rawText1,
  structured: structuredCv1 as unknown as Prisma.InputJsonValue,
  fileName: 'mohamed_ahmed_cv.pdf',
  fileUrl: null,
  status: 'PARSED',
  yearsOfExp: 7,
};

/* ── Candidate 2: Partial match for Job 1 (Sarah Johnson) ── */

const structuredCv2: ParsedCv = {
  fullName: 'Sarah Johnson',
  email: 'sarah.johnson@example.com',
  phone: '+1 (555) 123-4567',
  location: 'Austin, TX, USA',
  title: 'Frontend Developer',
  summary:
    'Frontend developer with 3 years of experience building responsive web applications using React and TypeScript. Strong foundation in JavaScript and modern CSS frameworks. Has worked on backend integration using Node.js and Express but primarily focused on frontend architecture. Actively expanding backend skills.',
  skills: [
    'React',
    'JavaScript',
    'TypeScript',
    'HTML',
    'CSS',
    'Sass',
    'Node.js',
    'Express',
    'Git',
    'Jest',
    'REST APIs',
  ],
  languages: ['English (Native)'],
  experience: [
    {
      jobTitle: 'Frontend Developer',
      company: 'CloudScale Apps',
      location: 'Austin, TX',
      startDate: '2022-04',
      endDate: '2024-09',
      description:
        'Built and maintained a React/TypeScript dashboard for a SaaS analytics platform. Collaborated with backend engineers to integrate REST APIs. Wrote unit tests with Jest and used Sass for component styling.',
    },
    {
      jobTitle: 'Junior Web Developer',
      company: 'PixelForge Studio',
      location: 'Austin, TX',
      startDate: '2021-06',
      endDate: '2022-04',
      description:
        'Developed responsive UI components using React, HTML5, and modern CSS. Assisted in migrating legacy jQuery components to modern React.',
    },
  ],
  education: [
    {
      degree: 'Bachelor of Arts',
      institution: 'University of Texas at Austin',
      field: 'Web Design and Interactive Media',
      graduationYear: '2021',
    },
  ],
  yearsOfExperience: 3,
};

const rawText2 = `Sarah Johnson
Frontend Developer | Austin, TX, USA
Email: sarah.johnson@example.com | Phone: +1 (555) 123-4567

PROFESSIONAL SUMMARY
Frontend developer with 3 years of experience building responsive web applications using React and TypeScript. Strong in JavaScript, HTML, CSS, Sass. Basic Node.js/Express experience.

CORE SKILLS
React, JavaScript, TypeScript, HTML, CSS, Sass, Node.js, Express, Git, Jest, REST APIs

EXPERIENCE
Frontend Developer | CloudScale Apps | Apr 2022 – Sep 2024
- React/TypeScript dashboard for SaaS analytics platform
- Integrated REST APIs with backend team
- Unit testing with Jest and Sass styling

Junior Web Developer | PixelForge Studio | Jun 2021 – Apr 2022
- Responsive UI with React, HTML5, modern CSS
- Migrated jQuery components to React

EDUCATION
B.A. Web Design & Interactive Media | University of Texas at Austin | 2021`;

const candidate2: Prisma.CandidateCreateInput = {
  fullName: 'Sarah Johnson',
  email: 'sarah.johnson@example.com',
  phone: '+1 (555) 123-4567',
  location: 'Austin, TX, USA',
  title: 'Frontend Developer',
  summary: structuredCv2.summary,
  skills: structuredCv2.skills,
  languages: structuredCv2.languages,
  rawText: rawText2,
  structured: structuredCv2 as unknown as Prisma.InputJsonValue,
  fileName: 'sarah_johnson_cv.pdf',
  fileUrl: null,
  status: 'PARSED',
  yearsOfExp: 3,
};

/* ── Candidate 3: Weak match for Job 1 (علي حسن محمود) ── */

const structuredCv3: ParsedCv = {
  fullName: 'علي حسن محمود',
  email: 'ali.hassan@example.com',
  phone: '+966 50 123 4567',
  location: 'Jeddah, Saudi Arabia',
  title: 'Junior Software Developer',
  summary:
    "Recent graduate with a Bachelor's degree in Computer Science and internship experience in web development. Proficient in frontend technologies (HTML, CSS, JavaScript, React) and has basic knowledge of Node.js. Actively learning backend frameworks and database design. Seeking to grow as a full-stack developer.",
  skills: [
    'JavaScript',
    'HTML',
    'CSS',
    'React',
    'Bootstrap',
    'Git',
    'REST APIs',
  ],
  languages: ['Arabic (Native)', 'English (Basic)'],
  experience: [
    {
      jobTitle: 'Software Development Intern',
      company: 'Saudi Digital Solutions',
      location: 'Jeddah, Saudi Arabia',
      startDate: '2024-01',
      endDate: '2024-06',
      description:
        'Assisted in building responsive web pages using HTML, CSS, and React. Collaborated with senior developers to understand code review processes and Agile workflows.',
    },
  ],
  education: [
    {
      degree: 'Bachelor of Science',
      institution: 'King Abdulaziz University',
      field: 'Computer Science',
      graduationYear: '2024',
    },
  ],
  yearsOfExperience: 1,
};

const rawText3 = `علي حسن محمود
Junior Software Developer | Jeddah, Saudi Arabia
البريد الإلكتروني: ali.hassan@example.com | الهاتف: +966 50 123 4567

ملخص مهني
Recent graduate with internship experience in web development. Proficient in HTML, CSS, JavaScript, React, Bootstrap. Basic Node.js knowledge. Seeking to grow as a full-stack developer.

CORE SKILLS
JavaScript, HTML, CSS, React, Bootstrap, Git, REST APIs

EXPERIENCE
Software Development Intern | Saudi Digital Solutions | Jan 2024 – Jun 2024
- Built responsive web pages using React and Bootstrap
- Participated in Agile ceremonies and code reviews

EDUCATION
B.Sc. Computer Science | King Abdulaziz University | 2024`;

const candidate3: Prisma.CandidateCreateInput = {
  fullName: 'علي حسن محمود',
  email: 'ali.hassan@example.com',
  phone: '+966 50 123 4567',
  location: 'Jeddah, Saudi Arabia',
  title: 'Junior Software Developer',
  summary: structuredCv3.summary,
  skills: structuredCv3.skills,
  languages: structuredCv3.languages,
  rawText: rawText3,
  structured: structuredCv3 as unknown as Prisma.InputJsonValue,
  fileName: 'ali_hassan_cv.pdf',
  fileUrl: null,
  status: 'PARSED',
  yearsOfExp: 1,
};

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Main — clean, insert, summarize                                          */
/* ═════════════════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  SeedLogger.log('Starting database seed…');

  /* ── 1. Clean existing data (FK-safe order) ── */
  SeedLogger.log('Cleaning existing data (MatchResult → Candidate → Job)…');
  await prisma.$transaction([
    prisma.matchResult.deleteMany({}),
    prisma.candidate.deleteMany({}),
    prisma.job.deleteMany({}),
  ]);
  SeedLogger.success('Existing records cleared.');

  /* ── 2. Seed jobs (parallel) ── */
  SeedLogger.log('Seeding 3 job descriptions…');
  const [job1Rec, job2Rec, job3Rec] = await Promise.all([
    prisma.job.create({ data: job1 }),
    prisma.job.create({ data: job2 }),
    prisma.job.create({ data: job3 }),
  ]);
  SeedLogger.success('Created 3 jobs:');
  SeedLogger.log(`  • ${job1Rec.title} (id: ${job1Rec.id})`);
  SeedLogger.log(`  • ${job2Rec.title} (id: ${job2Rec.id})`);
  SeedLogger.log(`  • ${job3Rec.title} (id: ${job3Rec.id})`);

  /* ── 3. Seed candidates (parallel) ── */
  SeedLogger.log('Seeding 3 candidate profiles with parsed CVs…');
  const [cand1, cand2, cand3] = await Promise.all([
    prisma.candidate.create({ data: candidate1 }),
    prisma.candidate.create({ data: candidate2 }),
    prisma.candidate.create({ data: candidate3 }),
  ]);
  SeedLogger.success('Created 3 candidates:');
  SeedLogger.log(`  • ${cand1.fullName} → ${cand1.email} (id: ${cand1.id})`);
  SeedLogger.log(`  • ${cand2.fullName} → ${cand2.email} (id: ${cand2.id})`);
  SeedLogger.log(`  • ${cand3.fullName} → ${cand3.email} (id: ${cand3.id})`);

  /* ── 4. Seed match results ── */
  SeedLogger.log('Seeding 2 pre-calculated match evaluations…');

  const match1 = await prisma.matchResult.create({
    data: {
      candidateId: cand1.id,
      jobId: job1Rec.id,
      score: 92.5,
      status: 'MATCHED',
      strengths: [
        'Expertise in NestJS framework architecture and dependency injection',
        'Deep PostgreSQL query optimization and schema design',
        'Prisma ORM for type-safe data access layers',
        'Docker containerization and multi-environment deployment',
        'Advanced TypeScript with generics and design patterns',
        'Redis caching strategies for low-latency retrieval',
        'Microservices architecture and distributed systems',
        'AWS cloud deployment experience (ECS, S3, RDS)',
      ],
      missingSkills: [],
      reasoning:
        'Candidate is an exceptional match for the Senior Backend Engineer role. ' +
        'Demonstrates deep expertise across all six required skills (NestJS, ' +
        'PostgreSQL, Prisma, Docker, TypeScript, Redis) plus complementary ' +
        'capabilities in AWS, microservices, and GraphQL. Seven years of ' +
        'progressive backend experience aligns perfectly with the senior-level ' +
        'requirements. No critical skill gaps identified — the candidate exceeds ' +
        'expectations on all evaluated dimensions.',
      rawOutput: {
        score: 92.5,
        status: 'MATCHED',
        strengths: [
          'NestJS',
          'PostgreSQL',
          'Prisma',
          'Docker',
          'TypeScript',
          'Redis',
          'AWS',
          'Microservices',
        ],
        missingSkills: [],
        reasoning: 'Pre-calculated seed evaluation — strong match.',
        evaluatedAt: new Date().toISOString(),
        method: 'manual-seed',
      } as Prisma.InputJsonValue,
    },
  });
  SeedLogger.success(
    `${cand1.fullName} × ${job1Rec.title} → 92.5% (MATCHED) (id: ${match1.id})`,
  );

  const match2 = await prisma.matchResult.create({
    data: {
      candidateId: cand2.id,
      jobId: job1Rec.id,
      score: 58.0,
      status: 'SHORTLISTED',
      strengths: [
        'TypeScript proficiency (frontend and basic backend)',
        'Node.js fundamentals (Express)',
        'Git version control and code collaboration',
        'REST API consumption experience',
      ],
      missingSkills: [
        'NestJS',
        'PostgreSQL',
        'Prisma',
        'Docker',
        'Redis',
        'Microservices',
      ],
      reasoning:
        'Candidate is a partial match. Strong frontend and TypeScript ' +
        'background with basic Node.js experience, but lacks expertise in ' +
        'NestJS, PostgreSQL, Prisma, Docker, and Redis — all core requirements ' +
        'for this Senior Backend Engineer role. Suitable for shortlisting if ' +
        'the candidate can rapidly upskill, or for a junior-to-mid-level ' +
        'position with mentorship and a reduced backend scope.',
      rawOutput: {
        score: 58.0,
        status: 'SHORTLISTED',
        strengths: ['TypeScript', 'Node.js', 'Git', 'REST APIs'],
        missingSkills: [
          'NestJS',
          'PostgreSQL',
          'Prisma',
          'Docker',
          'Redis',
          'Microservices',
        ],
        reasoning: 'Pre-calculated seed evaluation — partial match.',
        evaluatedAt: new Date().toISOString(),
        method: 'manual-seed',
      } as Prisma.InputJsonValue,
    },
  });
  SeedLogger.success(
    `${cand2.fullName} × ${job1Rec.title} → 58.0% (SHORTLISTED) (id: ${match2.id})`,
  );

  /* ── 5. Summary ── */
  console.log('');
  SeedLogger.success('═══════════════════════════════════════════════════');
  SeedLogger.success(' Seed completed successfully!');
  SeedLogger.success('═══════════════════════════════════════════════════');
  SeedLogger.log('Summary:');
  SeedLogger.log('  Jobs:          3');
  SeedLogger.log('  Candidates:    3');
  SeedLogger.log('  MatchResults:  2  (1 MATCHED, 1 SHORTLISTED)');
  SeedLogger.log('');
  SeedLogger.log('Match overview:');
  SeedLogger.log(`  • ${cand1.fullName} → ${job1Rec.title}`);
  SeedLogger.log('    Score: 92.5%  |  Status: MATCHED');
  SeedLogger.log(`  • ${cand2.fullName} → ${job1Rec.title}`);
  SeedLogger.log('    Score: 58.0%  |  Status: SHORTLISTED');
  SeedLogger.log(
    `  • ${cand3.fullName} → (no match seeded — weak match candidate)`,
  );
  SeedLogger.log('');
}

/* ═════════════════════════════════════════════════════════════════════════ */
/*  Entry Point                                                              */
/* ═════════════════════════════════════════════════════════════════════════ */

main()
  .catch((error: unknown) => {
    SeedLogger.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
