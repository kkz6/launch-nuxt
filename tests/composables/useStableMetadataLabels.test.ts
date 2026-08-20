import { afterEach, describe, expect, it, vi } from "vitest";
import { useStableMetadataLabels } from "../../composables/useStableMetadataLabels";
import { createI18nStub } from "../helpers/i18n";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useStableMetadataLabels", () => {
  it("uses stable metadata values and reacts to locale changes", () => {
    const i18n = createI18nStub("ja");
    vi.stubGlobal("useI18n", () => i18n);

    const {
      getLogName,
      getServerTypeLabel,
      getSiteFileDescription,
      getSiteFileName,
      getSiteTypeLabel,
    } = useStableMetadataLabels();

    const environmentFile = {
      file_type: "environment",
      name: "Backend English environment name",
      description: "Backend English environment description",
    };

    expect(getSiteFileName(environmentFile)).toBe("環境ファイル");
    expect(getSiteFileDescription(environmentFile)).toContain(
      "サイトの環境ファイル",
    );
    expect(getServerTypeLabel("database", "Backend English server type")).toBe(
      "データベースサーバー",
    );
    expect(getSiteTypeLabel("static", "Backend English site type")).toBe(
      "静的サイト",
    );
    expect(
      getLogName({
        file_type: "caddy_log",
        name: "Backend English site log",
        software: "",
        show_route: "site-log-route",
      }),
    ).toBe("Caddyログ");
    expect(
      getLogName({
        name: "Backend English server log",
        software: "caddy2_lb",
        show_route: "server-log-route",
      }),
    ).toBe("Caddy 2（ロードバランサー）ログ");

    i18n.locale.value = "en";

    expect(getSiteFileName(environmentFile)).toBe("Environment file");
    expect(getServerTypeLabel("database", "Backend English server type")).toBe(
      "Database Server",
    );
    expect(getSiteTypeLabel("static", "Backend English site type")).toBe(
      "Static site",
    );
  });

  it("preserves unknown backend metadata instead of inventing a label", () => {
    vi.stubGlobal("useI18n", () => createI18nStub("ja"));
    const {
      getLogName,
      getServerTypeLabel,
      getSiteFileDescription,
      getSiteFileName,
      getSiteTypeLabel,
    } = useStableMetadataLabels();

    const customFile = {
      file_type: "custom_user_file",
      name: "customer-config.toml",
      description: "Customer-provided description",
    };

    expect(getSiteFileName(customFile)).toBe("customer-config.toml");
    expect(getSiteFileDescription(customFile)).toBe(
      "Customer-provided description",
    );
    expect(getServerTypeLabel("future_type", "Future Server")).toBe(
      "Future Server",
    );
    expect(getSiteTypeLabel("future_type", "Future Site")).toBe("Future Site");
    expect(
      getLogName({
        name: "custom-service.log",
        software: "custom_service",
        show_route: "custom-log-route",
      }),
    ).toBe("custom-service.log");
  });
});
