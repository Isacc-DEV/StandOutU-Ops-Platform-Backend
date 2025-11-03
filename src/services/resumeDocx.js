import fs from 'fs';
import path from 'path';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const RESUME_DIR = path.resolve(process.cwd(), 'storage', 'resumes');

const asArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split('\n').map(line => line.trim()).filter(Boolean);
  return [];
};

const ensureResumeDir = async () => {
  await fs.promises.mkdir(RESUME_DIR, { recursive: true });
};

const headingParagraph = text =>
  new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 }
  });

const bulletParagraph = text =>
  new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 }
  });

const bodyParagraph = text =>
  new Paragraph({
    text,
    spacing: { after: 150 }
  });

export const generateResumeDocx = async (resume, profile) => {
  await ensureResumeDir();

  const fileName = `${resume._id}.docx`;
  const filePath = path.join(RESUME_DIR, fileName);

  const content = resume.content || {};
  const contact = profile.contact || {};

  const documentBody = [];

  const titleText = content.headline || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  if (titleText) {
    documentBody.push(
      new Paragraph({
        text: titleText,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 }
      })
    );
  }

  const contactLines = [
    profile.fullName,
    contact.email,
    contact.secondaryEmail,
    contact.phone,
    [contact.addressLine1, contact.addressLine2].filter(Boolean).join(', '),
    [contact.city, contact.state, contact.postalCode, contact.country].filter(Boolean).join(', ')
  ].filter(Boolean);

  if (contactLines.length) {
    contactLines.forEach(line => {
      documentBody.push(
        new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 60 }
        })
      );
    });
    documentBody.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  if (content.summary) {
    documentBody.push(headingParagraph('Summary'));
    documentBody.push(bodyParagraph(content.summary));
  }

  const skillsList = asArray(content.skills);
  if (skillsList.length) {
    documentBody.push(headingParagraph('Skills'));
    skillsList.forEach(skill => {
      documentBody.push(bulletParagraph(skill));
    });
  }

  const experience = Array.isArray(content.experience) ? content.experience : [];
  if (experience.length) {
    documentBody.push(headingParagraph('Experience'));
    experience.forEach(item => {
      const header = [item.role, item.company, item.period].filter(Boolean).join(' - ');
      if (header) {
        documentBody.push(
          new Paragraph({
            children: [new TextRun({ text: header, bold: true })],
            spacing: { after: 100 }
          })
        );
      }
      if (item.description) {
        documentBody.push(bodyParagraph(item.description));
      } else {
        documentBody.push(new Paragraph({ text: '', spacing: { after: 120 } }));
      }
    });
  }

  const education = Array.isArray(content.education) ? content.education : [];
  if (education.length) {
    documentBody.push(headingParagraph('Education'));
    education.forEach(item => {
      const header = [item.degree, item.institution, item.period].filter(Boolean).join(' - ');
      if (header) {
        documentBody.push(
          new Paragraph({
            children: [new TextRun({ text: header, bold: true })],
            spacing: { after: 100 }
          })
        );
      }
      if (item.notes) {
        documentBody.push(bodyParagraph(item.notes));
      } else {
        documentBody.push(new Paragraph({ text: '', spacing: { after: 120 } }));
      }
    });
  }

  if (content.extras) {
    documentBody.push(headingParagraph('Additional Information'));
    documentBody.push(bodyParagraph(content.extras));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: documentBody.length ? documentBody : [new Paragraph('Resume')]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(filePath, buffer);

  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  return { filePath, relativePath };
};
