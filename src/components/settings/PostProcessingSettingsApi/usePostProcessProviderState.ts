import { useCallback, useMemo, useState } from "react";
import { useSettings } from "../../../hooks/useSettings";
import { commands } from "@/bindings";
import type { ModelOption } from "./types";
import type { DropdownOption } from "../../ui/Dropdown";

const APPLE_PROVIDER_ID = "apple_intelligence";
const BEDROCK_PROVIDER_ID = "bedrock";
const CUSTOM_PROVIDER_ID = "custom";

const BEDROCK_MODELS = [
  {
    value: "us.anthropic.claude-opus-4-6-v1",
    label: "Claude Opus 4.6",
  },
  {
    value: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    label: "Claude Sonnet 4.5",
  },
  {
    value: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5",
  },
  {
    value: "anthropic.claude-3-haiku-20240307-v1:0",
    label: "Claude 3 Haiku",
  },
  {
    value: "us.amazon.nova-pro-v1:0",
    label: "Amazon Nova Pro",
  },
  {
    value: "us.meta.llama3-3-70b-instruct-v1:0",
    label: "Meta Llama 3.3 70B",
  },
  {
    value: "custom",
    label: "Custom Model",
  },
];

const noop = () => {};

export type PostProcessProviderState = {
  // Common
  providerOptions: DropdownOption[];
  selectedProviderId: string;
  handleProviderSelect: (providerId: string) => void;
  isAppleProvider: boolean;
  isBedrockProvider: boolean;
  isCustomProvider: boolean;

  // Apple Intelligence
  unavailable: boolean;

  // Bedrock
  profile: string;
  region: string;
  selectedModel: string;
  isCustomModel: boolean;
  customModel: string;
  handleProfileBlur: (value: string) => void;
  handleRegionBlur: (value: string) => void;
  handleCustomModelBlur: (value: string) => void;

  // Standard
  baseUrl: string;
  handleBaseUrlChange: (value: string) => void;
  isBaseUrlUpdating: boolean;
  apiKey: string;
  handleApiKeyChange: (value: string) => void;
  isApiKeyUpdating: boolean;
  model: string;
  handleModelChange: (value: string) => void;
  modelOptions: ModelOption[] | typeof BEDROCK_MODELS;
  isModelUpdating: boolean;
  isFetchingModels: boolean;
  handleModelSelect: (value: string) => void;
  handleModelCreate: (value: string) => void;
  handleRefreshModels: () => void;
};

export const usePostProcessProviderState = (): PostProcessProviderState => {
  const {
    settings,
    getSetting,
    updateSetting,
    isUpdating,
    setPostProcessProvider,
    updatePostProcessBaseUrl,
    updatePostProcessApiKey,
    updatePostProcessModel,
    fetchPostProcessModels,
    postProcessModelOptions,
  } = useSettings();

  const [appleIntelligenceUnavailable, setAppleIntelligenceUnavailable] = useState(false);

  // ── Common state ──────────────────────────────────────────────────────

  const providers = settings?.post_process_providers || [];

  const selectedProviderId = useMemo(() => {
    return settings?.post_process_provider_id || providers[0]?.id || "openai";
  }, [providers, settings?.post_process_provider_id]);

  const selectedProvider = useMemo(() => {
    return (
      providers.find((provider) => provider.id === selectedProviderId) ||
      providers[0]
    );
  }, [providers, selectedProviderId]);

  const isAppleProvider = selectedProvider?.id === APPLE_PROVIDER_ID;
  const isBedrockProvider = selectedProvider?.id === BEDROCK_PROVIDER_ID;
  const isCustomProvider = selectedProvider?.id === CUSTOM_PROVIDER_ID;

  const providerOptions = useMemo<DropdownOption[]>(() => {
    return providers.map((provider) => ({
      value: provider.id,
      label: provider.label,
    }));
  }, [providers]);

  const handleProviderSelect = useCallback(
    async (providerId: string) => {
      // Clear error state on any selection attempt (allows dismissing the error)
      setAppleIntelligenceUnavailable(false);

      if (providerId === selectedProviderId) return;

      // Check Apple Intelligence availability before selecting
      if (providerId === APPLE_PROVIDER_ID) {
        const available = await commands.checkAppleIntelligenceAvailable();
        if (!available) {
          setAppleIntelligenceUnavailable(true);
          // Don't return - still set the provider so dropdown shows the selection
          // The backend gracefully handles unavailable Apple Intelligence
        }
      }

      await setPostProcessProvider(providerId);

      // Auto-fetch available models for the new provider so the model dropdown
      // reflects what's actually valid. Without this, a stale model value from
      // a previous provider/base_url can persist and silently 404 at runtime.
      // Skip when the provider isn't configured yet (no API key / empty base URL)
      // to avoid unnecessary backend errors.
      if (providerId !== APPLE_PROVIDER_ID) {
        const provider = providers.find((p) => p.id === providerId);
        const apiKey = settings?.post_process_api_keys?.[providerId] ?? "";
        const hasBaseUrl = (provider?.base_url ?? "").trim() !== "";
        const hasApiKey = apiKey.trim() !== "";

        if (provider?.id === "custom" ? hasBaseUrl : hasApiKey) {
          void fetchPostProcessModels(providerId);
        }
      }
    },
    [
      selectedProviderId,
      setPostProcessProvider,
      fetchPostProcessModels,
      providers,
      settings,
    ],
  );

  const model = settings?.post_process_models?.[selectedProviderId] ?? "";

  // ── Bedrock-specific state ────────────────────────────────────────────

  const bedrockProfile = (getSetting("bedrock_profile") as string) || "";
  const bedrockRegion =
    (getSetting("bedrock_region") as string) || "us-east-1";
  const bedrockCustomModel =
    (getSetting("bedrock_custom_model") as string) || "";

  const handleBedrockProfileBlur = useCallback(
    (value: string) => {
      void updateSetting("bedrock_profile", value || null);
    },
    [updateSetting],
  );

  const handleBedrockRegionBlur = useCallback(
    (value: string) => {
      void updateSetting("bedrock_region", value);
    },
    [updateSetting],
  );

  const handleBedrockModelChange = useCallback(
    (value: string) => {
      void updatePostProcessModel(selectedProviderId, value.trim());
    },
    [selectedProviderId, updatePostProcessModel],
  );

  const handleBedrockCustomModelBlur = useCallback(
    (value: string) => {
      void updateSetting("bedrock_custom_model", value || null);
    },
    [updateSetting],
  );

  // ── Standard provider state ───────────────────────────────────────────

  const baseUrl = selectedProvider?.base_url ?? "";
  const apiKey = settings?.post_process_api_keys?.[selectedProviderId] ?? "";

  const handleBaseUrlChange = useCallback(
    (value: string) => {
      if (!isCustomProvider) return;
      const trimmed = value.trim();
      if (trimmed && trimmed !== baseUrl) {
        void updatePostProcessBaseUrl(selectedProviderId, trimmed);
      }
    },
    [isCustomProvider, selectedProviderId, baseUrl, updatePostProcessBaseUrl],
  );

  const handleApiKeyChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed !== apiKey) {
        void updatePostProcessApiKey(selectedProviderId, trimmed);
      }
    },
    [apiKey, selectedProviderId, updatePostProcessApiKey],
  );

  const handleModelChange = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed !== model) {
        void updatePostProcessModel(selectedProviderId, trimmed);
      }
    },
    [model, selectedProviderId, updatePostProcessModel],
  );

  const handleModelSelect = useCallback(
    (value: string) => {
      void updatePostProcessModel(selectedProviderId, value.trim());
    },
    [selectedProviderId, updatePostProcessModel],
  );

  const handleModelCreate = useCallback(
    (value: string) => {
      void updatePostProcessModel(selectedProviderId, value);
    },
    [selectedProviderId, updatePostProcessModel],
  );

  const handleRefreshModels = useCallback(() => {
    void fetchPostProcessModels(selectedProviderId);
  }, [fetchPostProcessModels, selectedProviderId]);

  const availableModelsRaw = postProcessModelOptions[selectedProviderId] || [];

  const modelOptions = useMemo<ModelOption[]>(() => {
    const seen = new Set<string>();
    const options: ModelOption[] = [];

    const upsert = (value: string | null | undefined) => {
      const trimmed = value?.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ value: trimmed, label: trimmed });
    };

    for (const candidate of availableModelsRaw) {
      upsert(candidate);
    }

    upsert(model);

    return options;
  }, [availableModelsRaw, model]);

  const isBaseUrlUpdating = isUpdating(
    `post_process_base_url:${selectedProviderId}`,
  );
  const isApiKeyUpdating = isUpdating(
    `post_process_api_key:${selectedProviderId}`,
  );
  const isModelUpdating = isUpdating(
    `post_process_model:${selectedProviderId}`,
  );
  const isFetchingModels = isUpdating(
    `post_process_models_fetch:${selectedProviderId}`,
  );

  // ── Defaults for inactive variants ────────────────────────────────────

  const defaults = {
    providerOptions,
    selectedProviderId,
    handleProviderSelect,
    isAppleProvider,
    isBedrockProvider,
    isCustomProvider,
    // Apple Intelligence defaults
    unavailable: false,
    // Bedrock defaults
    profile: "",
    region: "",
    selectedModel: "",
    isCustomModel: false,
    customModel: "",
    handleProfileBlur: noop,
    handleRegionBlur: noop,
    handleCustomModelBlur: noop,
    // Standard defaults
    baseUrl: "",
    handleBaseUrlChange: noop,
    isBaseUrlUpdating: false,
    apiKey: "",
    handleApiKeyChange: noop,
    isApiKeyUpdating: false,
    model: "",
    handleModelChange: noop,
    modelOptions: [] as ModelOption[],
    isModelUpdating: false,
    isFetchingModels: false,
    handleModelSelect: noop,
    handleModelCreate: noop,
    handleRefreshModels: noop,
  };

  if (isBedrockProvider) {
    return {
      ...defaults,
      profile: bedrockProfile,
      region: bedrockRegion,
      selectedModel: model,
      isCustomModel: model === "custom",
      customModel: bedrockCustomModel,
      modelOptions: BEDROCK_MODELS,
      handleProfileBlur: handleBedrockProfileBlur,
      handleRegionBlur: handleBedrockRegionBlur,
      handleModelChange: handleBedrockModelChange,
      handleCustomModelBlur: handleBedrockCustomModelBlur,
    };
  }

  if (isAppleProvider) {
    return {
      ...defaults,
      unavailable: appleIntelligenceUnavailable,
    };
  }

  return {
    ...defaults,
    baseUrl,
    handleBaseUrlChange,
    isBaseUrlUpdating,
    apiKey,
    handleApiKeyChange,
    isApiKeyUpdating,
    model,
    handleModelChange,
    modelOptions,
    isModelUpdating,
    isFetchingModels,
    handleModelSelect,
    handleModelCreate,
    handleRefreshModels,
  };
};
