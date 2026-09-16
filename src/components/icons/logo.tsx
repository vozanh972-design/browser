export const Logo = (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
  // biome-ignore lint/performance/noImgElement: static app logo asset, not subject to next/image optimization
  <img
    src="/app-logo.png"
    alt="AutoLunex"
    {...props}
    className={`inline-block object-cover ${props.className ?? ""}`.trim()}
  />
);
