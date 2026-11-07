import type { ApiResponse } from "~/composables/useApi";

export interface DeviceAuthorizationRequest {
  user_code: string;
  approve: boolean;
  code?: string;
}

export interface DeviceAuthorizationResponse {
  status: "approved" | "denied";
}

export const deviceAuthService = {
  authorize: (request: DeviceAuthorizationRequest) => {
    const { post } = useApi();
    return post<ApiResponse<DeviceAuthorizationResponse>>(
      "/auth/device/authorize",
      request,
    );
  },
};
