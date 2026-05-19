import { getDateLocale } from "@/lib/i18n";

/** Date separator line — horizontal rule with date text centered */
export function DateSeparator({ date }: { date: Date }) {
  const formatted = date.toLocaleDateString(getDateLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative flex items-center justify-center my-4 mx-4">
      {/* Line */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[#3f4147]" />
      </div>
      {/* Date label */}
      <span className="relative bg-[#313338] px-2 text-xs font-semibold text-[#949ba4]">
        {formatted}
      </span>
    </div>
  );
}
