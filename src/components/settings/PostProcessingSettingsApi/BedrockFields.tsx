import React, { useState } from "react";
import { Input } from "../../ui/Input";

interface BedrockProfileFieldProps {
  value: string;
  onBlur: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const BedrockProfileField: React.FC<BedrockProfileFieldProps> =
  React.memo(({ value, onBlur, placeholder, className = "" }) => {
    const [localValue, setLocalValue] = useState(value);

    // Sync with prop changes
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    return (
      <Input
        type="text"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={() => onBlur(localValue)}
        placeholder={placeholder}
        variant="compact"
        className={className}
        autoComplete="off"
        autoCapitalize="off"
      />
    );
  });

BedrockProfileField.displayName = "BedrockProfileField";

interface BedrockRegionFieldProps {
  value: string;
  onBlur: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const BedrockRegionField: React.FC<BedrockRegionFieldProps> = React.memo(
  ({ value, onBlur, placeholder, className = "" }) => {
    const [localValue, setLocalValue] = useState(value);

    // Sync with prop changes
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    return (
      <Input
        type="text"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={() => onBlur(localValue)}
        placeholder={placeholder}
        variant="compact"
        className={className}
        autoComplete="off"
        autoCapitalize="off"
      />
    );
  },
);

BedrockRegionField.displayName = "BedrockRegionField";

interface BedrockCustomModelFieldProps {
  value: string;
  onBlur: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const BedrockCustomModelField: React.FC<BedrockCustomModelFieldProps> =
  React.memo(({ value, onBlur, placeholder, className = "" }) => {
    const [localValue, setLocalValue] = useState(value);

    // Sync with prop changes
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    return (
      <Input
        type="text"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={() => onBlur(localValue)}
        placeholder={placeholder}
        variant="compact"
        className={className}
        autoComplete="off"
        autoCapitalize="off"
      />
    );
  });

BedrockCustomModelField.displayName = "BedrockCustomModelField";
