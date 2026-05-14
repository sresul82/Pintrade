/**
 * DSD Position Tabs
 * Long/Short Position aracları icin sekme render fonksiyonları
 */
window.DSDPositionTabs = (() => {

  function renderPositionInputsTab(d) {
    const s = d.style || {};
    const accSize   = s.accSize   !== undefined ? s.accSize   : 10000;
    const risk      = s.risk      !== undefined ? s.risk      : 1;
    const riskType  = s.riskType  || '%';
    const extP      = d.p1  ? d.p1.price  : 0;
    const targetP   = d.p2  ? d.p2.price  : 0;
    const stopP     = d.p3  ? d.p3.price  : 0;
    const ticksTgt  = Math.round(Math.abs(targetP - extP) * 1000);
    const ticksStop = Math.round(Math.abs(extP - stopP)   * 1000);
    const leverage  = s.leverage  !== undefined ? s.leverage  : 1;
    const qtyPrec   = s.qtyPrec   || 'Default';

    // Row helper — label left, control right
    const row = (label, controlHtml, labelColor = '') => `
      <div class="dsd-pi-row">
        <span class="dsd-pi-label" ${labelColor ? `style="color:${labelColor}"` : ''}>${label}</span>
        <div class="dsd-pi-ctrl">${controlHtml}</div>
      </div>`;

    const inp = (id, val, w = 100, extra = '') =>
      `<input type="number" id="${id}" class="dsd-pi-input" value="${val}" ${extra} style="width:${w}px">`;

    const sel = (id, opts, cur, w = 90) =>
      `<select id="${id}" class="dsd-pi-select" style="width:${w}px">${opts.map(o =>
        `<option value="${o}" ${o===cur?'selected':''}>${o}</option>`).join('')}</select>`;

    return `
      <div class="dsd-pi-wrap">

        ${row('Account size',
          `${inp('dsd-pos-accSize', accSize, 140)}
          ${sel('dsd-pos-accCur', ['Default','USD','EUR','BTC','ETH'], s.accCur||'Default', 90)}`
        )}

        ${row('Lot size',
          inp('dsd-pos-lotSize', s.lotSize||1, 140)
        )}

        ${row('Risk',
          `${inp('dsd-pos-risk', risk, 90)}
          ${sel('dsd-pos-riskType', ['%','USD','BTC'], riskType, 60)}`
        )}

        ${row('Entry price',
          inp('dsd-pos-entry', extP.toFixed(5), 140)
        )}

        ${row('Leverage',
          inp('dsd-pos-leverage', leverage, 140)
        )}

        <div class="dsd-pi-section">PROFIT LEVEL</div>

        ${row('Ticks',
          `<input type="number" id="dsd-pos-profit-ticks" class="dsd-pi-input" value="${ticksTgt}" style="width:140px" placeholder="Ticks">`
        )}

        ${row('Price',
          `<input type="number" id="dsd-pos-target" class="dsd-pi-input" value="${targetP.toFixed(5)}" style="width:140px">`
        )}

        <div class="dsd-pi-section">STOP LEVEL</div>

        ${row('Ticks',
          `<input type="number" id="dsd-pos-stop-ticks" class="dsd-pi-input" value="${ticksStop}" style="width:140px" placeholder="Ticks">`
        )}

        ${row('Price',
          `<input type="number" id="dsd-pos-stop" class="dsd-pi-input" value="${stopP.toFixed(5)}" style="width:140px">`
        )}

        <div class="dsd-pi-divider"></div>

        ${row('QTY precision',
          sel('dsd-pos-qtyPrec', ['Default','0','1','2','3','4','5'], qtyPrec, 140)
        )}
      </div>
    `;
  }


  function renderPositionStyleTab(d) {
    const s = d.style || {};
    const color    = s.color    || '#2962ff';
    const fillTrg  = s.targetColor || 'rgba(8,153,129,0.2)';
    const fillStp  = s.stopColor   || 'rgba(242,54,69,0.2)';
    const textColor = s.textColor  || '#ffffff';
    const compactStats    = s.compactStats    === true;
    const alwaysShowStats = s.alwaysShowStats !== false;

    // Stats items — same order as TradingView
    const STAT_ITEMS = [
      { key: 'tpPriceOffset',   label: 'TP price offset'   },
      { key: 'tpPercentOffset', label: 'TP percent offset'  },
      { key: 'tpTickOffset',    label: 'TP tick offset'     },
      { key: 'tpAmount',        label: 'TP amount'          },
      { key: 'tpPL',            label: 'TP PL'              },
      { key: 'openClosedPL',    label: 'Open/closed PL'     },
      { key: 'qty',             label: 'Qty'                },
      { key: 'rrRatio',         label: 'Risk/reward ratio'  },
      { key: 'slPriceOffset',   label: 'SL price offset'    },
      { key: 'slPercentOffset', label: 'SL percent offset'  },
      { key: 'slTickOffset',    label: 'SL tick offset'     },
      { key: 'slAmount',        label: 'SL amount'          },
      { key: 'slPL',            label: 'SL PL'              },
    ];

    // Default checked stats (matches TradingView defaults)
    const DEFAULT_ON = new Set([
      'tpPriceOffset','tpPercentOffset','tpTickOffset','tpAmount',
      'openClosedPL','qty','rrRatio',
      'slPriceOffset','slPercentOffset','slTickOffset','slAmount'
    ]);
    const stats = s.stats || {};

    // Build summary label for the dropdown button
    const activeLabels = STAT_ITEMS
      .filter(it => stats[it.key] !== undefined ? stats[it.key] : DEFAULT_ON.has(it.key))
      .map(it => it.label);
    const summaryText = activeLabels.length === 0 ? 'None'
      : activeLabels.length <= 2 ? activeLabels.join(', ')
      : activeLabels.slice(0,2).join(', ') + ', …';

    const statsItemsHtml = STAT_ITEMS.map(it => {
      const checked = stats[it.key] !== undefined ? stats[it.key] : DEFAULT_ON.has(it.key);
      return `
        <label class="dsd-stats-item">
          <input type="checkbox" class="dsd-stats-cb" data-key="${it.key}" ${checked ? 'checked' : ''}>
          <span>${it.label}</span>
        </label>`;
    }).join('');

    return `
      <div class="dsd-section-label">Style</div>

      <div class="dsd-row" style="margin-bottom:12px;">
        <label class="dsd-label" style="width:120px;">Lines</label>
        <div class="dsd-color-swatch js-pos-color" style="background:${color}" data-color="${color}"></div>
        <select class="dsd-select" id="dsd-pos-width" style="width:60px; margin-left:8px;">
          ${[1,2,3,4].map(w => `<option value="${w}" ${s.width==w?'selected':''}>${w}px</option>`).join('')}
        </select>
      </div>
      <div class="dsd-row" style="margin-bottom:12px; align-items:center;">
        <label class="dsd-label" style="width:120px;">Stop color</label>
        <div class="dsd-color-swatch js-pos-stop" style="background:${fillStp}" data-color="${fillStp}"></div>
      </div>
      <div class="dsd-row" style="margin-bottom:12px; align-items:center;">
        <label class="dsd-label" style="width:120px;">Target color</label>
        <div class="dsd-color-swatch js-pos-target" style="background:${fillTrg}" data-color="${fillTrg}"></div>
      </div>
      <div class="dsd-row" style="margin-bottom:12px; align-items:center;">
        <label class="dsd-label" style="width:120px;">Text</label>
        <div class="dsd-color-swatch js-pos-text" style="background:${textColor}" data-color="${textColor}"></div>
        <select class="dsd-select" id="dsd-pos-fontsize" style="width:60px; margin-left:8px;">
          ${[10,11,12,14,16,20,24].map(sz => `<option value="${sz}" ${s.fontSize==sz?'selected':''}>${sz}</option>`).join('')}
        </select>
      </div>

      <div class="dsd-section-label" style="margin-top:16px;">Info</div>

      <!-- Stats multi-select dropdown -->
      <div class="dsd-row" style="margin-bottom:10px; align-items:flex-start;">
        <label class="dsd-label" style="width:120px; padding-top:6px;">Stats</label>
        <div class="dsd-stats-dropdown" id="dsd-stats-dd" style="flex:1; position:relative;">
          <div class="dsd-stats-header" id="dsd-stats-header">
            <span id="dsd-stats-summary" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${summaryText}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" style="flex-shrink:0;opacity:0.7">
              <polyline points="2,4 6,8 10,4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="dsd-stats-body hidden" id="dsd-stats-body">
            ${statsItemsHtml}
          </div>
        </div>
      </div>

      <div class="dsd-row" style="margin-bottom:8px;">
         <label class="dsd-checkbox-label">
           <input type="checkbox" id="dsd-pos-compact" ${compactStats ? 'checked' : ''}> Compact stats
         </label>
      </div>
      <div class="dsd-row" style="margin-bottom:8px;">
         <label class="dsd-checkbox-label">
           <input type="checkbox" id="dsd-pos-always" ${alwaysShowStats ? 'checked' : ''}> Always show
         </label>
      </div>
    `;
  }


  return {
    renderPositionInputsTab,
    renderPositionStyleTab
  };
})();
