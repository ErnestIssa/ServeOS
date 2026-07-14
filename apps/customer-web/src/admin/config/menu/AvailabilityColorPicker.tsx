import { AdminLabel } from "../../AdminUi";
import { AVAILABILITY_COLOR_PRESETS, resolveAvailabilityColor } from "./availabilityHelpers";

type Props = {
  value: string;
  onChange: (color: string) => void;
  inline?: boolean;
};

export function AvailabilityColorPicker({ value, onChange, inline = false }: Props) {
  const selected = resolveAvailabilityColor(value);

  return (
    <AdminLabel className={inline ? "admin-menu-availability-color-panel" : undefined}>
      {!inline ? <span className="admin-staff-field-label">Card color</span> : null}
      <div className="admin-menu-availability-color-picker">
        <div className="admin-menu-availability-color-swatches" role="listbox" aria-label="Card color presets">
          {AVAILABILITY_COLOR_PRESETS.map((color) => {
            const active = selected.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={active}
                aria-label={`Select color ${color}`}
                className={`admin-menu-availability-color-swatch${active ? " is-active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
              >
                {active ? <span aria-hidden>✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </AdminLabel>
  );
}
