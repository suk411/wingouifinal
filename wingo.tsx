import React, { useState, useEffect, useRef } from 'react';
import './wingo.css';

const API_BASE_URL = 'https://wingobackendfinal.onrender.com';

const WinGo: React.FC = () => {
  // --- STATE ---
  const [balance, setBalance] = useState<string>('0.00');
  const [timerDisplay, setTimerDisplay] = useState<{ m: string; s: string }>({ m: '0', s: '00' });
  const [gameId, setGameId] = useState<string>('202400000000');
  const [activeTab, setActiveTab] = useState<'game' | 'trend' | 'my'>('game');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [myRecordData, setMyRecordData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [nextRoundData, setNextRoundData] = useState<any>(null);
  
  // Betting Popup State
  const [showBetPopup, setShowBetPopup] = useState<boolean>(false);
  const [popupConfig, setPopupConfig] = useState<any>({ type: '', value: '', label: '', color: '' });
  const [betAmount, setBetAmount] = useState<number>(1);
  const [betQty, setBetQty] = useState<number>(1);
  const [betMul, setBetMul] = useState<number>(1);
  const [isAgreed, setIsAgreed] = useState<boolean>(true);

  // Overlays
  const [showTokenPopup, setShowTokenPopup] = useState<boolean>(false);
  const [showHowTo, setShowHowTo] = useState<boolean>(false);
  const [showPreSale, setShowPreSale] = useState<boolean>(false);
  const [isCountdownActive, setIsCountdownActive] = useState<boolean>(false);

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setShowTokenPopup(true);
    } else {
      updateUserBalance();
    }
    syncGameData();
    fetchHistoryData();
    
    // Start timer loop
    updateTimerDisplay();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // --- LOGIC FUNCTIONS ---

  const updateUserBalance = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/wingo/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401) {
        localStorage.removeItem('token');
        setShowTokenPopup(true);
        return;
      }
      const data = await response.json();
      if (data && typeof data.balance !== 'undefined') {
        setBalance(parseFloat(data.balance).toFixed(2));
      }
    } catch (error) {
      console.error("Failed to fetch user balance:", error);
    }
  };

  const syncGameData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/wingo/game-state`);
      const data = await response.json();
      if (data && data.nextRound) {
        setNextRoundData(data.nextRound);
        setGameId(data.nextRound.periodId);
        const now = Date.now();
        const diff = Math.max(0, Math.floor((data.nextRound.endTime - now) / 1000));
        setTimeRemaining(diff);
      }
    } catch (error) {
      console.error("Sync failed:", error);
    }
  };

  const updateTimerDisplay = () => {
    setTimeRemaining(prev => {
      const next = prev > 0 ? prev - 1 : 0;
      
      const m = Math.floor(next / 60);
      const s = next % 60;
      setTimerDisplay({ m: String(m), s: String(s).padStart(2, '0') });

      if (next <= 5) {
        setIsCountdownActive(true);
        if (showBetPopup) setShowBetPopup(false);
      } else {
        setIsCountdownActive(false);
      }

      if (next === 0) {
        // Round ended
        setTimeout(() => {
          syncGameData();
          fetchHistoryData();
        }, 2000);
      }

      return next;
    });

    timerRef.current = setTimeout(updateTimerDisplay, 1000);
  };

  const fetchHistoryData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/wingo/history`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setHistoryData(data.slice(0, 10));
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const fetchMyRecords = async (page: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/wingo/my-records?page=${page}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data && Array.isArray(data.records)) {
        setMyRecordData(data.records);
        setCurrentPage(data.pagination.currentPage);
      }
    } catch (error) {
      console.error("Failed to fetch my records:", error);
    }
  };

  useEffect(() => {
    if (activeTab === 'my') {
      fetchMyRecords(currentPage);
    }
  }, [activeTab, currentPage]);

  // --- BETTING POPUP LOGIC ---
  const openPopup = (type: string, value: any) => {
    if (timeRemaining <= 5) return;

    let label = '';
    let colorClass = '';

    if (type === 'color') {
      label = value;
      colorClass = `grad-${value}`;
    } else if (type === 'number') {
      label = String(value);
      colorClass = [0, 5].includes(value) ? 'grad-split' : (value % 2 === 0 ? 'grad-red' : 'grad-green');
    } else if (type === 'size') {
      label = value;
      colorClass = value === 'big' ? 'grad-big' : 'grad-small';
    }

    setPopupConfig({ type, value, label, colorClass });
    setBetAmount(1);
    setBetQty(1);
    setBetMul(1);
    setShowBetPopup(true);
  };

  const handleBetSubmit = async () => {
    if (!isAgreed) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setShowTokenPopup(true);
      return;
    }

    const totalAmount = betAmount * betQty * betMul;
    const betData = {
      type: popupConfig.type,
      value: popupConfig.value,
      amount: totalAmount,
      periodId: gameId
    };

    try {
      const response = await fetch(`${API_BASE_URL}/wingo/bet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(betData)
      });
      const res = await response.json();
      if (response.ok) {
        alert("Bet placed successfully!");
        setShowBetPopup(false);
        updateUserBalance();
      } else {
        alert(res.message || "Bet failed");
      }
    } catch (error) {
      console.error("Bet error:", error);
    }
  };

  // --- RENDER HELPERS ---
  const renderHistory = () => (
    <div className={`GameRecord__C ${activeTab === 'game' ? 'active' : ''}`}>
      <div className="GameRecord__C-head">
        <div className="van-col--8">Period</div>
        <div className="van-col--5">Number</div>
        <div className="van-col--5">Big Small</div>
        <div className="van-col--6">Color</div>
      </div>
      <div className="GameRecord__C-body">
        {historyData.map((item, idx) => (
          <div className="van-row" key={idx}>
            <div className="van-col--8">{item.periodId}</div>
            <div className={`van-col--5 GameRecord__C-body-num num-${item.color}`}>
              {item.number}
            </div>
            <div className="van-col--5">{item.number >= 5 ? 'Big' : 'Small'}</div>
            <div className="van-col--6">
              <div className="GameRecord__C-origin">
                {item.color.split('-').map((c: string, i: number) => (
                  <div key={i} className={`GameRecord__C-origin-I grad-${c}`} style={{ width: 12, height: 12, borderRadius: '50%' }}></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTrend = () => {
    // Basic Trend Implementation (Simplified for JSX)
    return (
      <div className={`Trend__C ${activeTab === 'trend' ? 'active' : ''}`}>
        <div className="Trend__C-head">
          <div className="van-col--8">Period</div>
          <div className="van-col--16">Number</div>
        </div>
        <div className="Trend__C-body2">
          {historyData.map((item, idx) => (
            <div key={idx}>
              <div className="van-row">
                <div className="van-col--8" style={{ color: '#999', fontSize: 11 }}>{item.periodId.slice(-4)}</div>
                <div className="van-col--16">
                  <div className="Trend__C-body2-Num">
                    {[0,1,2,3,4,5,6,7,8,9].map(n => (
                      <div key={n} className={`Trend__C-body2-Num-item ${item.number === n ? 'action' + n : ''}`}>
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className={`Trend__C-body2-Num-BS ${item.number >= 5 ? 'isB' : 'isS'}`}>
                    {item.number >= 5 ? 'B' : 'S'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMyRecords = () => (
    <div className={`MyGameRecord__C ${activeTab === 'my' ? 'active' : ''}`}>
      <div className="MyGameRecord__C-head">
        <div className="MyGameRecord__C-head-moreB">More {'>'}</div>
      </div>
      <div className="MyGameRecord__C-body">
        {myRecordData.length > 0 ? (
          myRecordData.map((record, idx) => (
            <div className="MyGameRecordList__C-item" key={idx}>
              <div className={`MyGameRecordList__C-item-l grad-${record.value}`}></div>
              <div className="MyGameRecordList__C-item-m">
                <div className="MyGameRecordList__C-item-m-top">{record.periodId}</div>
                <div className="MyGameRecordList__C-item-m-bottom">{new Date(record.createdAt).toLocaleString()}</div>
              </div>
              <div className="MyGameRecordList__C-item-r">
                <div style={{ color: record.winAmount > 0 ? '#40ad72' : '#fd565c' }}>
                  {record.status === 'pending' ? 'Pending' : (record.winAmount > 0 ? 'Success' : 'Failed')}
                </div>
                <span style={{ color: record.winAmount > 0 ? '#40ad72' : '#fd565c' }}>
                  {record.winAmount > 0 ? `+₹${record.winAmount}` : `-₹${record.amount}`}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#fff' }}>No data</div>
        )}
      </div>
      <div className="MyGameRecord__C-foot">
        <div className={`MyGameRecord__C-foot-previous ${currentPage === 1 ? 'disabled' : ''}`} onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}>
           <svg className="icon-arrow" viewBox="0 0 1024 1024"><path d="M669.568 123.968l-374.08 374.08 374.08 374.08 45.248-45.248-328.832-328.832 328.832-328.832z"></path></svg>
        </div>
        <div className="MyGameRecord__C-foot-page">{currentPage}</div>
        <div className="MyGameRecord__C-foot-next" onClick={() => setCurrentPage(currentPage + 1)}>
           <svg className="icon-arrow" viewBox="0 0 1024 1024"><path d="M354.432 123.968l374.08 374.08-374.08 374.08-45.248-45.248 328.832-328.832-328.832-328.832z"></path></svg>
        </div>
      </div>
    </div>
  );

  return (
    <div className="main-container">
      {/* NAVBAR */}
      <nav className="navbar">
        <div className="navbar__content-left">
          <div className="back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
        </div>
        <div className="navbar__content-center">
          <img src="https://20518.rajaluckking.com/assets/png/logo-91c68434.png" alt="Logo" className="brand-logo-svg" />
        </div>
        <div className="navbar__content-right">
          <div className="WinGo__C-head-more">
            <div className="head-more-icon" style={{ backgroundImage: "url('assets/voice.png')" }}></div>
            <div className="head-more-icon" style={{ backgroundImage: "url('assets/guizhe.png')" }} onClick={() => setShowHowTo(true)}></div>
          </div>
        </div>
      </nav>

      {/* WALLET */}
      <div className="Wallet__C">
        <div className="Wallet__C-balance">
          <div className="Wallet__C-balance-l1">
            <img src="https://20518.rajaluckking.com/assets/png/wallet-f4852467.png" alt="Wallet" />
            <span id="userBalance">₹{balance}</span>
            <div className="refresh" onClick={updateUserBalance}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFC837" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </div>
          </div>
          <div className="Wallet__C-balance-l2">Wallet balance</div>
          <div className="Wallet__C-balance-l3">
            <div className="glass-btn btn-withdraw">Withdraw</div>
            <div className="glass-btn btn-deposit">Deposit</div>
          </div>
        </div>
      </div>

      {/* GAME TABS */}
      <div className="GameList__C">
        <div className="GameList__C-item active">
          <img src="assets/timer_act.png" className="timer-icon" alt="timer" />
          <div>Win Go<br />30s</div>
        </div>
        <div className="GameList__C-item">
          <img src="assets/timer.png" className="timer-icon" alt="timer" />
          <div>Win Go<br />1Min</div>
        </div>
        <div className="GameList__C-item">
          <img src="assets/timer.png" className="timer-icon" alt="timer" />
          <div>Win Go<br />3Min</div>
        </div>
        <div className="GameList__C-item">
          <img src="assets/timer.png" className="timer-icon" alt="timer" />
          <div>Win Go<br />5Min</div>
        </div>
      </div>

      {/* TIME LEFT SECTION */}
      <div className="TimeLeft__C">
        <div className="TimeLeft__C-scanline"></div>
        <div className="TimeLeft__C-corner tl"></div>
        <div className="TimeLeft__C-corner tr"></div>
        <div className="TimeLeft__C-corner bl"></div>
        <div className="TimeLeft__C-corner br"></div>

        <div className="TimeLeft__C-rule" onClick={() => setShowHowTo(true)}>How to play</div>
        <div className="TimeLeft__C-name">Win Go 30s</div>
        <div className="TimeLeft__C-text">Time remaining</div>

        <div className="TimeLeft__C-num">
          {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ backgroundImage: `url('assets/n${i}.png')` }}></div>)}
        </div>

        <div className="TimeLeft__C-timer-container">
          <div className="TimeLeft__C-time-digit"><span>0</span></div>
          <div className="TimeLeft__C-time-colon">:</div>
          <div className="TimeLeft__C-time-digit"><span>{timerDisplay.s[0]}</span></div>
          <div className="TimeLeft__C-time-digit"><span>{timerDisplay.s[1]}</span></div>
        </div>
        <div className="TimeLeft__C-id">{gameId}</div>
      </div>

      {/* BETTING CARD */}
      <div className="Betting__C">
        <div className="Betting__C-head">
          <div className="Betting__C-head-g glossy-btn" onClick={() => openPopup('color', 'green')}>Green</div>
          <div className="Betting__C-head-p glossy-btn" onClick={() => openPopup('color', 'violet')}>Violet</div>
          <div className="Betting__C-head-r glossy-btn" onClick={() => openPopup('color', 'red')}>Red</div>
        </div>

        <div className="Betting__C-numC">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <div key={n} className={`n${n}`} onClick={() => openPopup('number', n)}></div>
          ))}
        </div>

        <div className="Betting__C-multiple">
          <div className="Betting__C-multiple-l">Random</div>
          {[1, 5, 10, 20, 50, 100].map(m => (
            <div key={m} className={`Betting__C-multiple-r ${betMul === m ? 'active' : ''}`} onClick={() => setBetMul(m)}>X{m}</div>
          ))}
        </div>

        <div className="Betting__C-foot">
          <div className="Betting__C-foot-b glossy-btn" onClick={() => openPopup('size', 'big')}>Big</div>
          <div className="Betting__C-foot-s glossy-btn" onClick={() => openPopup('size', 'small')}>Small</div>
        </div>

        {/* COUNTDOWN OVERLAY */}
        <div className={`Betting__C-mark ${isCountdownActive ? 'active' : ''}`}>
          <div className="mark-rays"></div>
          <div className="mark-pulse pulse1"></div>
          <div className="mark-pulse pulse2"></div>
          <div className="mark-ring"></div>
          <div className="mark-ring ring2"></div>
          <div className="mark-nums">
            <div className="mark-digit">0</div>
            <div className="mark-sep">:</div>
            <div className="mark-digit">{timerDisplay.s[0]}</div>
            <div className="mark-digit">{timerDisplay.s[1]}</div>
          </div>
          <div className="mark-label">LOCKING</div>
        </div>
      </div>

      {/* RECORD NAV */}
      <div className="RecordNav__C">
        <div className={activeTab === 'game' ? 'active' : ''} onClick={() => setActiveTab('game')}>Game History</div>
        <div className={activeTab === 'trend' ? 'active' : ''} onClick={() => setActiveTab('trend')}>Chart</div>
        <div className={activeTab === 'my' ? 'active' : ''} onClick={() => setActiveTab('my')}>My History</div>
      </div>

      {/* RECORDS SECTIONS */}
      {renderHistory()}
      {renderTrend()}
      {renderMyRecords()}

      {/* BETTING POPUP */}
      <div className={`bet-overlay ${showBetPopup ? 'active' : ''}`} onClick={(e) => e.target === e.currentTarget && setShowBetPopup(false)}>
        <div className="bet-popup">
          <div className={`popup-head ${popupConfig.colorClass}`}>
            <div className="popup-head-title">Win Go 30s</div>
            <div className="popup-head-bar">
              <span>choose</span><span>{popupConfig.label}</span>
            </div>
          </div>
          <div className="popup-body">
            <div className="body-line">
              <span className="body-label">Balance</span>
              <div className="chip-list">
                {[1, 10, 100, 1000].map(amt => (
                  <button key={amt} className={`chip ${betAmount === amt ? 'active' : ''}`} onClick={() => setBetAmount(amt)}>{amt}</button>
                ))}
              </div>
            </div>
            <div className="body-line">
              <span className="body-label">Quantity</span>
              <div className="qty-ctrl">
                <button className="qty-btn grad-red" onClick={() => setBetQty(Math.max(1, betQty - 1))}>−</button>
                <input className="qty-input" type="number" value={betQty} onChange={(e) => setBetQty(parseInt(e.target.value) || 1)} />
                <button className="qty-btn grad-green" onClick={() => setBetQty(betQty + 1)}>+</button>
              </div>
            </div>
            <div className="body-line">
              <span className="body-label" style={{ visibility: 'hidden' }}>X</span>
              <div className="chip-list">
                {[1, 5, 10, 20, 50, 100].map(m => (
                  <button key={m} className={`chip ${betMul === m ? 'active' : ''}`} onClick={() => setBetMul(m)}>X{m}</button>
                ))}
              </div>
            </div>
            <div className="body-line agree-row">
              <div className={`agree-check ${isAgreed ? 'checked' : ''}`} onClick={() => setIsAgreed(!isAgreed)}></div>
              <span className="agree-text">I agree</span>
              <span className="agree-link" onClick={() => setShowPreSale(true)}>Pre-sale rules</span>
            </div>
          </div>
          <div className="popup-foot">
            <button className="foot-cancel" onClick={() => setShowBetPopup(false)}>cancel</button>
            <button className={`foot-submit ${popupConfig.colorClass}`} onClick={handleBetSubmit}>
              Total amount ₹{(betAmount * betQty * betMul).toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {/* OTHER POPUPS */}
      {showTokenPopup && (
        <div className="token-overlay active">
          <div className="token-popup">
            <div className="token-popup-title">Auth Token Required</div>
            <p className="token-popup-desc">Please enter your authentication token to continue.</p>
            <div className="token-input-group">
              <input type="text" id="tokenInput" className="token-input" placeholder="Enter Token..." />
              <div id="tokenError" className="token-error">Please enter a valid token.</div>
            </div>
            <button className="token-submit-btn" onClick={() => {
              const input = document.getElementById('tokenInput') as HTMLInputElement;
              if (input.value.trim()) {
                localStorage.setItem('token', input.value.trim());
                setShowTokenPopup(false);
                updateUserBalance();
              } else {
                const error = document.getElementById('tokenError');
                if (error) error.style.display = 'block';
              }
            }}>Submit Token</button>
          </div>
        </div>
      )}

      {showHowTo && (
        <div className="how-to-overlay active">
          <div className="how-to-popup">
            <div className="how-to-head">How to play</div>
            <div className="how-to-body">
              <p><b>30 seconds 1 issue, 25 seconds to order, 5 seconds to show the lottery result.</b> It opens all day. The total number of trade is 2880 issues.</p>
              <p>If you spend 100 to trade, after deducting 2 service fee, your contract amount is 98:</p>
              <p>1. <b>JOIN GREEN:</b> if the result shows 1,3,7,9, you will get (98*2) 196; If the result shows 5, you will get (98*1.5) 147.</p>
              <p>2. <b>JOIN RED:</b> if the result shows 2,4,6,8, you will get (98*2) 196; If the result shows 0, you will get (98*1.5) 147.</p>
              <p>3. <b>JOIN VIOLET:</b> if the result shows 0 or 5, you will get (98*4.5) 441.</p>
              <p>4. <b>SELECT NUMBER:</b> if the result is the same as the number you selected, you will get (98*9) 882.</p>
            </div>
            <div className="how-to-foot">
              <div className="how-to-foot-btn" onClick={() => setShowHowTo(false)}>close</div>
            </div>
          </div>
        </div>
      )}

      {showPreSale && (
        <div className="presale-overlay active">
          <div className="presale-popup">
            <div className="presale-head">Pre-sale rules</div>
            <div className="presale-body">
              <p>To protect the legitimate rights and interests of users who participate in the pre-sale and maintain the normal operation order of the pre-sale, the rules are formulated in accordance with relevant laws and regulations...</p>
            </div>
            <div className="presale-foot">
              <div className="presale-foot-btn" onClick={() => setShowPreSale(false)}>I Know</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WinGo;
