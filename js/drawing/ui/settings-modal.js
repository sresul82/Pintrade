const SettingsModal = (function() {
  let _activeDrawingId = null;
  let _activeSymbol = null;
  
  function init() {
     const _el = document.getElementById('drawing-settings-modal');
     if (!_el) return;
     
     // Tab switching
     const tabs = _el.querySelectorAll('.dsm-tab');
     const contents = _el.querySelectorAll('.dsm-tab-content');
     
     tabs.forEach(tab => {
       tab.addEventListener('click', () => {
         tabs.forEach(t => t.classList.remove('active'));
         contents.forEach(c => c.classList.remove('active'));
         
         tab.classList.add('active');
         const targetId = tab.getAttribute('data-target');
         const target = document.getElementById(targetId);
         if (target) target.classList.add('active');
       });
     });
     
     // Close buttons
     _el.querySelector('.dsm-close').addEventListener('click', hide);
     _el.querySelector('#dsm-cancel').addEventListener('click', hide);
     
     // Save button
     _el.querySelector('#dsm-ok').addEventListener('click', () => {
        saveSettings();
        hide();
     });
     
     // Simple drag implementation for modal header
     let isDragging = false;
     let startX, startY, initialLeft, initialTop;
     const header = _el.querySelector('.dsm-header');
     
     header.addEventListener('mousedown', (e) => {
       isDragging = true;
       startX = e.clientX;
       startY = e.clientY;
       
       const rect = _el.getBoundingClientRect();
       initialLeft = rect.left;
       initialTop = rect.top;
       
       // Change from translate(-50%, -50%) to absolute fixed coords so drag works smoothly
       _el.style.transform = 'none';
       _el.style.left = `${initialLeft}px`;
       _el.style.top = `${initialTop}px`;
     });
     
     document.addEventListener('mousemove', (e) => {
       if (!isDragging) return;
       const dx = e.clientX - startX;
       const dy = e.clientY - startY;
       _el.style.left = `${initialLeft + dx}px`;
       _el.style.top = `${initialTop + dy}px`;
     });
     
     document.addEventListener('mouseup', () => {
       isDragging = false;
     });
  }

  function show(symbol, id) {
     const _el = document.getElementById('drawing-settings-modal');
     if (!_el) return;
     
     _activeSymbol = symbol;
     _activeDrawingId = id;
     
     const drawings = State.getDrawings(symbol);
     const drawing = drawings.find(d => d.id === id);
     if (drawing) {
        // Populate inputs
        if (drawing.points && drawing.points[0]) {
           document.getElementById('dsm-p1-price').value = parseFloat(drawing.points[0].price).toFixed(6);
        }
        if (drawing.points && drawing.points[1]) {
           document.getElementById('dsm-p2-price').value = parseFloat(drawing.points[1].price).toFixed(6);
        }
        
        // Add color if setting color exists (we use fallback for now)
        document.getElementById('dsm-color-btn').style.backgroundColor = drawing.style?.color || '#0969da';
        
        // Text properties
        document.getElementById('dsm-text-input').value = drawing.text || '';
        document.getElementById('dsm-show-text').checked = !!drawing.showText;
     }
     
     _el.classList.add('active');
  }

  function hide() {
     const _el = document.getElementById('drawing-settings-modal');
     if (_el) _el.classList.remove('active');
     _activeDrawingId = null;
     _activeSymbol = null;
  }

  function saveSettings() {
     if (!_activeDrawingId || !_activeSymbol) return;
     
     const drawings = State.getDrawings(_activeSymbol);
     const drawing = drawings.find(d => d.id === _activeDrawingId);
     if (drawing) {
        if (drawing.points && drawing.points[0]) {
           const p1 = document.getElementById('dsm-p1-price').value;
           if(p1) drawing.points[0].price = parseFloat(p1);
        }
        if (drawing.points && drawing.points[1]) {
           const p2 = document.getElementById('dsm-p2-price').value;
           if(p2) drawing.points[1].price = parseFloat(p2);
        }
        
        // Save text
        drawing.text = document.getElementById('dsm-text-input').value;
        drawing.showText = document.getElementById('dsm-show-text').checked;
        // Save
        State.save();
        
        // Emitting deleted as a generic redraw trigger which we can wire up in drawing core
        EventBus.emit('drawing:settings:saved', { id: _activeDrawingId });
     }
  }

  return { init, show, hide };
})();

// Initialize safely
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', SettingsModal.init);
} else {
  SettingsModal.init();
}
