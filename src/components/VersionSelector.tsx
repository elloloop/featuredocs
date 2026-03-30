"use client";

import { useRouter } from "next/navigation";

interface VersionSelectorProps {
  productSlug: string;
  locale: string;
  featureSlug: string;
  currentVersion: string;
  versions: string[];
  latestVersion: string;
}

export default function VersionSelector({
  productSlug,
  locale,
  featureSlug,
  currentVersion,
  versions,
  latestVersion,
}: VersionSelectorProps) {
  const router = useRouter();

  function handleVersionChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newVersion = event.target.value;
    router.push(`/${productSlug}/${locale}/${featureSlug}/${newVersion}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="version-selector"
        className="text-xs text-[#6B6B6B]"
      >
        Version:
      </label>
      <select
        id="version-selector"
        value={currentVersion}
        onChange={handleVersionChange}
        className="rounded border border-[#E8E6E1] bg-white px-2 py-1 text-xs text-[#1A1A1A] focus:border-[#6B6B6B] focus:outline-none focus:ring-1 focus:ring-[#6B6B6B]"
      >
        {versions.map((version) => (
          <option key={version} value={version}>
            v{version}
            {version === latestVersion ? " (latest)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
