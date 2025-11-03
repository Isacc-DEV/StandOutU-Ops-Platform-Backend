import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

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

const writeSectionTitle = (doc, title) => {
  doc.fillColor('#111827').fontSize(13).text(title, { underline: true });
  doc.moveDown(0.3);
};

const writeParagraph = (doc, text) => {
  doc.fillColor('#1F2937').fontSize(11).text(text);
  doc.moveDown(0.6);
};

const writeList = (doc, items) => {
  items.forEach(item => {
    doc.fillColor('#1F2937').fontSize(11).text(`- ${item}`);
    doc.moveDown(0.2);
  });
  doc.moveDown(0.4);
};

const humanizeStatus = value => {
  if (!value) return '';
  const textValue = value.toString().toLowerCase().replace(/_/g, ' ');
  return textValue.replace(/\b\w/g, char => char.toUpperCase());
};


export const generateResumePdf = async (resume, profile) => {
  await ensureResumeDir();

  const fileName = `${resume._id}.pdf`;
  const filePath = path.join(RESUME_DIR, fileName);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    const content = resume.content || {};

    const title = content.headline || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();

    doc.fillColor('#111827').fontSize(24).text(title || 'Resume');
    doc.moveDown(0.5);
    doc.fillColor('#4B5563').fontSize(10);

    const contactLines = [
      profile.fullName,
      profile.email,
      profile.status ? `Profile status: ${humanizeStatus(profile.status)}` : null,
      profile.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}` : null,
      profile.linkedinStatus ? `LinkedIn status: ${humanizeStatus(profile.linkedinStatus)}` : null,
    ].filter(Boolean);

    contactLines.forEach(line => {
      doc.text(line);
    });

    doc.moveDown(1);
    doc.fillColor('#1F2937');

    if (content.summary) {
      writeSectionTitle(doc, 'Summary');
      writeParagraph(doc, content.summary);
    }

    const skillsList = asArray(content.skills);
    if (skillsList.length) {
      writeSectionTitle(doc, 'Skills');
      writeList(doc, skillsList);
    }

    const experience = Array.isArray(content.experience) ? content.experience : [];
    if (experience.length) {
      writeSectionTitle(doc, 'Experience');
      experience.forEach(item => {
        const header = [item.role, item.company, item.period].filter(Boolean).join(' • ');
        if (header) {
          doc.fillColor('#1F2937').fontSize(12).text(header);
        }
        if (item.description) {
          doc.moveDown(0.2);
          writeParagraph(doc, item.description);
        } else {
          doc.moveDown(0.5);
        }
      });
    }

    const education = Array.isArray(content.education) ? content.education : [];
    if (education.length) {
      writeSectionTitle(doc, 'Education');
      education.forEach(item => {
        const header = [item.degree, item.institution, item.period].filter(Boolean).join(' • ');
        if (header) {
          doc.fillColor('#1F2937').fontSize(12).text(header);
        }
        if (item.notes) {
          doc.moveDown(0.2);
          writeParagraph(doc, item.notes);
        } else {
          doc.moveDown(0.5);
        }
      });
    }

    if (content.extras) {
      writeSectionTitle(doc, 'Additional Information');
      writeParagraph(doc, content.extras);
    }

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  return { filePath, relativePath };
};
