/* ──────────────────────────────────────────────────────────
   search-core.js  —  Akıllı Sembol Arama ve Dropdown
   Global: SearchCore
   Bağımlılıklar: BinanceAPI, BybitAPI, EventBus, State
────────────────────────────────────────────────────────── */
const SearchCore = (() => {

  let _symbols = {
    binance: [],
    bybit: []
  };
  let _currentExchange = 'binance';
  let _activeIndex = -1;
  let _results = []; // Su anki filtrelenmis sonuclar

  // DOM Elements
  let _container, _inputWrapper, _input, _menu, _excBtn, _excMenu;

  async function _loadSymbols() {
    try {
      // Paralel olarak her iki borsadan da sembolleri cek (arkaplanda cacheleriz)
      const [binanceSyms, bybitSyms] = await Promise.all([
        BinanceAPI.fetchSymbols(),
        typeof BybitAPI !== 'undefined' ? BybitAPI.fetchSymbols() : Promise.resolve([])
      ]);
      _symbols.binance = binanceSyms || [];
      _symbols.bybit = bybitSyms || [];
      console.log(`[SearchCore] Loaded ${binanceSyms.length} Binance, ${bybitSyms.length} Bybit symbols.`);
    } catch (e) {
      console.error('[SearchCore] Symbol load error:', e);
    }
  }

  function _renderExchangeIndicator() {
    if (!_excBtn) return;
    _excBtn.textContent = _currentExchange === 'binance' ? 'BN' : 'BY';
    _excBtn.title = _currentExchange === 'binance' ? 'Binance (Değiştir)' : 'Bybit (Değiştir)';
    
    // Update active state in menu
    document.querySelectorAll('.nb-search-exc-item').forEach(el => {
      el.classList.toggle('active', el.dataset.exchange === _currentExchange);
    });
  }

  function _filterSymbols(query) {
    if (!query) return [];
    query = query.toUpperCase();
    
    const list = _symbols[_currentExchange];
    if (!list || !list.length) return [];

    let exactMatches = [];
    let containsMatches = [];

    for (let i = 0; i < list.length; i++) {
      const sym = list[i];
      if (sym === query) {
        exactMatches.unshift(sym); // Exact match en basa
      } else if (sym.startsWith(query)) {
        exactMatches.push(sym);
      } else if (sym.includes(query)) {
        containsMatches.push(sym);
      }
    }

    // Toplam 50 sonuc goster
    const combined = [...exactMatches, ...containsMatches];
    return combined.slice(0, 50);
  }

  function _renderResults(query) {
    _menu.innerHTML = '';
    _results = _filterSymbols(query);
    _activeIndex = -1;

    if (_results.length === 0) {
      if (query.length > 0) {
        _menu.innerHTML = `<div class="nb-search-item" style="justify-content:center;color:var(--text-muted);cursor:default;">Sonuç bulunamadı</div>`;
        _menu.classList.add('open');
      } else {
        _menu.classList.remove('open');
      }
      return;
    }

    _results.forEach((sym, index) => {
      const item = document.createElement('div');
      item.className = 'nb-search-item';
      item.dataset.index = index;
      
      // Vurgulu metin (Highlight)
      const regex = new RegExp(`(${query})`, 'i');
      const highlightedSym = sym.replace(regex, `<span style="color:var(--accent-blue)">$1</span>`);

      item.innerHTML = `
        <span class="nb-search-item-sym">${highlightedSym}<span style="color:var(--text-secondary)">.P</span></span>
        <span class="nb-search-item-desc">USDT-M Perpetual</span>
      `;

      item.addEventListener('click', () => {
        _selectSymbol(sym);
      });

      _menu.appendChild(item);
    });

    _menu.classList.add('open');
  }

  function _updateHighlight() {
    const items = _menu.querySelectorAll('.nb-search-item');
    items.forEach(i => i.classList.remove('highlight'));
    if (_activeIndex >= 0 && _activeIndex < items.length) {
      const el = items[_activeIndex];
      el.classList.add('highlight');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function _selectSymbol(sym) {
    _input.value = sym + '.P';
    _menu.classList.remove('open');
    _input.blur();
    
    // Uygulama global durumunu guncelle -> Grafikler ve data otomatik yüklenecek
    State.setSymbol(sym, _currentExchange);
    console.log(`[SearchCore] Selected: ${sym} (${_currentExchange})`);
  }

  function init() {
    _container = document.getElementById('nb-search-container');
    _inputWrapper = document.querySelector('.nb-search-input-wrapper');
    _input = document.getElementById('nb-sym-search');
    _menu = document.getElementById('nb-search-menu');
    _excBtn = document.getElementById('nb-search-exchange');
    _excMenu = document.getElementById('nb-search-exchange-menu');

    if (!_input) return;

    // Baslangic ayarları
    _currentExchange = State.get('activeExchange') || 'binance';
    // Strip any existing .P suffix before re-adding (prevents "BTCUSDT.PUSDT.P")
    const _initSym = (State.get('activeSymbol') || 'BTCUSDT').replace(/\.P$/i, '');
    _input.value = _initSym + '.P';
    _renderExchangeIndicator();

    // Sembolleri arkaplanda yükle
    _loadSymbols();

    // Arama Input olaylari
    _input.addEventListener('input', (e) => {
      let query = e.target.value.trim().toUpperCase().replace(/\.P$/, '');
      _renderResults(query);
    });

    _input.addEventListener('focus', () => {
      // Eger input'ta yazi varsa eski sonuclari tekrar goster
      let query = _input.value.trim().toUpperCase().replace(/\.P$/, '');
      if (query.length > 0) {
        _renderResults(query);
      }
    });

    _input.addEventListener('keydown', (e) => {
      if (!_menu.classList.contains('open')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _activeIndex = Math.min(_activeIndex + 1, _results.length - 1);
        _updateHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _activeIndex = Math.max(_activeIndex - 1, -1);
        _updateHighlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_activeIndex >= 0 && _activeIndex < _results.length) {
          _selectSymbol(_results[_activeIndex]);
        } else if (_results.length > 0) {
          // Eger highlight yoksa direkt en usttekini sec
          _selectSymbol(_results[0]);
        }
      } else if (e.key === 'Escape') {
        _menu.classList.remove('open');
        _input.blur();
      }
    });

    // Exchange Toggle olaylari
    _excBtn?.addEventListener('click', (e) => {
      e.stopPropagation(); // menunun kapanmasini onler
      _excMenu.classList.toggle('open');
      _menu.classList.remove('open');
    });

    document.querySelectorAll('.nb-search-exc-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        _currentExchange = item.dataset.exchange;
        _renderExchangeIndicator();
        _excMenu.classList.remove('open');
        
        // Eger input bos degilse, sonuclari yeni borsaya gore yenile
        if (_input.value.trim().length > 0) {
          _renderResults(_input.value.trim());
        }
        _input.focus();
      });
    });

    // Sayfada baska bir yere tiklaninca menuleri kapat
    document.addEventListener('click', (e) => {
      if (_container && !_container.contains(e.target)) {
        _menu?.classList.remove('open');
        _excMenu?.classList.remove('open');
      }
    });

    // EventBus Dinleyicileri (Dışarıdan bir symbol degisirse Input'u guncelle)
    EventBus.on('symbol:change', ({ symbol, exchange }) => {
      if (symbol) {
        // Strip any existing .P suffix before re-adding to prevent double-suffix
        const cleanSym = symbol.replace(/\.P$/i, '');
        _input.value = cleanSym + '.P';
      }
      if (exchange) {
        _currentExchange = exchange;
        _renderExchangeIndicator();
      }
    });

    console.log('[SearchCore] Initialized ✓');
  }

  return { init };
})();
