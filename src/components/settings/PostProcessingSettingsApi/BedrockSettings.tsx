import React from "react";
import { useTranslation } from "react-i18next";

import { Dropdown, SettingContainer } from "@/components/ui";
import {
  BedrockProfileField,
  BedrockRegionField,
  BedrockCustomModelField,
} from "./BedrockFields";
import { useBedrockState } from "./useBedrockState";

export const BedrockSettings: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const state = useBedrockState();

  return (
    <>
      <SettingContainer
        title={t("settings.postProcessing.bedrock.profile.title")}
        description={t("settings.postProcessing.bedrock.profile.description")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <BedrockProfileField
          value={state.profile}
          onBlur={state.handleProfileBlur}
          placeholder="default"
          className="min-w-[320px]"
        />
      </SettingContainer>

      <SettingContainer
        title={t("settings.postProcessing.bedrock.region.title")}
        description={t("settings.postProcessing.bedrock.region.description")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <BedrockRegionField
          value={state.region}
          onBlur={state.handleRegionBlur}
          placeholder="us-east-1"
          className="min-w-[320px]"
        />
      </SettingContainer>

      <SettingContainer
        title={t("settings.postProcessing.bedrock.model.title")}
        description={t("settings.postProcessing.bedrock.model.description")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <Dropdown
          selectedValue={state.selectedModel}
          options={state.modelOptions}
          onSelect={state.handleModelChange}
          placeholder="Select a model or Custom..."
          className="min-w-[380px]"
        />
      </SettingContainer>

      {state.isCustomModel && (
        <SettingContainer
          title={t("settings.postProcessing.bedrock.customModel.title")}
          description={t(
            "settings.postProcessing.bedrock.customModel.description",
          )}
          descriptionMode="tooltip"
          layout="horizontal"
          grouped={true}
        >
          <BedrockCustomModelField
            value={state.customModel}
            onBlur={state.handleCustomModelBlur}
            placeholder=""
            className="min-w-[320px]"
          />
        </SettingContainer>
      )}
    </>
  );
});

BedrockSettings.displayName = "BedrockSettings";
