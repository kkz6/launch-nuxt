import { afterEach, describe, expect, it, vi } from "vitest";
import { phpConfigurationService } from "../../services/phpConfigurationService";

describe("phpConfigurationService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads a trusted version-scoped PHP configuration kind", async () => {
    const get = vi.fn().mockResolvedValue({ success: true, data: {} });
    vi.stubGlobal("useApi", () => ({ get }));

    await phpConfigurationService.get("server-1", "php-1", "php_ini");

    expect(get).toHaveBeenCalledWith(
      "/servers/server-1/php/php-1/configuration/php_ini",
    );
  });

  it("updates only the selected PHP configuration kind", async () => {
    const put = vi.fn().mockResolvedValue({ success: true, data: {} });
    vi.stubGlobal("useApi", () => ({ put }));

    await phpConfigurationService.update(
      "server-1",
      "php-1",
      "php_fpm",
      "include=/etc/php/8.3/fpm/pool.d/*.conf\n",
    );

    expect(put).toHaveBeenCalledWith(
      "/servers/server-1/php/php-1/configuration/php_fpm",
      { contents: "include=/etc/php/8.3/fpm/pool.d/*.conf\n" },
    );
  });
});
