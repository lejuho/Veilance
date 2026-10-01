const DUR = '8s';
const KEY = '0;0.82;0.86;0.88;1';
const SHARE =
  'M 56 201 C 96 196 116 188 138 183 C 250 150 340 125 426 105 C 610 72 740 68 836 66';

export function NickelChart() {
  return (
    <div className="lp-chart">
      <div className="lp-chart-head">
        <strong>전체 니켈 중 청정기술·배터리 비중</strong>
        <span>IEA APS · 대략치</span>
      </div>
      <svg className="lp-chart-svg" viewBox="0 0 900 260" role="img" aria-label="청정기술 니켈 수요 비중 추세">
        <defs>
          <linearGradient id="lp-clean-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3ddc97" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="lp-reveal">
            <rect x="56" y="0" width="0" height="260">
              <animate attributeName="width" values="0;780;780;0;0" keyTimes={KEY} dur={DUR} repeatCount="indefinite" />
            </rect>
          </clipPath>
        </defs>
        {[
          [228, '0%'],
          [168, '20%'],
          [108, '40%'],
          [48, '60%'],
        ].map(([y, label]) => (
          <g key={label}>
            <line x1="56" x2="836" y1={Number(y)} y2={Number(y)} stroke="rgba(61,220,151,0.08)" />
            <text x="48" y={Number(y) + 4} textAnchor="end" fill="rgba(176,204,186,0.7)" fontSize="11">
              {label}
            </text>
          </g>
        ))}
        <g clipPath="url(#lp-reveal)">
          <path d={`${SHARE} L 836 228 L 56 228 Z`} fill="url(#lp-clean-fill)" />
          <path d={SHARE} fill="none" stroke="#3ddc97" strokeWidth="2.6" />
        </g>
        <path id="lp-clean-path" d={SHARE} fill="none" stroke="transparent" strokeWidth="2" />
        {[
          [56, '2021'],
          [138, '2023'],
          [426, '2030'],
          [836, '2040'],
        ].map(([x, label]) => (
          <text key={label} x={Number(x)} y="248" textAnchor="middle" fill="rgba(176,204,186,0.7)" fontSize="12">
            {label}
          </text>
        ))}
        {[
          [56, 201, '9%'],
          [138, 183, '15%'],
          [426, 105, '41%'],
          [836, 66, '54%'],
        ].map(([x, y, label]) => (
          <text key={label} x={Number(x)} y={Number(y) - 10} textAnchor="middle" fill="#7dffc4" fontSize="11">
            {label}
          </text>
        ))}
        <polygon points="-2,-5 16,0 -2,5" fill="#7dffc4" stroke="#3ddc97" strokeWidth="0.6">
          <animateMotion dur={DUR} rotate="auto" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.82;1">
            <mpath href="#lp-clean-path" />
          </animateMotion>
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.04;0.8;0.86;1" />
        </polygon>
      </svg>
      <p className="lp-chart-note">
        배터리용 니켈은 2023년 약 370kt로 전체의 10%를 넘었습니다. 청정기술 비중은 2030년 약 41%, 2040년 약 54%까지 올라갑니다. 재활용 공급은 아직 1%대입니다.
      </p>
    </div>
  );
}
