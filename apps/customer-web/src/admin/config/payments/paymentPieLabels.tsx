const RADIAN = Math.PI / 180;
const FONT_SIZE = 11;
const FONT_WEIGHT = 700;

export type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  name?: string | number;
  index?: number;
  /** Show label even when the slice is too small (e.g. while hovered). */
  forceShow?: boolean;
};

function estimateTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.62;
}

/**
 * Inside when the slice is wide enough; otherwise rotate text along the radius
 * toward the centre. If still too tight, hide until hover (`forceShow`).
 */
export function PaymentPieSliceLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  startAngle = 0,
  endAngle = 0,
  name,
  forceShow = false
}: PieLabelProps) {
  const text = String(name ?? "").trim();
  if (!text || outerRadius <= 0) return null;

  const sliceAngle = Math.abs(endAngle - startAngle);
  const halfAngleRad = (sliceAngle / 2) * RADIAN;
  const midR = innerRadius + (outerRadius - innerRadius) * 0.55;
  const chord = 2 * midR * Math.sin(Math.max(halfAngleRad, 0.001));
  const textW = estimateTextWidth(text, FONT_SIZE);
  const radialLen = Math.max(0, outerRadius - innerRadius - 18);
  const sliceThickness = chord;

  const fitsInside = textW < chord * 0.88 && sliceAngle >= 26;
  const fitsRadial = textW < radialLen && FONT_SIZE + 2 < sliceThickness && sliceAngle >= 10;

  if (!fitsInside && !fitsRadial && !forceShow) return null;

  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const x = cx + midR * cos;
  const y = cy + midR * sin;

  if (fitsInside) {
    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={FONT_SIZE}
        fontWeight={FONT_WEIGHT}
        style={{ pointerEvents: "none" }}
      >
        {text}
      </text>
    );
  }

  // Radial / parallel to centre: letters run along the ray from the centre.
  let rotation = -midAngle;
  if (cos < 0) rotation += 180;

  // Hover fallback for tiny slices: sit just outside so the name stays readable.
  if (!fitsRadial && forceShow) {
    const outR = outerRadius + 12;
    const ox = cx + outR * cos;
    const oy = cy + outR * sin;
    return (
      <text
        x={ox}
        y={oy}
        fill="#0f172a"
        textAnchor={cos >= 0 ? "start" : "end"}
        dominantBaseline="central"
        fontSize={FONT_SIZE}
        fontWeight={FONT_WEIGHT}
        style={{ pointerEvents: "none" }}
      >
        {text}
      </text>
    );
  }

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={FONT_SIZE}
      fontWeight={FONT_WEIGHT}
      transform={`rotate(${rotation}, ${x}, ${y})`}
      style={{ pointerEvents: "none" }}
    >
      {text}
    </text>
  );
}
