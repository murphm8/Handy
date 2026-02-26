import { useCallback } from "react";
import { useSettings } from "../../../hooks/useSettings";

const BEDROCK_PROVIDER_ID = "bedrock";

export const BEDROCK_MODELS = [
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

export type BedrockState = {
  profile: string;
  region: string;
  selectedModel: string;
  isCustomModel: boolean;
  customModel: string;
  modelOptions: typeof BEDROCK_MODELS;
  handleProfileBlur: (value: string) => void;
  handleRegionBlur: (value: string) => void;
  handleModelChange: (value: string) => void;
  handleCustomModelBlur: (value: string) => void;
};

export const useBedrockState = (): BedrockState => {
  const { settings, getSetting, updateSetting, updatePostProcessModel } =
    useSettings();

  const profile = (getSetting("bedrock_profile") as string) || "";
  const region = (getSetting("bedrock_region") as string) || "us-east-1";
  const customModel = (getSetting("bedrock_custom_model") as string) || "";
  const selectedModel =
    settings?.post_process_models?.[BEDROCK_PROVIDER_ID] ?? "";

  const handleProfileBlur = useCallback(
    (value: string) => {
      void updateSetting("bedrock_profile", value || null);
    },
    [updateSetting],
  );

  const handleRegionBlur = useCallback(
    (value: string) => {
      void updateSetting("bedrock_region", value);
    },
    [updateSetting],
  );

  const handleModelChange = useCallback(
    (value: string) => {
      void updatePostProcessModel(BEDROCK_PROVIDER_ID, value.trim());
    },
    [updatePostProcessModel],
  );

  const handleCustomModelBlur = useCallback(
    (value: string) => {
      void updateSetting("bedrock_custom_model", value || null);
    },
    [updateSetting],
  );

  return {
    profile,
    region,
    selectedModel,
    isCustomModel: selectedModel === "custom",
    customModel,
    modelOptions: BEDROCK_MODELS,
    handleProfileBlur,
    handleRegionBlur,
    handleModelChange,
    handleCustomModelBlur,
  };
};
