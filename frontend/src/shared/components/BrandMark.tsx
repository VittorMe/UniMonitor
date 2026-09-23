export const BrandMark = ({ compact = false }: { compact?: boolean }) => (
  <span className={`brand${compact ? ' brand-compact' : ''}`}>
    <span className="brand-uni">Uni</span>
    <span className="brand-rest">Monitor</span>
  </span>
);
