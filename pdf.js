// =============================================================
// UMBRA — PDF GENERATION
// =============================================================
// Uses jsPDF (loaded from CDN via index.html).
// =============================================================

function _pdfTheme() {
  return {
    wood: [139, 90, 43],
    woodDark: [93, 60, 32],
    gold: [200, 155, 58],
    muted: [138, 122, 100],
    ink: [61, 40, 23],
    cream: [255, 253, 247],
  };
}

function _rupeeAscii(n) {
  return 'Rs. ' + Math.round(n).toLocaleString('en-IN');
}

/* Build a finalized-quote PDF (one combo, billing layout) */
function buildFinalPDF(combo, calc, dims, custName, today) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297;
  const margin = 18;
  const T = _pdfTheme();
  const rupee = _rupeeAscii;

  // Banner
  doc.setFillColor(...T.woodDark);
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setDrawColor(...T.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(pageW/2 - 28, 8, 56, 7, 1, 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...T.gold);
  doc.text('FINALIZED QUOTE', pageW/2, 13, { align: 'center' });

  doc.setFontSize(20);
  doc.setTextColor(...T.cream);
  doc.text('UMBRA', pageW/2, 24, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(220, 200, 170);
  doc.text('Threshold of fortune  ·  Amar Furniture, Nashik', pageW/2, 31, { align: 'center' });

  // Meta
  let y = 50;
  const colW = (pageW - margin*2) / 2;
  const meta = [
    ['CUSTOMER', custName || '—'],
    ['DATE', today],
    ['QUOTE NO.', state.quoteId || '—'],
    ['SIZE', dims.Lft + ' ft × ' + dims.W + '" × ' + combo.height + '"'],
  ];

  for (let i = 0; i < meta.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * colW;
    const yy = y + row * 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...T.muted);
    doc.text(meta[i][0], x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...T.woodDark);
    doc.text(String(meta[i][1]), x, yy + 5);
  }

  y += 28;

  doc.setDrawColor(180, 150, 110);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  // Spec
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...T.gold);
  doc.text('SPECIFICATION', margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...T.woodDark);
  doc.text(comboTitle(combo), margin, y);
  y += 12;

  // Line items
  const woodRate = combo.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;

  const drawLine = (label, detail, amount) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...T.ink);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...T.muted);
    doc.text(detail, margin, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...T.ink);
    doc.text(rupee(amount), pageW - margin, y, { align: 'right' });
    y += 10;
    doc.setDrawColor(200, 175, 145);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(margin, y - 3, pageW - margin, y - 3);
    doc.setLineDashPattern([], 0);
  };

  drawLine(
    combo.wood + ' wood',
    calc.volCuft.toFixed(3) + ' cuft x ' + rupee(woodRate) + '/cuft',
    calc.wood
  );

  if (combo.carve) {
    drawLine(
      'CNC carving',
      calc.sqIn + ' sq in x ' + rupee(CONFIG.RATES.cncPerSqIn) + '/sq in',
      calc.cnc
    );
  }

  if (combo.polish) {
    const polishRaw = calc.surface * CONFIG.RATES.polishPerSqIn;
    const minNote = polishRaw < CONFIG.RATES.polishMin ? ' (min ' + rupee(CONFIG.RATES.polishMin) + ')' : '';
    drawLine(
      'Polish',
      calc.surface + ' sq in surface x ' + rupee(CONFIG.RATES.polishPerSqIn) + '/sq in' + minNote,
      calc.polish
    );
  }

  // Total
  y += 4;
  doc.setDrawColor(...T.woodDark);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...T.woodDark);
  doc.text('TOTAL', margin, y);
  doc.setFontSize(20);
  doc.text(rupee(calc.subtotal), pageW - margin, y, { align: 'right' });
  y += 4;
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...T.muted);
  doc.text('* GST ' + CONFIG.GST_PERCENT + '% extra. Transport extra.', pageW/2, y, { align: 'center' });

  // Footer
  doc.setDrawColor(...T.gold);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 22, pageW - margin, pageH - 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...T.woodDark);
  doc.text('AMAR FURNITURE', pageW/2, pageH - 16, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...T.muted);
  doc.text('Crafted in Nashik  ·  since 1985', pageW/2, pageH - 11, { align: 'center' });

  return doc;
}

/* Build a comparison-list PDF (multiple combos in one page) */
function buildComparisonPDF(custName, today, dims) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297;
  const margin = 18;
  const T = _pdfTheme();
  const rupee = _rupeeAscii;

  doc.setFillColor(...T.woodDark);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...T.cream);
  doc.text('UMBRA', pageW/2, 15, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(220, 200, 170);
  doc.text('Quotation Comparison  ·  Amar Furniture, Nashik', pageW/2, 22, { align: 'center' });

  let y = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...T.muted);
  doc.text('CUSTOMER', margin, y);
  doc.text('DATE', margin + 60, y);
  doc.text('SIZE', margin + 110, y);
  doc.text('QUOTE NO.', pageW - margin - 35, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...T.woodDark);
  doc.text(custName || '—', margin, y);
  doc.text(today, margin + 60, y);
  doc.text(dims.Lft + ' ft x ' + dims.W + '"', margin + 110, y);
  doc.text(state.quoteId || '—', pageW - margin, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(180, 150, 110);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  state.combos.forEach((c, i) => {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }

    const calc = calcCombo(c, dims.L, dims.W);
    const woodRate = c.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;

    doc.setFillColor(250, 245, 230);
    doc.rect(margin, y - 5, pageW - margin*2, 9, 'F');
    doc.setDrawColor(...T.gold);
    doc.setLineWidth(0.8);
    doc.line(margin, y - 5, margin, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...T.gold);
    doc.text('OPTION ' + (i + 1), margin + 3, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...T.woodDark);
    doc.text(comboTitle(c), margin + 22, y);

    doc.setFontSize(13);
    doc.text(rupee(calc.subtotal), pageW - margin, y, { align: 'right' });

    y += 8;

    const drawSubLine = (label, detail, amt) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...T.ink);
      doc.text(label, margin + 4, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...T.muted);
      doc.text(detail, margin + 30, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...T.ink);
      doc.text(rupee(amt), pageW - margin, y, { align: 'right' });
      y += 5;
    };

    drawSubLine(c.wood + ' wood', calc.volCuft.toFixed(3) + ' cuft x ' + rupee(woodRate) + '/cuft', calc.wood);
    if (c.carve) drawSubLine('CNC carving', calc.sqIn + ' sq in x ' + rupee(CONFIG.RATES.cncPerSqIn) + '/sq in', calc.cnc);
    if (c.polish) drawSubLine('Polish', calc.surface + ' sq in x ' + rupee(CONFIG.RATES.polishPerSqIn) + '/sq in', calc.polish);
    y += 4;
  });

  if (y > pageH - 30) { doc.addPage(); y = margin; }
  doc.setDrawColor(180, 150, 110);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...T.muted);
  doc.text('* All prices exclusive of GST (' + CONFIG.GST_PERCENT + '%) and transport.', pageW/2, y, { align: 'center' });

  doc.setDrawColor(...T.gold);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 22, pageW - margin, pageH - 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...T.woodDark);
  doc.text('AMAR FURNITURE', pageW/2, pageH - 16, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...T.muted);
  doc.text('Crafted in Nashik  ·  since 1985', pageW/2, pageH - 11, { align: 'center' });

  return doc;
}

/* Build a placed-order PDF (similar to final but with order number prominent) */
function buildOrderPDF(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297;
  const margin = 18;
  const T = _pdfTheme();
  const rupee = _rupeeAscii;

  // Banner
  doc.setFillColor(...T.woodDark);
  doc.rect(0, 0, pageW, 42, 'F');

  doc.setDrawColor(...T.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(pageW/2 - 22, 8, 44, 7, 1, 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...T.gold);
  doc.text('ORDER PLACED', pageW/2, 13, { align: 'center' });

  doc.setFontSize(20);
  doc.setTextColor(...T.cream);
  doc.text('UMBRA', pageW/2, 24, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...T.gold);
  doc.text(order.orderNo, pageW/2, 33, { align: 'center' });

  // Meta
  let y = 54;
  const colW = (pageW - margin*2) / 2;
  const today = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const meta = [
    ['CUSTOMER', order.customerName],
    ['MOBILE', displayMobile(order.customerMobile)],
    ['DATE', today],
    ['SIZE', order.dimensions.Lft + ' ft × ' + order.dimensions.W + '" × ' + order.spec.height + '"'],
  ];

  for (let i = 0; i < meta.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * colW;
    const yy = y + row * 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...T.muted);
    doc.text(meta[i][0], x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...T.woodDark);
    doc.text(String(meta[i][1]), x, yy + 5);
  }

  y += 28;

  doc.setDrawColor(180, 150, 110);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageW - margin, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...T.gold);
  doc.text('SPECIFICATION', margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...T.woodDark);
  doc.text(comboTitle(order.spec), margin, y);
  y += 12;

  const woodRate = order.spec.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;
  const calc = order.pricing;
  const L = order.dimensions.L || (order.dimensions.Lft * 12);
  const W = order.dimensions.W;
  const H = order.spec.height;
  const volCuft = (L * W * H) / 1728;
  const sqIn = L * W;
  const surface = (L * W) + 2 * (L * H) + 2 * (W * H);

  const drawLine = (label, detail, amount) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...T.ink);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...T.muted);
    doc.text(detail, margin, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...T.ink);
    doc.text(rupee(amount), pageW - margin, y, { align: 'right' });
    y += 10;
    doc.setDrawColor(200, 175, 145);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.line(margin, y - 3, pageW - margin, y - 3);
    doc.setLineDashPattern([], 0);
  };

  drawLine(order.spec.wood + ' wood', volCuft.toFixed(3) + ' cuft x ' + rupee(woodRate) + '/cuft', calc.wood);
  if (order.spec.carve) drawLine('CNC carving', sqIn + ' sq in x ' + rupee(CONFIG.RATES.cncPerSqIn) + '/sq in', calc.cnc);
  if (order.spec.polish) drawLine('Polish', surface + ' sq in surface x ' + rupee(CONFIG.RATES.polishPerSqIn) + '/sq in', calc.polish);

  y += 4;
  doc.setDrawColor(...T.woodDark);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...T.woodDark);
  doc.text('TOTAL', margin, y);
  doc.setFontSize(20);
  doc.text(rupee(calc.subtotal), pageW - margin, y, { align: 'right' });
  y += 4;
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  if (order.customerNote && order.customerNote.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...T.gold);
    doc.text('CUSTOMER NOTE', margin, y);
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...T.ink);
    const lines = doc.splitTextToSize(order.customerNote, pageW - margin*2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...T.muted);
  doc.text('* GST ' + CONFIG.GST_PERCENT + '% extra. Transport extra.', pageW/2, y, { align: 'center' });

  doc.setDrawColor(...T.gold);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 22, pageW - margin, pageH - 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...T.woodDark);
  doc.text('AMAR FURNITURE', pageW/2, pageH - 16, { align: 'center' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...T.muted);
  doc.text('Crafted in Nashik  ·  since 1985  ·  +91 ' + CONFIG.shopWhatsApp.slice(2), pageW/2, pageH - 11, { align: 'center' });

  return doc;
}

/* Dispatch PDF: Web Share API on mobile (with files), download on desktop */
async function sharePDF(doc, filename, contextText) {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Umbra Quotation',
        text: contextText || '',
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Share failed, falling back to download', err);
    }
  }

  doc.save(filename);
  toast('PDF downloaded — drag into WhatsApp Web');
}
