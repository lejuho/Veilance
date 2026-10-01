import { useEffect, useState } from 'react';

export function DoubleCount() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((n) => n + 1), 14000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lp-dup" key={cycle}>
      <div className="lp-dup-flow">
        <div className="lp-dup-real">
          <div className="lp-ni" aria-hidden>
            🪨
          </div>
          <p>
            실제 니켈
            <strong>30 t</strong>
          </p>
        </div>

        <svg className="lp-dup-in" viewBox="0 0 64 220" aria-hidden>
          <defs>
            <marker id="lp-ah-in" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3ddc97" />
            </marker>
          </defs>
          <path
            className="lp-dup-trunk"
            d="M 4 110 H 54"
            fill="none"
            stroke="#3ddc97"
            strokeWidth="2.6"
            strokeLinecap="round"
            markerEnd="url(#lp-ah-in)"
          />
          <path id="lp-dup-in" d="M 4 110 H 54" fill="none" stroke="none" />
          <g>
            <animateMotion dur="14s" repeatCount="1" fill="freeze" rotate="0" keyPoints="0;1;1;1" keyTimes="0;0.14;0.88;1" calcMode="linear">
              <mpath href="#lp-dup-in" />
            </animateMotion>
            <animate attributeName="opacity" dur="14s" repeatCount="1" fill="freeze" values="0;1;1;0;0" keyTimes="0;0.04;0.16;0.2;1" />
            <text fontSize="18" textAnchor="middle" dy="6">
              🪨
            </text>
          </g>
        </svg>

        <div className="lp-docproc">
          <div className="lp-docproc-sheet" aria-hidden>
            <i />
            <i />
            <i />
            <b>30 t</b>
          </div>
          <p>
            문서화
            <strong>장부에 기록</strong>
          </p>
        </div>

        <svg className="lp-dup-svg" viewBox="0 0 140 220" aria-hidden>
          <defs>
            <marker id="lp-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3ddc97" />
            </marker>
          </defs>
          <path
            className="lp-dup-branch lp-dup-branch-a"
            d="M 8 110 C 40 110 52 40 128 40"
            fill="none"
            stroke="#3ddc97"
            strokeWidth="2.6"
            strokeLinecap="round"
            markerEnd="url(#lp-ah)"
          />
          <path
            className="lp-dup-branch lp-dup-branch-b"
            d="M 8 110 C 40 110 52 180 128 180"
            fill="none"
            stroke="#3ddc97"
            strokeWidth="2.6"
            strokeLinecap="round"
            markerEnd="url(#lp-ah)"
          />
          <path id="lp-dup-a" d="M 8 110 C 40 110 52 40 128 40" fill="none" stroke="none" />
          <path id="lp-dup-b" d="M 8 110 C 40 110 52 180 128 180" fill="none" stroke="none" />
          <g>
            <g>
              <animateMotion dur="14s" repeatCount="1" fill="freeze" rotate="0" keyPoints="0;0;1;1;1" keyTimes="0;0.26;0.4;0.88;1" calcMode="linear">
                <mpath href="#lp-dup-a" />
              </animateMotion>
              <animate attributeName="opacity" dur="14s" repeatCount="1" fill="freeze" values="0;0;1;1;0;0" keyTimes="0;0.26;0.28;0.4;0.44;1" />
              <text fontSize="16" textAnchor="middle" dy="6">
                📄
              </text>
            </g>
            <g>
              <animateMotion dur="14s" repeatCount="1" fill="freeze" rotate="0" keyPoints="0;0;1;1;1" keyTimes="0;0.26;0.4;0.88;1" calcMode="linear">
                <mpath href="#lp-dup-b" />
              </animateMotion>
              <animate attributeName="opacity" dur="14s" repeatCount="1" fill="freeze" values="0;0;1;1;0;0" keyTimes="0;0.26;0.28;0.4;0.44;1" />
              <text fontSize="16" textAnchor="middle" dy="6">
                📄
              </text>
            </g>
          </g>
        </svg>

        <div className="lp-dup-docs">
          <article className="lp-paper lp-paper-a">
            <span className="lp-paper-co">A 회사 제출 서류</span>
            <div className="lp-paper-ni">
              <span aria-hidden>📄</span>
              <em>재활용 니켈 30 t</em>
            </div>
          </article>
          <article className="lp-paper lp-paper-b">
            <span className="lp-paper-co">B 회사 제출 서류</span>
            <div className="lp-paper-ni">
              <span aria-hidden>📄</span>
              <em>재활용 니켈 30 t</em>
            </div>
          </article>
        </div>
      </div>

      <div className="lp-miss">
        <div className="lp-miss-row">
          <div className="lp-miss-cell">
            <span>실제 니켈</span>
            <b>30 t</b>
            <i className="lp-miss-bar lp-miss-bar-real" />
          </div>
          <div className="lp-miss-cell lp-miss-cell-paper">
            <span>문서상 니켈</span>
            <b>
              <span className="lp-miss-30">30 t</span>
              <span className="lp-miss-60">60 t</span>
            </b>
            <i className="lp-miss-bar lp-miss-bar-paper" />
          </div>
        </div>
        <svg className="lp-slash" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden>
          <path d="M 18 78 L 382 12" />
        </svg>
        <p className="lp-miss-flag">불일치 발생</p>
      </div>
    </div>
  );
}
