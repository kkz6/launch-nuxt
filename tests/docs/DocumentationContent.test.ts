import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const readDoc = (path: string) =>
  readFileSync(join(root, "content", "docs", `${path}.md`), "utf8");

const readProjectFile = (path: string) =>
  readFileSync(join(root, path), "utf8");

const docTargetExists = (route: string): boolean => {
  const relative = route.replace(/^\/docs\/?/, "");
  const direct = join(root, "content", "docs", `${relative}.md`);
  const index = join(root, "content", "docs", relative, "index.md");
  try {
    return statSync(direct).isFile() || statSync(index).isFile();
  } catch {
    try {
      return statSync(index).isFile();
    } catch {
      return false;
    }
  }
};

describe("Docker and AI documentation", () => {
  it.each([
    "cli/ai-skill",
    "application/docker/index",
    "application/docker/applications",
    "api/docker-applications",
  ])("has valid page metadata for %s", (path) => {
    const content = readDoc(path);
    expect(content).toMatch(/^---\ntitle: .+\ndescription: .+\n---\n/);
  });

  it("documents both AI skill installation paths and safe Docker operation", () => {
    const content = readDoc("cli/ai-skill");
    expect(content).toContain("lctl ai install");
    expect(content).toContain("codex plugin marketplace add");
    expect(content).toContain("--ref v0.2.3");
    expect(content).not.toContain("--ref v0.2.2");
    expect(content).toContain("docker.application.*");
    expect(content).toContain("queued HTTP response");
  });

  it("documents all supported Docker application sources and build locations", () => {
    const content = readDoc("application/docker/applications");
    for (const expected of [
      "Docker image",
      "Git repository",
      "Inline Dockerfile",
      "Nixpacks",
      "Server",
      "GitHub Actions",
      "Runtime variables",
      "Build secrets",
      "Named volumes",
    ]) {
      expect(content).toContain(expected);
    }
  });

  it("keeps internal links on the new pages resolvable", () => {
    const pages = [
      readDoc("cli/ai-skill"),
      readDoc("application/docker/index"),
      readDoc("application/docker/applications"),
      readDoc("api/docker-applications"),
    ];
    const routes = pages.flatMap((content) =>
      [...content.matchAll(/\]\((\/docs\/[^)#]+)(?:#[^)]+)?\)/g)].map(
        (match) => match[1],
      ),
    );

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(
        docTargetExists(route),
        `missing documentation target ${route}`,
      ).toBe(true);
    }
  });

  it("groups the documentation landing pages by workflow", () => {
    expect(readDoc("index")).toContain("## Automation and AI");
    expect(readDoc("application/index")).toContain(
      "## Infrastructure and deployments",
    );
    expect(readDoc("application/docker/index")).toContain(
      "## Dashboard guides",
    );
    expect(readDoc("cli/index")).toContain("## Live, automation, and AI");
    expect(readDoc("api/index")).toContain("## Container endpoints");
  });

  it("describes launchctl as hosted-only", () => {
    const automation = readDoc("cli/automation");
    const index = readDoc("cli/index");

    expect(automation).toContain("launchctl is currently a hosted service");
    expect(automation).toContain("it is not a self-hosting interface");
    expect(index).toContain("launchctl is currently hosted-only");
    expect(index).not.toContain("project config, self-hosting");
  });

  it("documents trusted installation and CLI self-updates", () => {
    const index = readDoc("cli/index");
    const automation = readDoc("cli/automation");

    expect(index).toContain("brew install kkz6/tap/lctl");
    expect(index).toContain("brew trust --formula kkz6/tap/lctl");
    expect(index).toContain("lctl update --check");
    expect(index).toContain("lctl update --force");
    expect(index).toContain("LAUNCHCTL_NO_UPDATE_CHECK=1");
    expect(index).not.toContain("go install github.com/kkz6/launchctl@latest");
    expect(automation).toContain("LAUNCHCTL_NO_UPDATE_CHECK");
  });

  it("keeps documentation menus free of decorative left borders", () => {
    const navItems = readProjectFile("components/docs/NavItems.vue");
    const docsLayout = readProjectFile("layouts/docs.vue");

    expect(navItems).not.toContain("border-l");
    expect(navItems).not.toContain("inset_2px_0");
    expect(docsLayout).not.toContain("border-l");
  });
});
