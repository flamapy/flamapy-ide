/* eslint-disable react/prop-types */
import { vsCard, vsCardHeader, vsCardTitle } from "./styles";

// featuredraw-style card: white surface, subtle border, header with an optional
// colored accent bar and a small uppercase title, plus an optional `right` slot.
function Card({ title, accent, right, children, pad = true, className = "" }) {
  return (
    <section className={`${vsCard} ${className}`}>
      {title && (
        <header className={vsCardHeader}>
          {accent && (
            <span className="w-1.5 h-4 rounded-full" style={{ background: accent }} />
          )}
          <h3 className={vsCardTitle}>{title}</h3>
          {right}
        </header>
      )}
      <div className={pad ? "p-3 space-y-2.5" : ""}>{children}</div>
    </section>
  );
}

export default Card;
