import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB, prisma } from '../config/db.js';
import {
  PROFILE_ACCESS,
  ROLES,
  APPLICATION_CHECK_RESULT,
  APPLICATION_CHECK_STATUS
} from '../config/auth.js';
import { generateResumePdf } from '../services/resumePdf.js';
import { generateResumeDocx } from '../services/resumeDocx.js';

await connectDB();

await prisma.notification.deleteMany();
await prisma.emailLog.deleteMany();
await prisma.meeting.deleteMany();
await prisma.interview.deleteMany();
await prisma.application.deleteMany();
await prisma.resume.deleteMany();
await prisma.profileOwner.deleteMany();
await prisma.userProfileAssignment.deleteMany();
await prisma.profile.deleteMany();
await prisma.user.deleteMany();

const pass = await bcrypt.hash('password123', 10);

const includeResumeRelations = {
  createdByUser: { select: { id: true, name: true, email: true } },
  profile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      alias: true,
      email: true,
      status: true,
      linkedinUrl: true,
      linkedinStatus: true
    }
  }
};

const admin = await prisma.user.create({
  data: {
    name: 'Admin',
    email: 'admin@ops.local',
    passwordHash: pass,
    role: ROLES.ADMIN,
    companyRole: 'Operations Manager',
    avatarUrl: 'https://i.pravatar.cc/120?img=32',
    permissions: {
        applications: {
          manageAllApplications: true,
          checkAllApplications: false,
          manageApplications: [],
          checkApplications: []
        },
      profiles: PROFILE_ACCESS.EDIT
    }
  }
});

const bidderKash = await prisma.user.create({
  data: {
    name: 'Kash Lane',
    email: 'kash@ops.local',
    passwordHash: pass,
    role: ROLES.BIDDER,
    companyRole: 'Senior Bidder',
    avatarUrl: 'https://i.pravatar.cc/120?img=12',
    permissions: {
        applications: {
          manageAllApplications: false,
          checkAllApplications: false,
          manageApplications: [],
          checkApplications: []
        },
      profiles: PROFILE_ACCESS.VIEW
    }
  }
});

const bidderSam = await prisma.user.create({
  data: {
    name: 'Sam Lee',
    email: 'sam@ops.local',
    passwordHash: pass,
    role: ROLES.BIDDER,
    companyRole: 'Bidder',
    avatarUrl: 'https://i.pravatar.cc/120?img=18',
    permissions: {
        applications: {
          manageAllApplications: false,
          checkAllApplications: false,
          manageApplications: [],
          checkApplications: []
        },
      profiles: PROFILE_ACCESS.VIEW
    }
  }
});

const profileSeed = [
  {
    key: 'eagle',
    alias: 'eagle',
    firstName: 'Christopher',
    lastName: 'Harper',
    email: 'christopher@mail.com',
    status: 'ACTIVE',
    linkedinUrl: 'https://linkedin.com/in/christopher-harper',
    linkedinStatus: 'LIVE_GOOD',
    owners: [admin.id]
  },
  {
    key: 'sparrow',
    alias: 'sparrow',
    firstName: 'Emily',
    lastName: 'Stone',
    email: 'emily@mail.com',
    status: 'PRESTART',
    linkedinUrl: 'https://linkedin.com/in/emily-stone-ops',
    linkedinStatus: 'LIVE_STABLE',
    owners: [admin.id]
  },
  {
    key: 'falcon',
    alias: 'falcon',
    firstName: 'Jordan',
    lastName: 'Briggs',
    email: 'jordan@mail.com',
    status: 'DISABLED',
    linkedinUrl: null,
    linkedinStatus: 'RESTRICTED',
    owners: [admin.id]
  }
];

const profileDocs = {};
for (const item of profileSeed) {
  const profile = await prisma.profile.create({
    data: {
      alias: item.alias,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      status: item.status,
      linkedinUrl: item.linkedinUrl,
      linkedinStatus: item.linkedinStatus,
      owners: {
        create: item.owners.map(ownerId => ({
          user: { connect: { id: ownerId } }
        }))
      }
    }
  });
  profileDocs[item.key] = profile;
}

await prisma.user.update({
  where: { id: bidderKash.id },
  data: {
    permissions: {
      applications: {
        manageAllApplications: false,
        checkAllApplications: false,
        manageApplications: [profileDocs.eagle.id],
        checkApplications: [profileDocs.eagle.id]
      },
      profiles: PROFILE_ACCESS.VIEW
    }
  }
});

await prisma.user.update({
  where: { id: bidderSam.id },
  data: {
    permissions: {
      applications: {
        manageAllApplications: false,
        checkAllApplications: false,
        manageApplications: [profileDocs.sparrow.id, profileDocs.falcon.id],
        checkApplications: [profileDocs.sparrow.id]
      },
      profiles: PROFILE_ACCESS.VIEW
    }
  }
});

const resumeSeed = [
  {
    profile: profileDocs.eagle,
    title: 'Site Reliability Specialist',
    stack: 'DevOps',
    content: {
      headline: 'Christopher Harper — Site Reliability Engineer',
      summary:
        'Operational leader ensuring reliability for large scale products with automated observability, IaC, and rigorous incident tooling.',
      skills: ['AWS', 'Terraform', 'Kubernetes', 'Prometheus', 'Go', 'Python', 'Incident Response'],
      experience: [
        {
          company: 'Amplitude',
          role: 'Senior Site Reliability Engineer',
          period: '2020 – Present',
          description:
            'Scaled infrastructure to support 5x traffic growth, drove error budgets, and introduced chaos engineering exercises.'
        },
        {
          company: 'Segment',
          role: 'Infrastructure Engineer',
          period: '2016 – 2020',
          description:
            'Led build-out of multi-region Kubernetes clusters and migrated workloads with zero downtime.'
        }
      ],
      education: [
        {
          institution: 'University of Washington',
          degree: 'BS, Computer Engineering',
          period: '2010 – 2014'
        }
      ],
      extras: 'AWS Community Hero • Speaker at KubeCon'
    }
  },
  {
    profile: profileDocs.sparrow,
    title: 'Product UI Specialist',
    stack: 'Frontend',
    content: {
      headline: 'Emily Stone — Product UI Specialist',
      summary:
        'Design-oriented engineer building accessible, performant interfaces with React, TypeScript, and design systems.',
      skills: ['React', 'TypeScript', 'GraphQL', 'Tailwind', 'Design Systems', 'Accessibility'],
      experience: [
        {
          company: 'Palette Labs',
          role: 'Staff Frontend Engineer',
          period: '2022 – Present',
          description:
            'Led UI architecture for analytics dashboard used by 30k users; introduced accessibility audits and component linting to the pipeline.'
        },
        {
          company: 'Atelier',
          role: 'Frontend Engineer',
          period: '2018 – 2022',
          description:
            'Delivered internationalized ecommerce experiences, reducing time-to-interaction by 55% via prioritized hydration strategies.'
        }
      ],
      education: [
        {
          institution: 'Parsons School of Design',
          degree: 'BFA, Communication Design',
          period: '2010 – 2014'
        }
      ],
      extras: 'Conference speaker • Maintainer of the “Layr” design system starter'
    }
  },
  {
    profile: profileDocs.falcon,
    title: 'Fullstack Product Engineer',
    stack: 'Fullstack',
    content: {
      headline: 'Jordan Briggs — Fullstack Product Engineer',
      summary:
        'Product-minded engineer delivering user experiences end-to-end with TypeScript, Node.js, and cloud-native services.',
      skills: ['Node.js', 'React', 'PostgreSQL', 'GraphQL', 'AWS Lambda', 'Domain-Driven Design'],
      experience: [
        {
          company: 'Helix',
          role: 'Senior Fullstack Engineer',
          period: '2021 – Present',
          description:
            'Shipped scheduling platform powering 5M bookings annually, integrating payments, webhook audits, and real-time availability.'
        },
        {
          company: 'Brightside',
          role: 'Fullstack Engineer',
          period: '2017 – 2021',
          description:
            'Built service-oriented architecture with Node.js and React Native clients, reducing critical bugs by 60% through typed contracts.'
        }
      ],
      education: [
        {
          institution: 'University of Manchester',
          degree: 'MSc, Software Engineering',
          period: '2012 – 2016'
        }
      ],
      extras: 'Writes the “Systems Weekly” newsletter on pragmatic architecture'
    }
  }
];

const resumeDocs = [];
for (const item of resumeSeed) {
  const resume = await prisma.resume.create({
    data: {
      profileId: item.profile.id,
      title: item.title,
      stack: item.stack,
      storage: '',
      docxStorage: '',
      version: 'v1',
      createdById: admin.id,
      content: item.content
    },
    include: includeResumeRelations
  });

  const resumeForDocs = {
    ...resume,
    _id: resume.id,
    id: resume.id
  };
  const profileForDocs = {
    ...item.profile,
    _id: item.profile.id,
    fullName: `${item.profile.firstName || ''} ${item.profile.lastName || ''}`.trim()
  };

  const { relativePath: pdfPath } = await generateResumePdf(resumeForDocs, profileForDocs);
  const { relativePath: docxPath } = await generateResumeDocx(resumeForDocs, profileForDocs);

  const updatedResume = await prisma.resume.update({
    where: { id: resume.id },
    data: {
      storage: pdfPath,
      docxStorage: docxPath,
      storageOriginalName: '',
      storageMimeType: ''
    },
    include: includeResumeRelations
  });

  resumeDocs.push(updatedResume);
}

await prisma.application.createMany({
  data: [
    {
      company: 'Planhat',
      roleTitle: 'Site Reliability Engineer',
      jobUrl: 'https://plnh.at/jobs/site-reliability-engineer',
      profileId: profileDocs.eagle.id,
      resumeId: resumeDocs[0].id,
      bidderId: bidderKash.id,
      bidderNote: 'Follow up after fixing job URL',
      steps: [{ name: 'screen', status: 'ongoing' }],
      checkStatus: APPLICATION_CHECK_STATUS.PENDING,
      checkResult: APPLICATION_CHECK_RESULT.PENDING
    },
    {
      company: 'Scorp',
      roleTitle: 'Frontend Developer',
      jobUrl:
        'http://loka-digital-medya-reklamcilik-ve-teknoloji-anonim-sirketi.breezy.hr/p/c564d0bb97a9-frontend-developer?state=published',
      profileId: profileDocs.eagle.id,
      resumeId: resumeDocs[0].id,
      bidderId: bidderKash.id,
      bidderNote: 'Waiting on coding challenge feedback',
      steps: [
        { name: 'screen', status: 'passed' },
        { name: 'tech', status: 'ongoing' }
      ],
      checkStatus: APPLICATION_CHECK_STATUS.PENDING,
      checkResult: APPLICATION_CHECK_RESULT.PENDING
    },
    {
      company: 'MyEdSpace',
      roleTitle: 'Frontend Software Engineer',
      jobUrl: 'https://jobs.ashbyhq.com/myedspacecareers/2a1716b4-0519-49e8-b523-19d2180a98ff/application',
      profileId: profileDocs.sparrow.id,
      resumeId: resumeDocs[1].id,
      bidderId: bidderSam.id,
      bidderNote: 'Submitted via LinkedIn',
      steps: [{ name: 'applied', status: 'ongoing' }],
      checkStatus: APPLICATION_CHECK_STATUS.PENDING,
      checkResult: APPLICATION_CHECK_RESULT.PENDING
    },
    {
      company: 'Acme Corp',
      roleTitle: 'Senior Backend Engineer',
      jobUrl: 'https://jobs.acme',
      profileId: profileDocs.falcon.id,
      resumeId: resumeDocs[2].id,
      bidderId: bidderSam.id,
      bidderNote: 'Intro call scheduled',
      steps: [{ name: 'screen', status: 'ongoing' }],
      checkStatus: APPLICATION_CHECK_STATUS.PENDING,
      checkResult: APPLICATION_CHECK_RESULT.PENDING
    }
  ]
});

console.log('Seeded');
await disconnectDB();
