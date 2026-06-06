import type { NavMegaMenu } from "./navContent";
import { runNavAction, type NavHandlers } from "./navActions";
import { linkHoverShiftGroup } from "./styles";

type Props = {
  menu: NavMegaMenu;
  darkSurface: boolean;
  handlers: NavHandlers;
  onClose: () => void;
};

/** Panel content only — chrome lives on the parent header so it reads as one body. */
export function NavMegaMenuPanel({ menu, darkSurface, handlers, onClose }: Props) {
  const colCount = menu.columns.length;

  return (
    <div className="px-5 py-6 sm:px-6 md:px-8 md:py-8">
      <div
        className="grid gap-8"
        style={{
          gridTemplateColumns: `repeat(${Math.min(colCount, 4)}, minmax(0, 1fr))`
        }}
      >
        {menu.columns.map((col) => (
          <div key={col.title}>
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                darkSurface ? "text-violet-300/90" : "text-violet-700/80"
              }`}
            >
              {col.title}
            </p>
            <ul className="mt-3 space-y-0.5">
              {col.items.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className="group flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left"
                    onClick={() => {
                      runNavAction(item.action, handlers);
                      onClose();
                    }}
                  >
                    <span>
                      <span
                        className={`block text-sm font-semibold ${linkHoverShiftGroup} ${
                          darkSurface ? "text-white group-hover:text-violet-200" : "text-slate-900 group-hover:text-violet-800"
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.description ? (
                        <span className={`mt-0.5 block text-xs ${darkSurface ? "text-slate-400" : "text-slate-500"}`}>
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    {item.badge ? (
                      <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
