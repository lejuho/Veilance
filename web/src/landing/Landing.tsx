import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { enableSim } from '../v2/sim';
import { DoubleCount } from './DoubleCount';
import { NickelChart } from './NickelChart';
import { Sky } from './Sky';
import './landing.css';

const MODE_KEY = 'veilance-v2-mode';

export function Landing() {
  const navigate = useNavigate();
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    const href = `${base}fonts/fonts.css`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }, [base]);

  const startDemo = () => {
    try {
      sessionStorage.setItem(MODE_KEY, 'demo');
    } catch {
      /* optional */
    }
    enableSim();
    navigate('/v2');
  };

  return (
    <div className="lp">
      <Sky />
      <div className="lp-fore">
      <header className="lp-nav">
        <a className="lp-mark" href="#hero">
          <i />
          Veilance
        </a>
        <button type="button" className="lp-nav-cta" onClick={startDemo}>
          데모 시작
        </button>
      </header>

      <section className="lp-section" id="hero">
        <p className="lp-kicker">Midnight Korea Hackathon 2026</p>
        <h1 className="lp-h1">
          같은 재활용 니켈을
          <br />
          두 번 팔 수 없게.
          <br />
          <em>물량과 거래처는 숨긴 채로.</em>
        </h1>
        <p className="lp-lead">
          Veilance는 배터리 원료 공급망을 위한 프라이버시 공유 원장입니다. 추적 화면은 그대로 두고, 플랫폼 사이에서 같은 재활용분이 두 번 쓰이지 못하게 Midnight 위에서 막습니다.
        </p>
        <button type="button" className="lp-cta" onClick={startDemo}>
          데모 시작
        </button>
      </section>

      <section className="lp-section" id="nickel">
        <p className="lp-kicker">1.1 · 니켈</p>
        <h2 className="lp-h2">
          녹슬지 말라고 쓰던 금속이,
          <br />
          이제 전기차 배터리에 들어갑니다.
        </h2>
        <p className="lp-lead">
          니켈은 은빛 전이금속입니다. 스테인리스에 들어가면 싱크대와 칼이 되고, NMC·NCA 양극에 들어가면 전기차 주행거리가 됩니다. 쓰임이 냄비에서 배터리로 옮겨가는 중입니다.
        </p>
        <div className="lp-photos">
          <figure>
            <img src={`${base}landing/nickel-ore.jpg`} alt="니켈 황화광 암석" />
            <figcaption>무엇인가 · 땅속 황화광</figcaption>
          </figure>
          <figure>
            <img src={`${base}landing/nickel-steel.jpg`} alt="스테인리스 싱크대와 냄비" />
            <figcaption>어디에 · 스테인리스, 아직 최대 수요</figcaption>
          </figure>
          <figure>
            <img src={`${base}landing/nickel-cells.jpg`} alt="18650과 21700 리튬이온 원통형 셀" />
            <figcaption>어디에 · 원통형 배터리 셀</figcaption>
          </figure>
          <figure>
            <img src={`${base}landing/nickel-ev.jpg`} alt="충전 중인 전기차" />
            <figcaption>어디에 · 전기차 양극재</figcaption>
          </figure>
        </div>
        <NickelChart />
      </section>

      <section className="lp-section" id="problem">
        <p className="lp-kicker">2 · 문제</p>
        <h2 className="lp-h2">
          금속은 하나인데
          <br />
          서류만 두 장이 됩니다.
        </h2>
        <DoubleCount />
        <p className="lp-lead">
          회사마다, 추적 플랫폼마다 장부가 따로라서 같은 30톤을 두 고객에게 줬다고 적어도 맞춰 볼 수가 없습니다. 허위든 실수든 비교 자체가 안 됩니다.
        </p>
      </section>

      <section className="lp-section" id="secrets">
        <p className="lp-kicker">03 · 그래서 한곳에 모으면</p>
        <h2 className="lp-h2">증명은 되지만 영업비밀이 그대로 넘어갑니다.</h2>
        <div className="lp-grid lp-grid-2">
          <div className="lp-card">
            <h3>대조하려면 보여줘야 하는 것</h3>
            <div className="lp-chips">
              <span className="lp-chip">공급사 이름</span>
              <span className="lp-chip">로트별 물량</span>
              <span className="lp-chip">거래처와 주문량</span>
              <span className="lp-chip">공장별 투입량</span>
            </div>
          </div>
          <div className="lp-card">
            <h3>믿을 수 있는 숫자 vs 비밀</h3>
            <p>한곳에 모으면 이중 계상은 잡힙니다. 대신 경쟁하는 한국 셀 제조사와 소재사가 서로 몇 톤을 사는지가 다 보입니다. 지금 방식은 둘 중 하나를 포기하는 구조입니다.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" id="today">
        <p className="lp-kicker">04 · 지금은</p>
        <h2 className="lp-h2">플랫폼 안은 이미 추적합니다. 사이가 비어 있습니다.</h2>
        <div className="lp-grid lp-grid-2">
          <div className="lp-card">
            <h3>Circularise 같은 추적 플랫폼</h3>
            <p>수집·화면·배터리 여권은 이미 있습니다. 영지식 증명도 씁니다. 다만 자기 플랫폼 고객들 안에서입니다.</p>
          </div>
          <div className="lp-card">
            <h3>플랫폼이 갈라지면</h3>
            <p>LG는 A 프로그램, 삼성은 B 프로그램을 쓰면 같은 재활용 30톤이 양쪽에 올라가도 어느 쪽도 모릅니다. 그 빈칸이 Veilance가 맡는 자리입니다.</p>
          </div>
        </div>
      </section>

      <section className="lp-section" id="veilance">
        <p className="lp-kicker">05 · 해결</p>
        <h2 className="lp-h2">추적 플랫폼 아래에 공유 원장 하나를 둡니다.</h2>
        <div className="lp-grid lp-flow">
          <div className="lp-card">
            <h3>회사</h3>
            <p>재활용 업체, 광산, 가공사, 셀 제조사, OEM. 지갑과 토큰은 필요 없습니다.</p>
          </div>
          <div className="lp-card">
            <h3>Veilance 노드</h3>
            <p>비밀값을 들고 영지식 증명을 만듭니다. 회사는 API 키만 줍니다.</p>
          </div>
          <div className="lp-card">
            <h3>수수료 대납</h3>
            <p>DUST는 운영 서버가 냅니다. 대납 서버는 증명만 받고 비밀값은 못 봅니다.</p>
          </div>
          <div className="lp-card">
            <h3>Midnight 원장</h3>
            <p>해시, 사용 표시, 암호문, 신고 비율만 남습니다. OEM과 인증기관은 계정 없이 읽습니다.</p>
          </div>
        </div>
        <p className="lp-lead" style={{ marginTop: 28 }}>
          한국도 2027년 사용후 배터리법으로 같은 길을 갑니다. 지금부터 30톤이 OEM까지 가는 길을 보여 드리겠습니다.
        </p>
        <button type="button" className="lp-cta" onClick={startDemo}>
          데모 시작
        </button>
      </section>
      </div>
    </div>
  );
}
