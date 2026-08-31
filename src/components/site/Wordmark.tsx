import { splitWordmark } from "@/lib/site/config";

/** The site wordmark, with the dot of a domain-shaped name drawn in the accent colour. */
export function Wordmark() {
  const [head, tail] = splitWordmark();
  if (tail === null) return <>{head}</>;
  return (
    <>
      {head}
      <span className="text-pen">.</span>
      {tail}
    </>
  );
}
