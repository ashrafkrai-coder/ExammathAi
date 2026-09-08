/**
 * Eksport set soalan kepada fail .docx sebenar menggunakan pustaka `docx`
 * (dimuatkan sebagai global `window.docx` melalui CDN dalam index.html).
 */
(function () {
  function stripLatex(text) {
    if (!text) return '';
    return String(text)
      .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
      .replace(/\\sqrt\{([^}]*)\}/g, 'akar( $1 )')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\pm/g, '±')
      .replace(/\\le/g, '≤')
      .replace(/\\ge/g, '≥')
      .replace(/\\cdot/g, '·')
      .replace(/\{|\}/g, '');
  }

  async function exportQuestionSetToDocx(set) {
    if (!window.docx) {
      throw new Error('Pustaka eksport Word gagal dimuatkan. Sila semak sambungan internet dan cuba lagi.');
    }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;

    const children = [];

    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        text: set.tajuk || 'Set Soalan Matematik SPM',
      })
    );

    children.push(
      new Paragraph({
        text: `Tingkatan ${set.tingkatan} • Tajuk: ${set.tajuk} • Tarikh: ${set.tarikh}`,
        spacing: { after: 300 },
      })
    );

    (set.soalan || []).forEach((q) => {
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [
            new TextRun({ text: `${q.no}. `, bold: true }),
            new TextRun({ text: stripLatex(q.soalan) }),
          ],
        })
      );

      const keys = Object.keys(q.pilihan || {});
      keys.forEach((k) => {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            children: [
              new TextRun({ text: `${k}. `, bold: true }),
              new TextRun({ text: stripLatex(q.pilihan[k]) }),
            ],
          })
        );
      });

      children.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { before: 80 },
          children: [
            new TextRun({ text: 'Jawapan: ', bold: true, color: '1E8E5A' }),
            new TextRun({ text: q.jawapan, bold: true, color: '1E8E5A' }),
          ],
        })
      );

      if (q.penerangan) {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'Langkah Kerja: ', bold: true, italics: true }),
              new TextRun({ text: stripLatex(q.penerangan), italics: true }),
            ],
          })
        );
      }
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `${(set.tajuk || 'soalan-matematik').replace(/[^a-z0-9\-_ ]/gi, '')}-T${set.tingkatan}.docx`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  window.exportQuestionSetToDocx = exportQuestionSetToDocx;
})();
