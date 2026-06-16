// =============================================================
// UMBRA — BUILDER (combo picker + comparison list)
// =============================================================

function buildBuilder() {
  document.querySelectorAll('.option-group').forEach(group => {
    const axis = group.dataset.axis;
    group.querySelectorAll('.option-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (pill.classList.contains('disabled')) return;
        const raw = pill.dataset.val;
        const val = (axis === 'height') ? parseFloat(raw)
                  : (axis === 'carve' || axis === 'polish') ? (raw === 'true')
                  : raw;
        state.builder[axis] = val;
        if (axis === 'height' && val === 1 && state.builder.carve === true) {
          state.builder.carve = false;
        }
        syncBuilderUI();
      });
    });
  });
}

function syncBuilderUI() {
  document.querySelectorAll('.option-group').forEach(group => {
    const axis = group.dataset.axis;
    group.querySelectorAll('.option-pill').forEach(pill => {
      const raw = pill.dataset.val;
      const val = (axis === 'height') ? parseFloat(raw)
                : (axis === 'carve' || axis === 'polish') ? (raw === 'true')
                : raw;
      pill.classList.toggle('active', state.builder[axis] === val);
    });
  });

  const carvedPill = document.querySelector('.option-group[data-axis="carve"] .option-pill[data-val="true"]');
  if (carvedPill) {
    const disabled = state.builder.height === 1;
    carvedPill.classList.toggle('disabled', disabled);
    carvedPill.title = disabled ? 'CNC carving needs 1½" height' : '';
  }

  updateBuilderPreview();
}

function updateBuilderPreview() {
  const b = state.builder;
  const previewText = document.getElementById('previewText');
  const previewPrice = document.getElementById('previewPrice');
  const addBtn = document.getElementById('addBtn');
  if (!previewText || !previewPrice || !addBtn) return;

  const complete = b.wood !== null && b.height !== null && b.carve !== null && b.polish !== null;

  if (!complete) {
    previewText.textContent = 'Pick all four options to preview…';
    previewPrice.textContent = '';
    addBtn.disabled = true;
    return;
  }

  const dims = getDims();
  const title = comboTitle(b);
  if (!dims) {
    previewText.innerHTML = '<strong>' + escapeHtml(title) + '</strong> <span style="opacity:0.7">— enter size to see price</span>';
    previewPrice.textContent = '';
    addBtn.disabled = false;
    return;
  }

  const calc = calcCombo(b, dims.L, dims.W);
  previewText.innerHTML = '<strong>' + escapeHtml(title) + '</strong>';
  previewPrice.textContent = fmt(calc.subtotal);
  addBtn.disabled = false;
}

function resetBuilder() {
  state.builder = { wood: null, height: null, carve: null, polish: null };
  syncBuilderUI();
}

function addCombo() {
  const b = state.builder;
  if (b.wood === null || b.height === null || b.carve === null || b.polish === null) {
    toast('Pick all four options first');
    return;
  }
  const pendingCombo = { wood: b.wood, height: b.height, carve: b.carve, polish: b.polish };
  // If we don't know the customer yet — show identity modal first
  if (!inquiryIdentityKnown()) {
    openAddToCartModal(pendingCombo);
    return;
  }
  doAddCombo(pendingCombo);
}

/* The actual combo addition — called after identity is confirmed */
async function doAddCombo(pendingCombo) {
  if (!state.quoteId) state.quoteId = generateOrderNo();
  state.combos.push({
    id: state.nextId++,
    wood: pendingCombo.wood, height: pendingCombo.height,
    carve: pendingCombo.carve, polish: pendingCombo.polish,
  });
  resetBuilder();
  renderList();
  toast('Added to cart ✓');
  // Sync to Firestore inquiry (non-blocking)
  const dims = getDims();
  syncInquiryToFirestore(state.combos, dims).catch(() => {});
}

function renderList() {
  const body = document.getElementById('listBody');
  const countEl = document.getElementById('listCount');
  if (!body) return;
  if (countEl) {
    countEl.textContent = state.combos.length + ' item' + (state.combos.length === 1 ? '' : 's');
  }

  if (state.combos.length === 0) {
    body.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon">◇</div>' +
      'No combinations yet.<br>Build a combo above and tap <strong>Add to Cart</strong> to save it.' +
      '</div>';
    return;
  }

  const dims = getDims();
  const isInternal = state.mode === 'internal';

  let html = '<div class="combo-list">' +
    state.combos.map((c, i) => renderComboCard(c, i, dims, isInternal)).join('') +
    '</div>';

  if (dims) {
    html +=
      '<div class="share-row">' +
      '<button class="share-btn whatsapp" id="shareCmpWA">📱 Text Quote</button>' +
      '<button class="share-btn" id="shareCmpPDF">📄 Share PDF</button>' +
      '</div>';
  } else {
    html += '<div class="empty-state" style="margin-top:14px">Enter length &amp; width above to see prices.</div>';
  }

  body.innerHTML = html;

  if (dims) {
    document.getElementById('shareCmpWA').addEventListener('click', shareComparison);
    document.getElementById('shareCmpPDF').addEventListener('click', () => {
      const custName = (document.getElementById('custName') || {}).value || '';
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const doc = buildComparisonPDF(custName.trim(), today, dims);
      const filename = (state.quoteId || 'umbra-quote') + '-comparison.pdf';
      const ctx = 'Umbra quotation comparison from Amar Furniture' + (custName.trim() ? ' for ' + custName.trim() : '');
      sharePDF(doc, filename, ctx);
    });
  }

  body.querySelectorAll('.combo-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    card.querySelectorAll('.toggle-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (pill.classList.contains('disabled')) return;
        const axis = pill.dataset.axis;
        const raw = pill.dataset.val;
        const val = (axis === 'height') ? parseFloat(raw)
                  : (axis === 'carve' || axis === 'polish') ? (raw === 'true')
                  : raw;
        toggleComboField(id, axis, val);
      });
    });
    const del = card.querySelector('.combo-action.delete');
    if (del) del.addEventListener('click', () => deleteCombo(id));
    const fin = card.querySelector('.combo-action.finalize');
    if (fin) fin.addEventListener('click', () => finalizeCombo(id));
  });
}

function renderComboCard(c, idx, dims, isInternal) {
  const calc = dims ? calcCombo(c, dims.L, dims.W) : null;
  const title = comboTitle(c);

  const toggleRow = (axis, opts) =>
    opts.map(o => {
      const val = o.val;
      const isOn = c[axis] === val;
      const disabled = (axis === 'carve' && val === true && c.height === 1);
      return '<span class="toggle-pill ' + (isOn ? 'on' : '') + ' ' + (disabled ? 'disabled' : '') + '"' +
             ' data-axis="' + axis + '" data-val="' + val + '">' + o.label + '</span>';
    }).join('');

  let breakdown = '';
  if (calc) {
    const woodRate = c.wood === 'Khair' ? CONFIG.RATES.khairPerCuft : CONFIG.RATES.teakPerCuft;
    const items = [];
    items.push(
      '<div class="bd-row">' +
        '<div class="bd-name">' + c.wood + ' wood' +
          '<span class="bd-calc">' + calc.volCuft.toFixed(3) + ' cuft × ' + fmt(woodRate) + '/cuft</span>' +
        '</div>' +
        '<div class="bd-amt">' + fmt(calc.wood) + '</div>' +
      '</div>'
    );
    if (c.carve) {
      items.push(
        '<div class="bd-row">' +
          '<div class="bd-name">CNC carving' +
            '<span class="bd-calc">' + calc.sqIn + ' sq in × ' + fmt(CONFIG.RATES.cncPerSqIn) + '/sq in</span>' +
          '</div>' +
          '<div class="bd-amt">' + fmt(calc.cnc) + '</div>' +
        '</div>'
      );
    }
    if (c.polish) {
      const polishRaw = calc.surface * CONFIG.RATES.polishPerSqIn;
      const minApplied = polishRaw < CONFIG.RATES.polishMin;
      items.push(
        '<div class="bd-row">' +
          '<div class="bd-name">Polish' +
            '<span class="bd-calc">' + calc.surface + ' sq in surface × ' + fmt(CONFIG.RATES.polishPerSqIn) + '/sq in' +
            (minApplied ? ' (min ' + fmt(CONFIG.RATES.polishMin) + ')' : '') + '</span>' +
          '</div>' +
          '<div class="bd-amt">' + fmt(calc.polish) + '</div>' +
        '</div>'
      );
    }
    items.push(
      '<div class="bd-row bd-total">' +
        '<div class="bd-name">Total</div>' +
        '<div class="bd-amt">' + fmt(calc.subtotal) + '</div>' +
      '</div>'
    );
    breakdown = '<div class="combo-breakdown">' + items.join('') + '</div>';
  }

  return '<div class="combo-card" data-id="' + c.id + '">' +
    '<div class="combo-head">' +
      '<div>' +
        '<div class="combo-num">Combination #' + (idx + 1) + '</div>' +
        '<div class="combo-title">' + escapeHtml(title) + '</div>' +
      '</div>' +
      '<div class="combo-price">' + (calc ? fmt(calc.subtotal) : '—') + '</div>' +
    '</div>' +
    '<div class="combo-toggles">' +
      toggleRow('wood', [{val:'Khair',label:'Khair'},{val:'Teak',label:'Teak'}]) +
      toggleRow('height', [{val:1,label:'1"'},{val:1.5,label:'1½"'}]) +
      toggleRow('carve', [{val:false,label:'Plain'},{val:true,label:'Carved'}]) +
      toggleRow('polish', [{val:false,label:'No Polish'},{val:true,label:'Polished'}]) +
    '</div>' +
    breakdown +
    '<div class="combo-actions">' +
      '<button class="combo-action finalize">★ Finalize this</button>' +
      '<button class="combo-action delete">✕ Remove</button>' +
    '</div>' +
  '</div>';
}

function toggleComboField(id, axis, val) {
  const combo = state.combos.find(c => c.id === id);
  if (!combo) return;
  if (axis === 'height' && val === 1 && combo.carve === true) {
    combo.carve = false;
    toast('1" can\'t be CNC carved — switched to Plain');
  }
  combo[axis] = val;
  renderList();
}

function deleteCombo(id) {
  const idx = state.combos.findIndex(c => c.id === id);
  if (idx === -1) return;
  state.combos.splice(idx, 1);
  renderList();
}
