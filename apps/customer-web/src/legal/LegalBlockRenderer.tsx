import type { LegalBlock, LegalSlug } from "./types";

type Props = {
  blocks: LegalBlock[];
  onGoLegal: (slug: LegalSlug) => void;
};

export function LegalBlockRenderer({ blocks, onGoLegal }: Props) {
  return (
    <div className="legal-block-stack">
      {blocks.map((block, i) => {
        if (block.kind === "p") {
          return (
            <p key={i} className="legal-block-p">
              {block.text}
            </p>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={i} className="legal-block-ul">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={i} className="legal-block-ol">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          );
        }
        if (block.kind === "sub") {
          return (
            <div key={i} className="legal-block-sub">
              <h4 className="legal-block-subtitle">{block.title}</h4>
              <LegalBlockRenderer blocks={block.blocks} onGoLegal={onGoLegal} />
            </div>
          );
        }
        if (block.kind === "callout") {
          return (
            <aside key={i} className="legal-callout">
              <p className="legal-callout-title">{block.title}</p>
              <p className="legal-callout-text">{block.text}</p>
            </aside>
          );
        }
        if (block.kind === "link") {
          return (
            <button
              key={i}
              type="button"
              className="legal-inline-link"
              onClick={() => onGoLegal(block.slug)}
            >
              {block.label} →
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}
