/**
 * PinTrade V2.4 - News API Service
 * Handles fetching crypto news from CryptoCompare and translating to Turkish.
 *
 * News sekmesi (dp-news-tab) tek bir yerde iki haber kaynağını birleştirir:
 *   snipe AÇIK  → sadece seçili coinin haberleri (fetchCoinNews)
 *   snipe KAPALI → genel piyasa haberleri (fetchGeneralNews)
 * Kontroller (snipe + sırala) sekme çubuğundaki #news-tabbar-controls'a
 * yazılıyor — aynı desen bot-signals-panel.js'in SE/arama/snipe/sırala
 * kontrolleri için kullandığı desenle birebir aynı.
 *
 * Not: Eskiden ayrı bir "Global News" paneli (sağ sidebar'da, Alarm'ın
 * altında) vardı — kaldırıldı, aynı işlev artık burada (snipe kapalı hali).
 */

const NewsAPI = {
  _snipe: true,        // true: coin bazlı (varsayılan) | false: genel piyasa haberleri
  _sortOrder: 'desc',  // 'desc' = yeni üstte | 'asc' = eski üstte
  _lastNewsData: [],   // sıralama toggle'ında API'ye tekrar gitmemek için ham veri önbelleği
  _activeSymbol: null,
  _loadedOnce: false,  // News sekmesine hiç girilmediyse veri çekmiyoruz (gereksiz istek atmasın)

  init() {
    this._activeSymbol = (window.State?.get('activeSymbol') || 'BTCUSDT').replace(/USDT$/, '');

    if (window.EventBus) {
      // NOT: önceki sürüm 'symbol:changed' dinliyordu — projede hiçbir yerde
      // bu isimde bir olay yayınlanmıyor (her yerde 'symbol:change' kullanılıyor),
      // yani coin değiştiğinde haberler HİÇBİR ZAMAN güncellenmiyordu. Düzeltildi.
      window.EventBus.on('symbol:change', ({ symbol }) => {
        if (!symbol) return;
        this._activeSymbol = symbol.replace(/USDT$/, '');
        if (this._snipe && this._loadedOnce) this._refetch();
      });
    }
  },

  /** detail-panel.js, kullanıcı News sekmesine her tıkladığında çağırır. */
  onTabActivated() {
    this._renderControls();
    if (!this._loadedOnce) {
      this._loadedOnce = true;
      this._refetch();
    }
  },

  /* ── Sekme çubuğu kontrolleri: snipe + sırala ─────────── */
  _buildControlsHTML() {
    const snipeTitle = this._snipe
      ? 'Snipe: showing selected coin\'s news — click to show general news'
      : 'Snipe: showing general news — click to lock to selected coin';
    const sortArrow = this._sortOrder === 'desc' ? '↑' : '↓';
    const sortTitle = this._sortOrder === 'desc' ? 'Newest first' : 'Oldest first';
    return `
      <button class="bsp-icon-btn bsp-snipe-btn${this._snipe ? ' active' : ''}" id="news-snipe-btn" title="${snipeTitle}">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.2"/><path d="M8 1v2.4M8 12.6V15M1 8h2.4M12.6 8H15" stroke-linecap="round"/></svg>
      </button>
      <button class="bsp-sort-btn" id="news-sort-btn" title="${sortTitle}">${sortArrow}</button>`;
  },

  _renderControls() {
    const el = document.getElementById('news-tabbar-controls');
    if (!el) return;
    el.innerHTML = this._buildControlsHTML();
    el.querySelector('#news-snipe-btn')?.addEventListener('click', () => {
      this._snipe = !this._snipe;
      this._renderControls();
      this._refetch();
    });
    el.querySelector('#news-sort-btn')?.addEventListener('click', () => {
      this._sortOrder = this._sortOrder === 'desc' ? 'asc' : 'desc';
      this._renderControls();
      this.renderNews('dp-news-tab', [...this._lastNewsData].reverse(), this._emptyMsg());
      this._lastNewsData.reverse(); // önbellek de aynı sırada kalsın
    });
  },

  _emptyMsg() {
    return this._snipe
      ? `${this._activeSymbol || 'Coin'} için haber bulunamadı.`
      : 'Bu kategoride haber bulunamadı.';
  },

  _refetch() {
    if (this._snipe) this.fetchCoinNews(this._activeSymbol);
    else this.fetchGeneralNews();
  },

  async fetchCryptoCompare(categories = '') {
    try {
      const url = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN${categories ? '&categories=' + categories : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && Array.isArray(json.Data)) {
        return json.Data;
      }
      return [];
    } catch (e) {
      console.error('Haberler alınamadı:', e);
      return [];
    }
  },

  async translateText(text) {
    try {
      // Using unofficial public translate API (limitli kullanım için, demo amaçlı)
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(text)}`);
      const json = await res.json();
      return json[0].map(item => item[0]).join('');
    } catch (e) {
      console.warn('Çeviri başarısız:', e);
      return ''; // fallback to empty
    }
  },

  getTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - timestamp * 1000) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " yıl önce";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " ay önce";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gün önce";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " s. önce";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " dk. önce";
    return Math.floor(seconds) + " sn. önce";
  },

  renderNews(containerId, newsData, emptyMsg = "Bu kategoride haber bulunamadı.") {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!newsData || !Array.isArray(newsData) || newsData.length === 0) {
      container.innerHTML = `<div class="gnp-loading">${emptyMsg}</div>`;
      return;
    }

    // Limit to 15 news items so we don't spam translation API
    const items = newsData.slice(0, 15);

    items.forEach(news => {
      const card = document.createElement('div');
      card.className = 'news-card';

      const sourceName = news.source_info?.name || news.source;
      const timeAgo = this.getTimeAgo(news.published_on);
      const cleanTitleEN = news.title.trim();

      card.innerHTML = `
        <div class="news-meta">
          <span class="news-source">${sourceName}</span>
          <span class="news-time">${timeAgo}</span>
        </div>
        <div class="news-title-en">${cleanTitleEN}</div>
        <div class="news-title-tr" style="opacity: 0.6;">Çeviriliyor...</div>
      `;

      card.addEventListener('click', () => {
        window.open(news.url, '_blank');
      });

      container.appendChild(card);

      // Async Translation
      this.translateText(cleanTitleEN).then(translated => {
        const trEl = card.querySelector('.news-title-tr');
        if (translated) {
          trEl.textContent = translated;
          trEl.style.opacity = '1';
        } else {
          trEl.style.display = 'none';
        }
      });
    });
  },

  /** Snipe KAPALI — genel piyasa haberleri (eski "Global News" panelinin yerini alıyor). */
  async fetchGeneralNews() {
    const container = document.getElementById('dp-news-tab');
    if (container) container.innerHTML = `<div class="gnp-loading">Haberler yükleniyor...</div>`;

    const data = await this.fetchCryptoCompare('Market,Trading,Blockchain');
    this._lastNewsData = this._sortOrder === 'desc' ? data : [...data].reverse();
    this.renderNews('dp-news-tab', this._lastNewsData, this._emptyMsg());
  },

  /** Snipe AÇIK — sadece seçili coinin haberleri. */
  async fetchCoinNews(symbol) {
    let baseAsset = symbol;
    if (symbol && symbol.endsWith('USDT')) {
      baseAsset = symbol.replace('USDT', '');
    }
    this._activeSymbol = baseAsset;

    const container = document.getElementById('dp-news-tab');
    if (container) container.innerHTML = `<div class="gnp-loading">${baseAsset || 'Coin'} haberleri aranıyor...</div>`;

    if (!baseAsset) {
      this._lastNewsData = [];
      this.renderNews('dp-news-tab', [], "Coin seçilmedi.");
      return;
    }

    const data = await this.fetchCryptoCompare(baseAsset);
    this._lastNewsData = this._sortOrder === 'desc' ? data : [...data].reverse();
    this.renderNews('dp-news-tab', this._lastNewsData, this._emptyMsg());
  }
};

// Expose and bind onload
window.NewsAPI = NewsAPI;
document.addEventListener('DOMContentLoaded', () => {
  // Let app.js fully initialize before binding NewsAPI events
  setTimeout(() => NewsAPI.init(), 1000);
});
