import type { CSSProperties } from 'react';

type TechLogoProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

function RobotWithMustache({ size, fontSize }: { size: number; fontSize: string }) {
  const mustacheWidth = size * 0.55;
  const mustacheHeight = size * 0.14;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        color: '#ffffff',
        boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
        flexShrink: 0,
      }}
      aria-hidden
    >
      <span style={{ lineHeight: 1 }}>🤖</span>
      {/* Wąs: odbicie względem osi poziomej (było do góry nogami) + wyżej, nad ustami */}
      <svg
        viewBox="0 0 100 36"
        width={mustacheWidth}
        height={mustacheHeight}
        style={{
          position: 'absolute',
          left: '50%',
          // Pomiędzy oczami a ustami emoji 🤖
          top: `calc(72% - ${mustacheHeight}px - 1px)`,
          transform: 'translateX(-50%) scaleY(-1)',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
        }}
      >
        <path
          d="M50 18
             C42 6, 28 4, 16 12
             C8 18, 10 28, 22 26
             C32 24, 40 20, 50 24
             C60 20, 68 24, 78 26
             C90 28, 92 18, 84 12
             C72 4, 58 6, 50 18 Z"
          fill="#1a1208"
        />
        <path
          d="M50 20
             C44 14, 36 12, 28 16
             C36 18, 44 20, 50 22
             C56 20, 64 18, 72 16
             C64 12, 56 14, 50 20 Z"
          fill="#3d2a14"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}

export default function TechLogo({
  title = 'Agentosław Reaktowski',
  subtitle = 'Twój sztuczny inteligent za jeden uśmiech. Daj mi misje!',
  compact = false,
}: TechLogoProps) {
  const symbolSize = compact ? 160 : 56;
  const symbolFont = compact ? '5.6rem' : '1.8rem';

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <RobotWithMustache size={symbolSize} fontSize={symbolFont} />
        <div
          style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#f1f5f9',
            lineHeight: 1.25,
            maxWidth: '100%',
          }}
        >
          {title}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        justifyContent: 'center',
      }}
    >
      <RobotWithMustache size={symbolSize} fontSize={symbolFont} />

      <div style={{ textAlign: 'left' }}>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#06b6d4',
          }}
        >
          Agent AI
        </div>
        <div
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#f1f5f9',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{subtitle}</div>
      </div>
    </div>
  );
}

export const techNavLinkStyle = (active = false): CSSProperties => ({
  padding: '8px 14px',
  borderRadius: '999px',
  border: active ? '1px solid #8b5cf6' : '1px solid #3b3b5c',
  background: active ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 30, 53, 0.8)',
  color: active ? '#c4b5fd' : '#94a3b8',
  textDecoration: 'none',
  fontSize: '0.88rem',
  fontWeight: active ? 600 : 500,
  boxShadow: active ? '0 0 12px rgba(139, 92, 246, 0.25)' : 'none',
});
