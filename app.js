// app.js — initializes chart, simulates live candles and infinite masked emails
document.addEventListener('DOMContentLoaded', function(){
  const chartContainer = document.getElementById('chart');
  const emailListEl = document.getElementById('email-list');
  const toastsEl = document.getElementById('toasts');
  const mirrorBtn = document.getElementById('mirror-btn');
  const pauseBtn = document.getElementById('pause-btn');

  // Initialize chart
  const chart = LightweightCharts.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    layout: {
      backgroundColor: '#000000',
      textColor: '#e6eef6',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.03)' },
      horzLines: { color: 'rgba(255,255,255,0.03)' },
    },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.03)' },
    timeScale: { borderColor: 'rgba(255,255,255,0.03)', timeVisible:true, secondsVisible:false },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    localization: { priceFormatter: price => price.toFixed(5) },
  });

  const candleSeries = chart.addCandlestickSeries({
    upColor: '#16a34a',
    downColor: '#ef4444',
    borderVisible: true,
    wickUpColor: '#16a34a',
    wickDownColor: '#ef4444',
    borderColor: '#ffffff10',
  });

  // Generate initial historical bars (random walk)
  function generateInitialBars(count=240, start=1.07500){
    const bars = [];
    let t = Math.floor(Date.now()/1000) - count*60;
    let price = start;
    for(let i=0;i<count;i++){
      const open = price;
      const change = (Math.random()-0.5) * 0.0020;
      const close = Math.max(0.5, open + change);
      const high = Math.max(open, close) + Math.random()*0.0008;
      const low = Math.min(open, close) - Math.random()*0.0008;
      bars.push({
        time: t,
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
      });
      t += 60;
      price = close;
    }
    return bars;
  }

  const initial = generateInitialBars();
  candleSeries.setData(initial);
  let lastBar = initial[initial.length - 1];

  // Markers
  let markers = [];
  function addMarker(time, side, label){
    const marker = {
      time,
      position: side === 'buy' ? 'belowBar' : 'aboveBar',
      color: side === 'buy' ? '#16a34a' : '#ef4444',
      shape: side === 'buy' ? 'arrowUp' : 'arrowDown',
      text: label || (side === 'buy' ? 'BUY' : 'SELL'),
    };
    markers.push(marker);
    candleSeries.setMarkers(markers);
  }

  // Toasts
  function pushToast(title, body, short=false){
    const t = document.createElement('div');
    t.className = 'toast' + (short ? ' small' : '');
    t.innerHTML = `<div class="type">${title}</div><div style="opacity:0.92;margin-top:6px;font-weight:500">${body}</div>`;
    toastsEl.insertBefore(t, toastsEl.firstChild);
    // Auto-remove
    setTimeout(()=> {
      t.style.opacity='0';
      t.style.transform='translateY(-6px)';
      setTimeout(()=> t.remove(), 380);
    }, 6000);
  }

  // Masked email generator
  const firstNames = ['jack','emma','liam','sophia','noah','olivia','mason','mia','ethan','ava','lucas','isla','leo','chloe','omar','amy','shelly','ryan','ade','nina'];
  function maskEmail(user){
    if(user.length <= 4) return user.slice(0,1) + '****';
    if(user.length <= 7) return user.slice(0,2) + '****' + user.slice(-1);
    return user.slice(0,4) + '****' + user.slice(-1);
  }
  function generateMaskedEmail(){
    const name = firstNames[Math.floor(Math.random()*firstNames.length)];
    const num = Math.random() > 0.6 ? String(Math.floor(Math.random()*99)) : '';
    const raw = `${name}${num}@proton.me`;
    const atIdx = raw.indexOf('@');
    const user = raw.slice(0, atIdx);
    const domain = raw.slice(atIdx+1);
    return `${maskEmail(user)}@${domain}`;
  }

  // Push email items
  function pushEmailItem(text, meta){
    const li = document.createElement('div');
    li.className = 'email-item';
    li.innerHTML = `<div class="left"><span class="dot" aria-hidden="true"></span><div><div class="address">${text}</div><div class="meta">${meta}</div></div></div><div style="font-size:12px;color:var(--muted)">${new Date().toLocaleTimeString()}</div>`;
    emailListEl.insertBefore(li, emailListEl.firstChild);
    // Limit size for memory
    const children = emailListEl.children;
    if(children.length > 120){
      // remove the oldest ones
      for(let i=120;i<children.length;i++){
        children[children.length-1].remove();
      }
    }
  }

  // Possibly emit a trade for a candle
  function maybeEmitTrade(bar){
    const r = Math.random();
    if(r < 0.18){
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const price = (bar.close).toFixed(5);
      addMarker(bar.time, side, `${side.toUpperCase()} ${price}`);
      pushToast(`${side.toUpperCase()} executed`, `Price ${price} • Mirrored to subscribers`);
      pushEmailItem(generateMaskedEmail(), `mirrored ${side} @ ${price}`);
    }
  }

  // Live feed: ticks + candle finalization
  let paused = false;
  let running = true;
  function startLiveFeed(){
    let currentBar = {...lastBar};
    let nextTime = lastBar.time + 60;

    const tickInterval = 600;     // ms between tick updates on current candle
    const candleInterval = 3000;  // ms per candle (fast demo)

    const tickTimer = setInterval(()=>{
      if(!running || paused) return;
      const delta = (Math.random()-0.5) * 0.0006;
      const newPrice = Math.max(0.5, currentBar.close + delta);
      currentBar = {
        time: nextTime,
        open: currentBar.open ?? lastBar.close,
        high: Math.max(currentBar.high ?? newPrice, newPrice),
        low: Math.min(currentBar.low ?? newPrice, newPrice),
        close: parseFloat(newPrice.toFixed(5)),
      };
      candleSeries.update(currentBar);
    }, tickInterval);

    const candleTimer = setInterval(()=>{
      if(!running || paused) return;
      const finalized = {...currentBar};
      candleSeries.update(finalized);
      maybeEmitTrade(finalized);
      lastBar = finalized;
      nextTime = lastBar.time + 60;
      currentBar = { time: nextTime, open: lastBar.close, high: lastBar.close, low: lastBar.close, close: lastBar.close };

      // chatter emails even without trade
      if(Math.random() < 0.72) pushEmailItem(generateMaskedEmail(), 'mirrored activity');
    }, candleInterval);

    return { tickTimer, candleTimer };
  }

  let timers = startLiveFeed();

  // Mirror button shows "Top up" notification
  mirrorBtn.addEventListener('click', ()=> {
    pushToast('Top up now to mirror this trades', 'Open the top-up/payment gateway to enable mirroring (demo).', true);
  });

  // Pause/resume
  pauseBtn.addEventListener('click', ()=>{
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pushToast(paused ? 'Feed paused' : 'Feed resumed', paused ? 'Live updates paused' : 'Live updates resumed', true);
  });

  // Seed a few initial emails immediately
  for(let i=0;i<8;i++) pushEmailItem(generateMaskedEmail(), 'initial');

  pushToast('Simulation running', 'This is a simulated live Forex feed (no real money).');

  // Resize handler for chart
  const ro = new ResizeObserver(()=> {
    chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
  });
  ro.observe(chartContainer);

  // Clean up on unload
  window.addEventListener('beforeunload', ()=>{
    running = false;
    try { clearInterval(timers.tickTimer); clearInterval(timers.candleTimer); } catch(e){}
  });

  // Debug helpers (console)
  window._fx_demo = {
    pushEmail: (t,m)=> pushEmailItem(t,m),
    pushToast,
    pause: ()=> { paused = true; pauseBtn.textContent = 'Resume'; },
    resume: ()=> { paused = false; pauseBtn.textContent = 'Pause'; },
  };
});
