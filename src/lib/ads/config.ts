export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const ADS_ENABLED = process.env.NODE_ENV === "production" && Boolean(ADSENSE_CLIENT);
export const ADSENSE_LOADER = ADSENSE_CLIENT ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}` : "";
export const SLOTS = {
  in1: process.env.ADSENSE_SLOT_IN1 ?? "",
  in2: process.env.ADSENSE_SLOT_IN2 ?? "",
  end: process.env.ADSENSE_SLOT_END ?? "",
  list: process.env.ADSENSE_SLOT_LIST ?? "",
};
