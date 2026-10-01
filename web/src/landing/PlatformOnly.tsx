import { useEffect, useState } from 'react';

export function PlatformOnly() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((n) => n + 1), 10000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lp-plat" key={cycle}>
      <p className="lp-circ-mark">Circularise</p>
      <p className="lp-circ-sub">같은 플랫폼 안에서만 검증됩니다</p>
      <div className="lp-plat-row">
        <div className="lp-plat-box">
          <strong>플랫폼 A</strong>
          <div className="lp-plat-pair">
            <span>재활용사</span>
            <i className="lp-plat-ok" />
            <span>셀사</span>
          </div>
          <em className="lp-plat-ok-label">검증 가능</em>
        </div>
        <svg className="lp-plat-cross" viewBox="0 0 120 80" aria-hidden>
          <path className="lp-plat-try" d="M 8 40 H 112" />
          <path className="lp-plat-x1" d="M 48 28 L 72 52" />
          <path className="lp-plat-x2" d="M 72 28 L 48 52" />
        </svg>
        <div className="lp-plat-box lp-plat-box-b">
          <strong>플랫폼 B</strong>
          <div className="lp-plat-pair">
            <span>다른 고객</span>
          </div>
          <em className="lp-plat-no-label">검증 불가</em>
        </div>
      </div>
    </div>
  );
}
