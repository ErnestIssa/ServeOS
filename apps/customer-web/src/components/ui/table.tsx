import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="ui-table-wrap">
      <table className={cx("ui-table", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cx("ui-table-header", className)} {...props} />;
}

export function TableBody({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cx("ui-table-body", className)} {...props} />;
}

export function TableFooter({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cx("ui-table-footer", className)} {...props} />;
}

export function TableRow({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx("ui-table-row", className)} {...props} />;
}

export function TableHead({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx("ui-table-head", className)} {...props} />;
}

export function TableCell({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx("ui-table-cell", className)} {...props} />;
}

export function TableCaption({ className = "", ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cx("ui-table-caption", className)} {...props} />;
}
