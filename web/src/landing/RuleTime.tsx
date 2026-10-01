import { useEffect, useState } from 'react';

const STEPS = [
  {
    when: '2026',
    tag: '지금',
    what: '함량을 증명할 필요 없이, 사용했다고 하면 됩니다.',
    need: '',
  },
  {
    when: '2027',
    tag: 'EU 여권',
    what: '특정 EV·산업용 배터리에 여권이 붙습니다.',
    need: '없으면 유럽에 넣기 어렵습니다.',
  },
  {
    when: '2028',
    tag: '함량 기재',
    what: '문서에 재활용 함량을 적습니다. 증명 가능한 숫자로.',
    need: '못 채우면 유럽에 배터리를 팔기가 어렵습니다.',
  },
  {
    when: '2031',
    tag: '최소 비율',
    what: '니켈 6% · 리튬 6% · 코발트 16%.',
    need: '최소 비율을 숫자로 증명해야 합니다.',
  },
  {
    when: '2036',
    tag: '비율 상향',
    what: '니켈 15% · 리튬 12%. 1.3배 가산이 끝납니다.',
    need: '비율이 더 오르고, 가산도 끊깁니다.',
  },
];

const CYCLE = 20000;

export function RuleTime() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCycle((n) => n + 1), CYCLE);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lp-tl" key={cycle}>
      <div className="lp-tl-bar" aria-hidden>
        <i className="lp-tl-fill" />
        <b className="lp-tl-head" />
        {STEPS.map((s, i) => (
          <i key={s.when} className={`lp-tl-dot lp-tl-dot-${i + 1}`} />
        ))}
      </div>
      <div className="lp-tl-boxes">
        {STEPS.map((s, i) => (
          <article key={s.when} className={`lp-tl-box lp-tl-box-${i + 1}`}>
            <span className="lp-tl-year">{s.when}</span>
            <span className="lp-tl-tag">{s.tag}</span>
            <p className="lp-tl-what">{s.what}</p>
            <p className="lp-tl-need">{s.need}</p>
          </article>
        ))}
      </div>
      <aside className="lp-tl-kr">
        <b>78%</b>
        <div>
          <h3>유럽만의 숙제가 아닙니다.</h3>
          <p>
            2027년 사용후 배터리법으로 재생원료 인증과 전주기 이력관리가 시작됩니다. 그 의무를 실제로 지는 곳은 LG엔솔 폴란드, 삼성SDI와 SK온 헝가리 공장입니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
