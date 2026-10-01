import { useEffect, useState } from 'react';

const ROWS = [
  { k: '공급사', v: '유미코아 · 로트 HU-04' },
  { k: '로트 물량', v: '재활용 니켈 30 t' },
  { k: '거래처', v: 'LG엔솔 18 t · 삼성SDI 12 t' },
  { k: '공장 투입', v: '폴란드 · 헝가리' },
];

export function LeakProof() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((n) => n + 1), 12000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lp-leak" key={cycle}>
      <div className="lp-ledger">
        <div className="lp-ledger-top">
          <span>공유 장부</span>
          <em className="lp-ledger-lock">잠김</em>
          <em className="lp-ledger-open">열림 · 대조 가능</em>
        </div>
        <ul>
          {ROWS.map((row) => (
            <li key={row.k}>
              <span>{row.k}</span>
              <strong>
                <i className="lp-redact" />
                {row.v}
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <p className="lp-leak-stamp">영업비밀 노출</p>
    </div>
  );
}
