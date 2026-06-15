// =============================================================
// UMBRA — WHATSAPP SHARE HELPERS
// =============================================================

/* Build a wa.me URL targeted at a number (or the picker if no number). */
function whatsappUrl(text, targetNumber) {
  const encoded = encodeURIComponent(text);
  if (targetNumber) {
    return 'https://wa.me/' + targetNumber + '?text=' + encoded;
  }
  // Fallback: open share picker
  return 'https://wa.me/?text=' + encoded;
}

/* Whose number is currently in the customer mobile field? */
function customerTargetNumber() {
  const el = document.getElementById('custMobile');
  if (!el) return null;
  return parseMobile(el.value.trim());
}

/* Share the comparison list as a formatted WhatsApp message.
   Targets the customer's number if entered, else opens picker. */
function shareComparison() {
  const dims = getDims();
  if (!dims) { toast('Enter size first'); return; }

  const custName = (document.getElementById('custName') || {}).value || '';
  const isInternal = state.mode === 'internal';
  const lines = [];

  lines.push('*✦ AMAR FURNITURE — UMBRA QUOTATION ✦*');
  lines.push('');
  if (custName.trim()) lines.push('*Customer:* ' + custName.trim());
  lines.push('*Size:* ' + dims.Lft + ' ft × ' + dims.W + '"');
  lines.push('*Quote:* ' + (state.quoteId || '—'));
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');

  state.combos.forEach((c, i) => {
    const calc = calcCombo(c, dims.L, dims.W);
    const woodRate = c.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;
    lines.push('');
    lines.push('*Option ' + (i + 1) + ': ' + comboTitle(c) + '*');
    lines.push('  Wood: ' + calc.volCuft.toFixed(3) + ' cuft × ' + fmt(woodRate) + ' = ' + fmt(calc.wood));
    if (c.carve) lines.push('  CNC: ' + calc.sqIn + ' sq in × ' + fmt(CONFIG.RATES.cncPerSqIn) + ' = ' + fmt(calc.cnc));
    if (c.polish) lines.push('  Polish: ' + calc.surface + ' sq in × ' + fmt(CONFIG.RATES.polishPerSqIn) + ' = ' + fmt(calc.polish));
    lines.push('  *Total: ' + fmt(calc.subtotal) + '*');
    if (isInternal) {
      const gst = calc.subtotal * (CONFIG.GST_PERCENT / 100);
      lines.push('  +GST ' + CONFIG.GST_PERCENT + '%: ' + fmt(gst) + ' → ' + fmt(calc.subtotal + gst));
    }
  });

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('_Prices exclusive of GST (' + CONFIG.GST_PERCENT + '%) & transport._');
  lines.push('_उंबरा - उत्तम वास्तू शकुन_');
  lines.push('');
  lines.push('Amar Furniture, Nashik');

  window.open(whatsappUrl(lines.join('\n'), customerTargetNumber()), '_blank');
}

/* Share a single (finalized) combo as a formatted WhatsApp message. */
function shareFinal(combo, calc, dims, custName, today) {
  const isInternal = state.mode === 'internal';
  const gst = calc.subtotal * (CONFIG.GST_PERCENT / 100);
  const lines = [];

  lines.push('*✦ AMAR FURNITURE — UMBRA ✦*');
  lines.push('*★ FINAL QUOTATION ★*');
  lines.push('');
  if (custName) lines.push('*Customer:* ' + custName);
  lines.push('*Date:* ' + today);
  lines.push('*Quote No:* ' + state.quoteId);
  lines.push('*Size:* ' + dims.Lft + ' ft × ' + dims.W + '" × ' + combo.height + '"');
  lines.push('');
  lines.push('*Specification:*');
  lines.push(comboTitle(combo));
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('Wood (' + calc.volCuft.toFixed(3) + ' cuft): ' + fmt(calc.wood));
  if (combo.carve) lines.push('CNC carving: ' + fmt(calc.cnc));
  if (combo.polish) lines.push('Polish: ' + fmt(calc.polish));
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('*TOTAL: ' + fmt(calc.subtotal) + '*');
  if (isInternal) {
    lines.push('+ GST ' + CONFIG.GST_PERCENT + '%: ' + fmt(gst));
    lines.push('*Customer pays: ' + fmt(calc.subtotal + gst) + '*');
  }
  lines.push('');
  lines.push('_GST व ट्रान्सपोर्ट वेगळे · GST and transport extra_');
  lines.push('');
  lines.push('Amar Furniture, Nashik');

  window.open(whatsappUrl(lines.join('\n'), customerTargetNumber()), '_blank');
}

/* Build a WhatsApp message for a placed order, addressed to the SHOP.
   Used by the "Send Order to Amar Furniture" button after Place Order. */
function buildOrderShopMessage(order) {
  const lines = [];
  lines.push('*✦ NEW UMBRA ORDER ✦*');
  lines.push('*Order No:* ' + order.orderNo);
  lines.push('*Placed:* ' + new Date(order.createdAt).toLocaleString('en-IN'));
  lines.push('');
  lines.push('*Customer:* ' + order.customerName);
  lines.push('*Mobile:* ' + displayMobile(order.customerMobile));
  lines.push('');
  lines.push('*Spec:* ' + comboTitle(order.spec));
  lines.push('*Size:* ' + order.dimensions.Lft + ' ft × ' + order.dimensions.W + '"');
  lines.push('');
  lines.push('Wood: ' + fmt(order.pricing.wood));
  if (order.spec.carve) lines.push('CNC: ' + fmt(order.pricing.cnc));
  if (order.spec.polish) lines.push('Polish: ' + fmt(order.pricing.polish));
  lines.push('*TOTAL: ' + fmt(order.pricing.subtotal) + '*');
  if (order.customerNote && order.customerNote.trim()) {
    lines.push('');
    lines.push('*Customer note:*');
    lines.push(order.customerNote.trim());
  }
  lines.push('');
  lines.push('_via umbra.amarfurniture.in_');
  return lines.join('\n');
}

/* The big "Send Order to Amar Furniture" share — always to shop number. */
function shareOrderToShop(order) {
  const msg = buildOrderShopMessage(order);
  window.open(whatsappUrl(msg, CONFIG.shopWhatsApp), '_blank');
}
