/**
 * PinTrade V2.4 - News API Service
 * Handles fetching crypto news from CryptoCompare and translating to Turkish.
 */

const NewsAPI = {
  activeGlobalTab: 'global', // 'global' | 'exchange'
  activeCoinData: null,

  init() {
    this.bindEvents();
    // Fetch initial global news
    this.fetchGlobalNews();
    
    // Subscribe to active coin changes to update Coin News in detail panel
    if (window.EventBus) {
      window.EventBus.on('symbol:changed', (data) => {
        this.activeCoinData = data;
        this.fetchCoinNews(data.symbol);
      });
    }
  },

  bindEvents() {
    // Global Panel Tabs
    const gnpTabs = document.querySelectorAll('.gnp-tab');
    gnpTabs.forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        gnpTabs.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const tabName = e.currentTarget.getAttribute('data-gnp-tab');
        this.activeGlobalTab = tabName;
        
        document.querySelectorAll('.gnp-content').forEach(c => c.style.display = 'none');
        document.getElementById(`gnp-${tabName}`).style.display = 'flex';
        
        // Fetch if empty
        const contentDiv = document.getElementById(`gnp-${tabName}`);
        if (contentDiv.children.length === 1 && contentDiv.children[0].classList.contains('gnp-loading')) {
          if (tabName === 'global') this.fetchGlobalNews();
          else if (tabName === 'exchange') this.fetchExchangeNews();
        }
      });
    });

    // When the right sidebar toggles 'rsb-news', ensure we load data if it hasn't been loaded.
    if (window.EventBus) {
      window.EventBus.on('watchlist:toggle', ({ open, tab }) => {
        if (open && tab === 'rsb-news') {
          // Check if current tab is empty
          const contentDiv = document.getElementById(`gnp-${this.activeGlobalTab}`);
          if (contentDiv && contentDiv.children.length === 1 && contentDiv.children[0].classList.contains('gnp-loading')) {
            if (this.activeGlobalTab === 'global') this.fetchGlobalNews();
            else this.fetchExchangeNews();
          }
        }
      });
    }
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
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:11px;">${emptyMsg}</div>`;
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

  async fetchGlobalNews() {
    const data = await this.fetchCryptoCompare('Market,Trading,Blockchain');
    this.renderNews('gnp-global', data);
  },

  async fetchExchangeNews() {
    const data = await this.fetchCryptoCompare('Exchange');
    this.renderNews('gnp-exchange', data);
  },

  async fetchCoinNews(symbol) {
    // If no symbol is provided or active, try to fetch empty msg
    // Ensure we parse something like BTCUSDT to BTC
    let baseAsset = symbol;
    if (symbol && symbol.endsWith('USDT')) {
      baseAsset = symbol.replace('USDT', '');
    }
    
    // Select dp-news-tab
    const container = document.getElementById('dp-news-tab');
    if (container) container.innerHTML = `<div class="gnp-loading">${baseAsset || 'Coin'} haberleri aranıyor...</div>`;
    
    if (!baseAsset) {
      this.renderNews('dp-news-tab', [], "Coin seçilmedi.");
      return;
    }

    const data = await this.fetchCryptoCompare(baseAsset);
    this.renderNews('dp-news-tab', data, `${baseAsset} için haber bulunamadı.`);
  }
};

// Expose and bind onload
window.NewsAPI = NewsAPI;
document.addEventListener('DOMContentLoaded', () => {
  // Let app.js fully initialize before binding NewsAPI events
  setTimeout(() => NewsAPI.init(), 1000);
});
