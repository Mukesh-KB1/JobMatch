// Optional demo-data seeder: npm run seed
//
// Inserts a handful of realistic manual/seed jobs directly into MongoDB, so
// the app is browsable immediately without waiting on external API keys or
// the bootstrap sync. Safe to re-run (upserts by source+externalId).
import { connectDB, disconnectDB } from '../config/db.js';
import { jobRepository } from '../repositories/jobRepository.js';

const SEED_JOBS = [
  {
    source: 'seed', externalId: 'seed-1',
    title: 'Frontend Engineer (React)', company: 'Northwind Labs',
    location: 'Bengaluru, India', country: 'in', remote: true,
    description: 'Build and maintain our customer-facing React + TypeScript dashboard. Work closely with design and backend teams.',
    requiredSkills: ['react', 'typescript', 'javascript', 'css', 'git'],
    applyUrl: 'https://example.com/jobs/frontend-engineer', salary: '₹18-28 LPA',
  },
  {
    source: 'seed', externalId: 'seed-2',
    title: 'Backend Engineer (Node.js)', company: 'Northwind Labs',
    location: 'Bengaluru, India', country: 'in', remote: true,
    description: 'Design and operate our Node.js/Express APIs backed by MongoDB. Own service reliability and API design.',
    requiredSkills: ['node.js', 'express', 'mongodb', 'javascript', 'docker'],
    applyUrl: 'https://example.com/jobs/backend-engineer', salary: '₹20-32 LPA',
  },
  {
    source: 'seed', externalId: 'seed-3',
    title: 'Data Analyst', company: 'Harbor & Co',
    location: 'London, UK', country: 'gb', remote: false,
    description: 'Turn raw operational data into dashboards and recommendations for leadership. SQL and Power BI daily.',
    requiredSkills: ['sql', 'excel', 'power bi', 'data analysis'],
    applyUrl: 'https://example.com/jobs/data-analyst', salary: '£38,000-£48,000',
  },
  {
    source: 'seed', externalId: 'seed-4',
    title: 'Product Manager', company: 'Fieldstone',
    location: 'Remote', country: '', remote: true,
    description: 'Own the roadmap for our SMB onboarding product. Run discovery, write specs, work with an agile squad.',
    requiredSkills: ['product management', 'agile', 'scrum', 'roadmapping', 'stakeholder management'],
    applyUrl: 'https://example.com/jobs/product-manager', salary: '$110,000-$140,000',
  },
  {
    source: 'seed', externalId: 'seed-5',
    title: 'DevOps Engineer', company: 'Cascade Systems',
    location: 'Toronto, Canada', country: 'ca', remote: true,
    description: 'Manage our AWS infrastructure, Kubernetes clusters, and CI/CD pipelines. On-call rotation.',
    requiredSkills: ['aws', 'kubernetes', 'docker', 'terraform', 'ci/cd', 'linux'],
    applyUrl: 'https://example.com/jobs/devops-engineer', salary: 'CA$95,000-CA$125,000',
  },
  {
    source: 'seed', externalId: 'seed-6',
    title: 'UX Designer', company: 'Fieldstone',
    location: 'Remote', country: '', remote: true,
    description: 'Design end-to-end flows for our onboarding product, run usability tests, maintain the Figma design system.',
    requiredSkills: ['figma', 'ux design', 'ui design'],
    applyUrl: 'https://example.com/jobs/ux-designer', salary: '$90,000-$115,000',
  },
];

async function main() {
  await connectDB();
  console.log('[seed] Connected to MongoDB. Seeding demo jobs...');
  for (const job of SEED_JOBS) {
    await jobRepository.upsertFromSource(job);
    console.log(`  upserted: ${job.title} @ ${job.company}`);
  }
  console.log(`[seed] Done - ${SEED_JOBS.length} demo jobs available.`);
  await disconnectDB();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
