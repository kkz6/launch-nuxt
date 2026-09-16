import type { ApiResponse } from "~/composables/useApi";

export type PhpConfigurationKind = "php_ini" | "php_fpm";

export interface PhpConfiguration {
  kind: PhpConfigurationKind;
  label: string;
  path: string;
  contents: string;
}

const endpoint = (
  serverId: string,
  phpServiceId: string,
  kind: PhpConfigurationKind,
) => `/servers/${serverId}/php/${phpServiceId}/configuration/${kind}`;

export const phpConfigurationService = {
  get: (serverId: string, phpServiceId: string, kind: PhpConfigurationKind) => {
    const { get } = useApi();
    return get<ApiResponse<PhpConfiguration>>(
      endpoint(serverId, phpServiceId, kind),
    );
  },

  update: (
    serverId: string,
    phpServiceId: string,
    kind: PhpConfigurationKind,
    contents: string,
  ) => {
    const { put } = useApi();
    return put<ApiResponse<PhpConfiguration>>(
      endpoint(serverId, phpServiceId, kind),
      { contents },
    );
  },
};
