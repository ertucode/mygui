export function VimHighlight({
  line,
  until,
  highlighted,
  colorClass,
  ...props
}: { line: number; until: string; highlighted: string; colorClass: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="absolute z-10 whitespace-pre flex items-center select-none"
      style={{
        top: HEADER + line * ROW_HEIGHT,
        left: NAME_START,
        height: ROW_HEIGHT,
        fontSize: fontsize,
      }}
      {...props}
    >
      <span className="opacity-0 h-full flex items-center">{until}</span>
      <span className={colorClass + ' h-full flex items-center'}>{highlighted}</span>
    </div>
  )
}

const fontsize = `0.6875rem`

const HEADER = 30
const ROW_HEIGHT = 25.5
const NAME_START = 31.6
