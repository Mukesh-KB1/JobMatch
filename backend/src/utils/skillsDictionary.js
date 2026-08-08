// A maintained keyword dictionary used to extract a normalized skills list
// from free-text resumes and job descriptions. Not exhaustive by design -
// it's meant to be extended over time as real resumes reveal gaps.
export const SKILL_DICTIONARY = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php',
  'swift', 'kotlin', 'sql', 'r', 'scala', 'html', 'css',
  // Frameworks / libraries
  'react', 'vue', 'angular', 'node.js', 'express', 'next.js', 'django', 'flask',
  'spring', 'spring boot', '.net', 'laravel', 'rails', 'redux', 'tailwind',
  // Data / ML
  'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'machine learning',
  'deep learning', 'data analysis', 'data visualization', 'power bi', 'tableau', 'excel',
  // Infra / DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins',
  'git', 'github actions', 'linux', 'nginx',
  // Databases
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'dynamodb', 'firebase',
  // Product / business
  'product management', 'agile', 'scrum', 'jira', 'stakeholder management',
  'project management', 'business analysis', 'roadmapping',
  // Design
  'figma', 'ui design', 'ux design', 'adobe photoshop', 'adobe illustrator',
  // Marketing / sales
  'seo', 'sem', 'content marketing', 'social media marketing', 'salesforce',
  'crm', 'lead generation', 'negotiation', 'account management',
  // General office / support
  'customer support', 'communication', 'team leadership', 'accounting', 'bookkeeping',
  'quickbooks', 'sap', 'hr', 'recruiting', 'payroll',
];

export function extractSkills(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const skill of SKILL_DICTIONARY) {
    // Word-boundary-ish match so "r" doesn't match inside "developer".
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    if (pattern.test(lower)) found.add(skill);
  }
  return Array.from(found);
}

// Looks for patterns like "5 years of experience", "3+ years", "over 4 years".
export function extractExperienceYears(text) {
  if (!text) return null;
  const matches = [...text.matchAll(/(\d+)\+?\s*(?:years|yrs)\b/gi)];
  if (matches.length === 0) return null;
  const years = matches.map((m) => parseInt(m[1], 10)).filter((n) => !Number.isNaN(n) && n < 60);
  if (years.length === 0) return null;
  return Math.max(...years);
}

// Cheap keyword-overlap relevance score (0-100) used for default Jobs page
// sorting. No Gemini call spent here - that's reserved for the real scored fit.
export function keywordOverlapScore(resumeSkills = [], jobSkills = []) {
  if (!jobSkills.length) return 0;
  const resumeSet = new Set(resumeSkills.map((s) => s.toLowerCase()));
  const overlap = jobSkills.filter((s) => resumeSet.has(s.toLowerCase())).length;
  return Math.round((overlap / jobSkills.length) * 100);
}
