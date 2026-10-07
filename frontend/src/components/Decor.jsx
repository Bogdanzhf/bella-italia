// Декоративные SVG-иллюстрации: принцесса, замок, птички, бабочки, цветы, облака, радуга.

function FlowerShape({ petal = '#ffb3cf', center = '#ffd36e', x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="20" cy="10" rx="7" ry="10" fill={petal} transform={`rotate(${a} 20 20)`} opacity="0.95" />
      ))}
      <circle cx="20" cy="20" r="6" fill={center} />
      <circle cx="18" cy="18" r="1.6" fill="#fff" opacity="0.7" />
    </g>
  )
}

export function Flower({ size = 40, petal = '#ffb3cf', center = '#ffd36e', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <FlowerShape petal={petal} center={center} />
    </svg>
  )
}

export function Tulip({ size = 40, color = '#ff9fc2', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size * 1.5} viewBox="0 0 40 60" aria-hidden="true">
      <path d="M20 30 C20 42 20 50 20 58" stroke="#7fcf9f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 48 C10 44 8 36 9 32 C15 36 19 40 20 48 Z" fill="#9fdcb6" />
      <path d="M8 10 L14 18 L20 6 L26 18 L32 10 C34 24 28 32 20 32 C12 32 6 24 8 10 Z" fill={color} />
    </svg>
  )
}

export function Bird({ size = 56, color = '#a8d8ff', wing = '#7ec0f5', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="30" cy="36" rx="20" ry="15" fill={color} />
      <circle cx="44" cy="26" r="11" fill={color} />
      <path d="M54 25 L62 28 L54 31 Z" fill="#ffb347" />
      <circle cx="47" cy="24" r="2.4" fill="#4a3a4e" />
      <circle cx="47.8" cy="23.2" r="0.8" fill="#fff" />
      <circle cx="42" cy="30" r="3" fill="#ffb3cf" opacity="0.7" />
      <path d="M16 32 C22 22 34 26 34 36 C28 42 20 40 16 32 Z" fill={wing} />
      <path d="M10 34 L2 28 L6 38 Z" fill={wing} />
      <path d="M26 50 L24 57 M34 50 L35 57" stroke="#ffb347" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Ласточка в полёте — для фона. */
export function Swallow({ size = 40, color = '#b79cf0', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size * 0.6} viewBox="0 0 60 36" aria-hidden="true">
      <path d="M2 14 C14 6 24 10 30 18 C36 10 46 6 58 14 C46 14 38 18 32 26 L30 34 L28 26 C22 18 14 14 2 14 Z" fill={color} />
      <circle cx="30" cy="20" r="3" fill="#fff" opacity="0.6" />
    </svg>
  )
}

export function Butterfly({ size = 40, color = '#d7c2ff', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="12" cy="14" rx="9" ry="10" fill={color} />
      <ellipse cx="28" cy="14" rx="9" ry="10" fill={color} />
      <ellipse cx="13" cy="28" rx="7" ry="7" fill="#ffc6dc" />
      <ellipse cx="27" cy="28" rx="7" ry="7" fill="#ffc6dc" />
      <circle cx="12" cy="13" r="3" fill="#fff" opacity="0.5" />
      <circle cx="28" cy="13" r="3" fill="#fff" opacity="0.5" />
      <rect x="19" y="8" width="2.5" height="26" rx="1.2" fill="#6b4a5e" />
      <path d="M20 8 L16 2 M21 8 L25 2" stroke="#6b4a5e" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function Cloud({ size = 90, color = '#ffffff', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size * 0.55} viewBox="0 0 100 55" aria-hidden="true">
      <path d="M18 50 C4 50 2 32 16 30 C14 14 36 8 44 20 C50 6 74 6 76 24 C92 22 98 48 82 50 Z" fill={color} />
    </svg>
  )
}

export function Rainbow({ size = 140, className = '', style }) {
  const colors = ['#ffb3cf', '#ffd59e', '#fff1a8', '#bdf0da', '#bfe2ff', '#d7c2ff']
  return (
    <svg className={className} style={style} width={size} height={size / 2} viewBox="0 0 140 70" aria-hidden="true">
      {colors.map((c, i) => (
        <path key={c} d={`M${8 + i * 7} 70 A${62 - i * 7} ${62 - i * 7} 0 0 1 ${132 - i * 7} 70`} stroke={c} strokeWidth="7" fill="none" />
      ))}
    </svg>
  )
}

export function Sparkle({ size = 18, color = '#ffd36e', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill={color} />
    </svg>
  )
}

export function Crown({ size = 40, className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 64 48" aria-hidden="true">
      <path d="M6 40 L10 10 L22 26 L32 6 L42 26 L54 10 L58 40 Z" fill="#ffd36e" stroke="#f0a92e" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="6" y="38" width="52" height="8" rx="3" fill="#f0a92e" />
      <circle cx="10" cy="9" r="4" fill="#ff8fb5" />
      <circle cx="32" cy="5" r="4" fill="#b79cf0" />
      <circle cx="54" cy="9" r="4" fill="#7fd3b4" />
      <circle cx="32" cy="30" r="4" fill="#ff8fb5" />
    </svg>
  )
}

export function Heart({ size = 20, color = '#ff8fb5', className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21 C5 15 2 12 2 8 C2 5 4.5 3 7 3 C9 3 11 4.5 12 6 C13 4.5 15 3 17 3 C19.5 3 22 5 22 8 C22 12 19 15 12 21 Z" fill={color} />
    </svg>
  )
}

/**
 * Принцесса. Волосы — боковые локоны за плечами и пряди, обрамляющие лицо;
 * под подбородком видны шея и платье.
 */
export function Princess({ size = 180, className = '', style }) {
  const skin = '#ffe3d1'
  const skinShade = '#f9cdb5'
  const hair = '#f4c46a'
  const hairDark = '#e3a948'
  const hairLight = '#ffe09a'
  return (
    <svg className={className} style={style} width={size} height={size * 1.3} viewBox="0 0 200 260" aria-hidden="true">
      <defs>
        <linearGradient id="pr-dress" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb8d2" />
          <stop offset="1" stopColor="#f78fb3" />
        </linearGradient>
        <linearGradient id="pr-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hairLight} />
          <stop offset="1" stopColor={hair} />
        </linearGradient>
      </defs>

      {/* задние локоны: спускаются за плечами по бокам, под лицом их нет */}
      <path d="M62 64 C50 92 46 128 52 160 C56 172 70 172 74 160 C70 132 72 104 80 84 Z" fill={hairDark} />
      <path d="M138 64 C150 92 154 128 148 160 C144 172 130 172 126 160 C130 132 128 104 120 84 Z" fill={hairDark} />
      {/* затылок — заканчивается выше подбородка */}
      <ellipse cx="100" cy="62" rx="40" ry="36" fill={hair} />

      {/* юбка */}
      <path d="M70 150 C56 180 40 222 30 252 L170 252 C160 222 144 180 130 150 Z" fill="url(#pr-dress)" />
      <path d="M100 150 C94 190 90 222 88 252 L112 252 C110 222 106 190 100 150 Z" fill="#ffd3e3" opacity="0.8" />
      <path d="M32 244 Q52 232 70 244 Q86 232 100 244 Q114 232 130 244 Q148 232 168 244 L170 252 L30 252 Z" fill="#ff9fc2" />
      {[44, 64, 84, 100, 116, 136, 156].map((x) => <circle key={x} cx={x} cy="248" r="2.6" fill="#fff" opacity="0.85" />)}

      {/* шея */}
      <path d="M90 96 L110 96 L111 122 L89 122 Z" fill={skinShade} />
      {/* корсаж и рукава-фонарики */}
      <path d="M78 120 C88 126 112 126 122 120 L128 150 C112 156 88 156 72 150 Z" fill="#f383ae" />
      <path d="M86 122 C92 132 108 132 114 122" stroke="#ffd3e3" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="74" cy="126" r="13" fill="#ffc0d8" />
      <circle cx="126" cy="126" r="13" fill="#ffc0d8" />
      {/* руки держат букет */}
      <path d="M68 134 C64 146 74 156 92 158" stroke={skin} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M132 134 C136 146 126 156 108 158" stroke={skin} strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="158" r="9" fill="#ff8fb5" />
      <circle cx="91" cy="153" r="6" fill="#ffd36e" />
      <circle cx="109" cy="153" r="6" fill="#b79cf0" />
      <circle cx="100" cy="148" r="5" fill="#bdf0da" />
      <path d="M96 166 L94 176 M100 167 L100 178 M104 166 L106 176" stroke="#7fcf9f" strokeWidth="2.4" strokeLinecap="round" />

      {/* лицо */}
      <circle cx="100" cy="68" r="30" fill={skin} />
      <ellipse cx="88" cy="72" rx="4.2" ry="5" fill="#4a3a4e" />
      <ellipse cx="112" cy="72" rx="4.2" ry="5" fill="#4a3a4e" />
      <circle cx="89.5" cy="70" r="1.6" fill="#fff" />
      <circle cx="113.5" cy="70" r="1.6" fill="#fff" />
      <path d="M82 66 L84 68 M84 64 L86 67 M118 66 L116 68 M116 64 L114 67" stroke="#4a3a4e" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="80" cy="82" rx="6" ry="4" fill="#ffadc9" opacity="0.7" />
      <ellipse cx="120" cy="82" rx="6" ry="4" fill="#ffadc9" opacity="0.7" />
      <path d="M93 85 Q100 91 107 85" stroke="#d9637f" strokeWidth="2.6" fill="none" strokeLinecap="round" />

      {/* пряди у лица — спускаются вдоль щёк к плечам, оставляя подбородок открытым */}
      <path d="M72 56 C64 74 66 98 74 116 C78 106 78 90 80 76 Z" fill="url(#pr-hair)" />
      <path d="M128 56 C136 74 134 98 126 116 C122 106 122 90 120 76 Z" fill="url(#pr-hair)" />
      {/* чёлка */}
      <path d="M68 62 C66 36 90 28 100 30 C112 28 136 36 132 62 C124 50 112 44 104 50 C98 42 82 46 68 62 Z" fill="url(#pr-hair)" />
      <path d="M84 40 C92 36 104 35 112 38" stroke="#fff3cf" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />

      {/* тиара */}
      <g transform="translate(78 14) scale(0.7)">
        <path d="M6 40 L10 12 L22 28 L32 4 L42 28 L54 12 L58 40 Z" fill="#ffd36e" stroke="#f0a92e" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="32" cy="4" r="5" fill="#ff8fb5" />
        <circle cx="10" cy="11" r="4" fill="#b79cf0" />
        <circle cx="54" cy="11" r="4" fill="#7fd3b4" />
        <circle cx="32" cy="30" r="4" fill="#fff" opacity="0.8" />
      </g>
      <path d="M160 18 C161 24 163 26 169 27 C163 28 161 30 160 36 C159 30 157 28 151 27 C157 26 159 24 160 18 Z" fill="#ffe08a" />
    </svg>
  )
}

export function Castle({ size = 220, className = '', style }) {
  return (
    <svg className={className} style={style} width={size} height={size * 0.8} viewBox="0 -16 220 192" aria-hidden="true">
      <rect x="40" y="70" width="140" height="100" rx="6" fill="#ffe4ee" />
      <rect x="20" y="50" width="40" height="120" rx="6" fill="#ffd6e5" />
      <rect x="160" y="50" width="40" height="120" rx="6" fill="#ffd6e5" />
      <rect x="90" y="30" width="40" height="140" rx="6" fill="#ffd0e2" />
      <path d="M16 52 L40 12 L64 52 Z" fill="#b79cf0" />
      <path d="M156 52 L180 12 L204 52 Z" fill="#b79cf0" />
      <path d="M86 32 L110 -2 L134 32 Z" fill="#a585ea" />
      <path d="M110 -2 L110 -14 L124 -8 L110 -4" fill="#ff8fb5" />
      <path d="M96 170 L96 132 C96 118 124 118 124 132 L124 170 Z" fill="#f78fb3" />
      {[[34, 80], [174, 80], [104, 62], [60, 100], [150, 100]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y + 18} L${x} ${y + 6} C${x} ${y} ${x + 12} ${y} ${x + 12} ${y + 6} L${x + 12} ${y + 18} Z`} fill="#c9b3ff" />
      ))}
      <path d="M0 170 C40 160 70 176 110 168 C150 160 180 176 220 168 L220 176 L0 176 Z" fill="#bfe8cf" />
    </svg>
  )
}

/** Гирлянда из цветов и листьев для углов страницы. */
export function Vine({ size = 160, className = '', style, flip = false }) {
  return (
    <svg className={className} style={{ transform: flip ? 'scaleX(-1)' : undefined, ...style }} width={size} height={size} viewBox="0 0 160 160" aria-hidden="true">
      <path d="M0 6 C40 10 70 30 90 60 C110 90 120 120 150 156" stroke="#a8dcbc" strokeWidth="3" fill="none" strokeLinecap="round" />
      {[[22, 12, -20], [50, 24, 10], [74, 42, -30], [96, 72, 20], [114, 100, -10], [132, 130, 30]].map(([x, y, r]) => (
        <ellipse key={`${x}`} cx={x} cy={y} rx="9" ry="4.5" fill="#c3ebd2" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <FlowerShape x={30} y={0} scale={0.55} />
      <FlowerShape x={80} y={50} scale={0.45} petal="#d7c2ff" />
      <FlowerShape x={118} y={112} scale={0.5} petal="#ffd0b0" />
    </svg>
  )
}

/** Фон: облака, радуга, птички, бабочки и цветы — по краям, не мешая содержимому. */
export function Garden() {
  return (
    <div className="garden" aria-hidden="true">
      <Cloud className="drift d1" style={{ top: '9%', left: '-2%' }} size={130} />
      <Cloud className="drift d2" style={{ top: '22%', right: '-3%' }} size={110} color="#fff6fb" />
      <Cloud className="drift d3" style={{ top: '64%', left: '-4%' }} size={120} color="#f7f2ff" />
      <Rainbow style={{ top: '78%', right: '2%' }} size={150} className="soft" />
      <Vine style={{ top: 0, left: 0 }} size={150} className="vine" />
      <Vine style={{ top: 0, right: 0 }} size={150} flip className="vine" />
      <Bird className="float f1" style={{ top: '14%', left: '3%' }} size={46} />
      <Swallow className="fly w1" style={{ top: '7%', left: '40%' }} size={34} />
      <Swallow className="fly w2" style={{ top: '12%', left: '62%' }} size={26} color="#ffb3cf" />
      <Butterfly className="float f2" style={{ top: '34%', right: '3%' }} size={34} />
      <Bird className="float f3" style={{ top: '56%', right: '2%' }} size={40} color="#ffd1e3" wing="#ffb3cf" />
      <Butterfly className="float f1" style={{ top: '74%', left: '2%' }} size={28} color="#bdf0da" />
      <Sparkle className="twinkle t1" style={{ top: '28%', left: '6%' }} size={16} />
      <Sparkle className="twinkle t2" style={{ top: '46%', right: '7%' }} size={14} color="#d7c2ff" />
      <Sparkle className="twinkle t3" style={{ top: '88%', left: '12%' }} size={18} color="#ffb3cf" />
      <Heart className="twinkle t2" style={{ top: '40%', left: '1.5%' }} size={14} />
      <Flower className="spin" style={{ bottom: '4%', left: '5%' }} size={32} />
      <Tulip style={{ bottom: '0', right: '8%', position: 'absolute' }} size={34} />
      <Tulip style={{ bottom: '0', right: '12%', position: 'absolute' }} size={26} color="#d7c2ff" />
      <Tulip style={{ bottom: '0', left: '9%', position: 'absolute' }} size={22} color="#ffd59e" />
    </div>
  )
}
