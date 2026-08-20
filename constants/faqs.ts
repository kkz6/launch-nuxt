export interface FaqDefinition {
  key: string;
}

export interface FaqCategoryDefinition {
  key: string;
  color: string;
  items: FaqDefinition[];
}

// Copy lives in the locale catalogs. These stable identifiers keep the
// presentation order and styling independent from the active language.
export const generalFaqs: FaqDefinition[] = [
  { key: "difference" },
  { key: "cancel" },
  { key: "support" },
  { key: "collaboration" },
  { key: "traffic" },
  { key: "security" },
  { key: "integrations" },
  { key: "ownCloud" },
  { key: "monitoring" },
  { key: "organizations" },
];

export const categorizedFaqs: FaqCategoryDefinition[] = [
  {
    key: "gettingStarted",
    color: "bg-emerald-400",
    items: [{ key: "start" }, { key: "verify" }, { key: "providers" }],
  },
  {
    key: "billing",
    color: "bg-cyan-400",
    items: [{ key: "trials" }, { key: "charge" }, { key: "cancel" }],
  },
  {
    key: "account",
    color: "bg-violet-400",
    items: [{ key: "plan" }, { key: "profile" }, { key: "delete" }],
  },
];
