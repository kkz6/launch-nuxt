import { describe, it, expect } from "vitest";
import {
  getServerTypeRules,
  normalizeCreatePayload,
  getServerTypeIcon,
  getProviderIcon,
} from "~/composables/useServerTypeRules";

describe("getServerTypeRules", () => {
  it("returns PHP rules for the php type", () => {
    const r = getServerTypeRules("php");
    expect(r.showsPhp).toBe(true);
    expect(r.showsDatabase).toBe(true);
    expect(r.showsAgentToggle).toBe(true);
    expect(r.description).toMatch(/PHP/);
  });

  it("hides PHP for database servers but keeps database visible", () => {
    const r = getServerTypeRules("database");
    expect(r.showsPhp).toBe(false);
    expect(r.showsDatabase).toBe(true);
  });

  it("hides both PHP and database for loadbalancer", () => {
    const r = getServerTypeRules("loadbalancer");
    expect(r.showsPhp).toBe(false);
    expect(r.showsDatabase).toBe(false);
  });

  it("hides PHP and database for docker and describes the stack", () => {
    const r = getServerTypeRules("docker");
    expect(r.showsPhp).toBe(false);
    expect(r.showsDatabase).toBe(false);
    expect(r.showsAgentToggle).toBe(true);
    // The description must mention the docker stack so users understand the
    // empty advanced-options panel.
    expect(r.description.toLowerCase()).toMatch(/docker|swarm|traefik/);
  });

  it("falls back to permissive defaults for unknown types", () => {
    const r = getServerTypeRules("future-stack");
    expect(r.showsPhp).toBe(true);
    expect(r.showsDatabase).toBe(true);
    expect(r.description).toBe("");
  });

  it("handles null and undefined gracefully", () => {
    expect(getServerTypeRules(null).showsPhp).toBe(true);
    expect(getServerTypeRules(undefined).showsPhp).toBe(true);
  });
});

describe("normalizeCreatePayload", () => {
  it("preserves php_version and database_type when both apply", () => {
    const out = normalizeCreatePayload({
      type: "php",
      php_version: "php83",
      database_type: "mysql80",
    });
    expect(out.php_version).toBe("php83");
    expect(out.database_type).toBe("mysql80");
  });

  it("forces php_version to 'none' for database servers", () => {
    const out = normalizeCreatePayload({
      type: "database",
      php_version: "php83",
      database_type: "postgresql16",
    });
    expect(out.php_version).toBe("none");
    expect(out.database_type).toBe("postgresql16");
  });

  it("forces both fields to 'none' for docker servers", () => {
    const out = normalizeCreatePayload({
      type: "docker",
      php_version: "php83",
      database_type: "mysql80",
    });
    expect(out.php_version).toBe("none");
    expect(out.database_type).toBe("none");
  });

  it("forces both fields to 'none' for loadbalancer", () => {
    const out = normalizeCreatePayload({
      type: "loadbalancer",
      php_version: "php83",
      database_type: "mysql80",
    });
    expect(out.php_version).toBe("none");
    expect(out.database_type).toBe("none");
  });

  it("does not mutate the original payload", () => {
    const input = {
      type: "docker" as const,
      php_version: "php83",
      database_type: "mysql80",
    };
    const out = normalizeCreatePayload(input);
    expect(input.php_version).toBe("php83");
    expect(out).not.toBe(input);
  });
});

describe("getServerTypeIcon", () => {
  it("returns the docker brand icon for docker", () => {
    expect(getServerTypeIcon("docker")).toBe("simple-icons:docker");
  });

  it("returns distinct icons for each known type", () => {
    const seen = new Set([
      getServerTypeIcon("php"),
      getServerTypeIcon("database"),
      getServerTypeIcon("loadbalancer"),
      getServerTypeIcon("docker"),
    ]);
    expect(seen.size).toBe(4);
  });

  it("falls back to a generic server icon for unknown types", () => {
    expect(getServerTypeIcon("future-stack")).toBe("lucide:server");
    expect(getServerTypeIcon(null)).toBe("lucide:server");
    expect(getServerTypeIcon(undefined)).toBe("lucide:server");
  });
});

describe("getProviderIcon", () => {
  it("returns brand icons for cloud providers", () => {
    expect(getProviderIcon("digitalocean")).toBe("simple-icons:digitalocean");
    expect(getProviderIcon("hetzner")).toBe("simple-icons:hetzner");
    expect(getProviderIcon("aws")).toBe("simple-icons:amazonwebservices");
  });

  it("falls back to a neutral cloud icon for linode", () => {
    // simple-icons dropped its "linode" entry after the Akamai rebrand. The
    // tab is still labelled "Linode" though, so using simple-icons:akamai
    // would mislead users. Pin the neutral lucide:cloud fallback here so
    // nobody re-introduces the broken simple-icons:linode reference.
    expect(getProviderIcon("linode")).toBe("lucide:cloud");
  });

  it("returns a server-cog icon for the custom server tab", () => {
    expect(getProviderIcon("custom_server")).toBe("lucide:server-cog");
  });

  it("falls back to a cloud icon for unknown providers", () => {
    expect(getProviderIcon("future-cloud")).toBe("lucide:cloud");
    expect(getProviderIcon(null)).toBe("lucide:cloud");
    expect(getProviderIcon(undefined)).toBe("lucide:cloud");
  });
});
