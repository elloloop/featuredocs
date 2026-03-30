import type { DeviceType, Orientation } from "@/lib/types";

interface DeviceFrameProps {
  device: DeviceType;
  orientation: Orientation;
  children: React.ReactNode;
}

const FRAME_STYLES: Record<
  DeviceType,
  Record<Orientation, { width: string; aspectRatio: string; borderRadius: string }>
> = {
  iphone: {
    portrait: { width: "280px", aspectRatio: "9/19.5", borderRadius: "40px" },
    landscape: { width: "100%", aspectRatio: "19.5/9", borderRadius: "40px" },
  },
  ipad: {
    portrait: { width: "380px", aspectRatio: "3/4", borderRadius: "24px" },
    landscape: { width: "100%", aspectRatio: "4/3", borderRadius: "24px" },
  },
  "android-phone": {
    portrait: { width: "280px", aspectRatio: "9/20", borderRadius: "32px" },
    landscape: { width: "100%", aspectRatio: "20/9", borderRadius: "32px" },
  },
  "android-tablet": {
    portrait: { width: "380px", aspectRatio: "5/8", borderRadius: "20px" },
    landscape: { width: "100%", aspectRatio: "8/5", borderRadius: "20px" },
  },
};

export default function DeviceFrame({
  device,
  orientation,
  children,
}: DeviceFrameProps) {
  const frameStyle = FRAME_STYLES[device]?.[orientation] ?? FRAME_STYLES.ipad.portrait;

  return (
    <div className="flex justify-center">
      <div
        className="relative overflow-hidden border-[3px] border-[#2A2A2A] bg-black shadow-xl"
        style={{
          width: frameStyle.width,
          maxWidth: "100%",
          aspectRatio: frameStyle.aspectRatio,
          borderRadius: frameStyle.borderRadius,
        }}
      >
        {/* Notch / camera for phones */}
        {(device === "iphone" || device === "android-phone") &&
          orientation === "portrait" && (
            <div className="absolute left-1/2 top-0 z-10 h-[28px] w-[120px] -translate-x-1/2 rounded-b-2xl bg-[#2A2A2A]" />
          )}

        {/* Home indicator for iphone */}
        {device === "iphone" && orientation === "portrait" && (
          <div className="absolute bottom-[6px] left-1/2 z-10 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-[#555]" />
        )}

        <div className="absolute inset-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
